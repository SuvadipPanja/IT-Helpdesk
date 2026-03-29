// ============================================
// BOT AUTO-TRAINING SERVICE
// Scans resolved tickets, extracts resolution patterns,
// and builds supplementary knowledge for the bot
// ============================================

const db = require('../config/database');
const logger = require('../utils/logger');

class BotTrainingService {

  /**
   * Check if auto-training feature is enabled
   */
  async isAutoTrainingEnabled() {
    try {
      const result = await db.executeQuery(`
        SELECT is_enabled, configuration
        FROM bot_advanced_features
        WHERE feature_name = 'auto_training'
      `);
      const feature = result.recordset?.[0];
      return {
        enabled: feature?.is_enabled === true || feature?.is_enabled === 1,
        config: feature?.configuration ? JSON.parse(feature.configuration) : {}
      };
    } catch (error) {
      logger.error('Error checking auto-training status:', error);
      return { enabled: false, config: {} };
    }
  }

  /**
   * Scan resolved tickets and extract training patterns
   * @param {Object} options - { limit, sinceDate, ticketId }
   */
  async scanAndTrain(options = {}) {
    const startTime = Date.now();
    const stats = {
      ticketsScanned: 0,
      newPatternsLearned: 0,
      patternsUpdated: 0,
      patternsSkipped: 0,
      diagnostics: {}
    };

    try {
      const { enabled, config } = await this.isAutoTrainingEnabled();
      if (!enabled && !options.force) {
        return { success: false, message: 'Auto-training is disabled' };
      }

      const limit = options.limit || 100;
      const minResolutionLength = config.min_resolution_length || 20;

      // DIAGNOSTIC: Count eligible tickets BEFORE filtering
      const diagCountQuery = `
        SELECT 
          COUNT(*) as total_resolved,
          SUM(CASE WHEN t.resolution_notes IS NOT NULL THEN 1 ELSE 0 END) as with_notes,
          SUM(CASE WHEN t.resolution_notes IS NOT NULL AND LEN(t.resolution_notes) >= @minLen THEN 1 ELSE 0 END) as with_sufficient_notes
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
      `;
      const diagResult = await db.executeQuery(diagCountQuery, { minLen: minResolutionLength });
      const diagCounts = diagResult.recordset?.[0] || {};
      stats.diagnostics.resolved_tickets_total = diagCounts.total_resolved || 0;
      stats.diagnostics.with_resolution_notes = diagCounts.with_notes || 0;
      stats.diagnostics.with_sufficient_notes = diagCounts.with_sufficient_notes || 0;

      // DIAGNOSTIC: Count already-trained tickets
      const trainedCountQuery = `
        SELECT COUNT(DISTINCT source_ticket_id) as count FROM bot_training_data WHERE source_ticket_id IS NOT NULL
      `;
      const trainedResult = await db.executeQuery(trainedCountQuery);
      stats.diagnostics.already_trained = trainedResult.recordset?.[0]?.count || 0;

      // Build query to find resolved tickets with resolution notes
      let query = `
        SELECT TOP (@limit)
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.description,
          t.resolution_notes,
          t.closed_at,
          tc.category_name,
          tp.priority_name
        FROM tickets t
        LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          AND t.resolution_notes IS NOT NULL
          AND LEN(t.resolution_notes) >= @minLen
          AND t.ticket_id NOT IN (
            SELECT source_ticket_id FROM bot_training_data WHERE source_ticket_id IS NOT NULL
          )
      `;

      const params = { limit, minLen: minResolutionLength };

      if (options.sinceDate) {
        query += ` AND t.closed_at >= @sinceDate`;
        params.sinceDate = options.sinceDate;
      }

      if (options.ticketId) {
        query = `
          SELECT
            t.ticket_id,
            t.ticket_number,
            t.subject,
            t.description,
            t.resolution_notes,
            t.closed_at,
            tc.category_name,
            tp.priority_name
          FROM tickets t
          LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
          LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
          WHERE t.ticket_id = @ticketId
            AND t.resolution_notes IS NOT NULL
        `;
        params.ticketId = options.ticketId;
        delete params.limit;
        delete params.minLen;
      }

      query += ` ORDER BY t.closed_at DESC`;

      const result = await db.executeQuery(query, params);
      const tickets = result.recordset || [];
      stats.ticketsScanned = tickets.length;
      stats.diagnostics.eligible_tickets_found = tickets.length;

      logger.info(`Bot Training: Found ${tickets.length} eligible tickets for training`);

      for (const ticket of tickets) {
        try {
          await this.learnFromTicket(ticket, stats);
        } catch (ticketErr) {
          logger.warn(`Failed to learn from ticket ${ticket.ticket_number}:`, ticketErr.message);
          stats.patternsSkipped++;
        }
      }

      const durationMs = Date.now() - startTime;

      // Log the training run
      await this.logTrainingRun({
        scanType: options.ticketId ? 'single_ticket' : (options.sinceDate ? 'incremental' : 'full_scan'),
        ...stats,
        durationMs,
        status: 'completed',
        triggeredBy: options.triggeredBy || 'manual'
      });

      return {
        success: true,
        ...stats,
        durationMs,
        message: `Scanned ${stats.ticketsScanned} tickets, learned ${stats.newPatternsLearned} new patterns`
      };
    } catch (error) {
      logger.error('Auto-training scan failed:', error);
      const durationMs = Date.now() - startTime;
      await this.logTrainingRun({
        scanType: 'full_scan',
        ...stats,
        durationMs,
        status: 'failed',
        errorMessage: error.message,
        triggeredBy: options.triggeredBy || 'manual'
      });
      throw error;
    }
  }

  /**
   * Extract training data from a single ticket
   */
  async learnFromTicket(ticket, stats) {
    const category = this.categorizeTicket(ticket);
    const keywords = this.extractKeywords(ticket);

    // Check if we already have this ticket's data
    const existing = await db.executeQuery(
      `SELECT training_id FROM bot_training_data WHERE source_ticket_id = @ticketId`,
      { ticketId: ticket.ticket_id }
    );

    if (existing.recordset?.length > 0) {
      stats.patternsSkipped++;
      return;
    }

    // Build the question pattern from subject + description
    const questionPattern = this.buildQuestionPattern(ticket);

    // Build clean resolution text
    const resolutionText = this.cleanResolutionText(ticket.resolution_notes);

    if (!resolutionText || resolutionText.length < 10) {
      stats.patternsSkipped++;
      return;
    }

    await db.executeQuery(`
      INSERT INTO bot_training_data 
      (source_ticket_id, source_ticket_number, category, keywords, 
       question_pattern, resolution_text, confidence_score, created_by)
      VALUES
      (@ticketId, @ticketNumber, @category, @keywords,
       @questionPattern, @resolutionText, @confidence, 'auto_training')
    `, {
      ticketId: ticket.ticket_id,
      ticketNumber: ticket.ticket_number,
      category,
      keywords: JSON.stringify(keywords),
      questionPattern,
      resolutionText,
      confidence: 0.7
    });

    stats.newPatternsLearned++;
  }

  /**
   * Categorize a ticket based on its content
   */
  categorizeTicket(ticket) {
    const text = `${ticket.subject || ''} ${ticket.description || ''} ${ticket.category_name || ''}`.toLowerCase();

    const categoryMap = {
      network: /\b(network|wifi|internet|connectivity|dns|dhcp|lan|ethernet|firewall|proxy)\b/,
      email: /\b(email|outlook|mail|inbox|smtp|imap|exchange|calendar)\b/,
      hardware: /\b(hardware|monitor|keyboard|mouse|laptop|desktop|printer|scanner|usb|disk|drive|memory|ram)\b/,
      software: /\b(software|install|application|program|update|crash|error|license|activation)\b/,
      vpn: /\b(vpn|remote|citrix|rdp|remote desktop|tunnel)\b/,
      security: /\b(security|password|locked|virus|malware|phishing|2fa|mfa|access|permission)\b/,
      printer: /\b(printer|print|printing|scanner|scan|fax)\b/,
      account: /\b(account|login|credentials|user|profile|reset|unlock)\b/,
    };

    // Use the ticket's category if available
    if (ticket.category_name) {
      const catLower = ticket.category_name.toLowerCase();
      for (const [key] of Object.entries(categoryMap)) {
        if (catLower.includes(key)) return key;
      }
    }

    // Otherwise detect from text
    for (const [category, pattern] of Object.entries(categoryMap)) {
      if (pattern.test(text)) return category;
    }

    return 'general';
  }

  /**
   * Extract keywords from ticket content
   */
  extractKeywords(ticket) {
    const text = `${ticket.subject || ''} ${ticket.description || ''} ${ticket.resolution_notes || ''}`.toLowerCase();

    const stopWords = new Set([
      'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'its',
      'they', 'them', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can',
      'could', 'should', 'may', 'might', 'shall', 'not', 'no', 'so', 'if', 'then',
      'than', 'that', 'this', 'those', 'these', 'what', 'which', 'who', 'when',
      'where', 'how', 'why', 'all', 'each', 'every', 'any', 'some', 'from',
      'up', 'down', 'out', 'off', 'over', 'under', 'again', 'just', 'about',
      'also', 'very', 'too', 'here', 'there', 'please', 'thank', 'thanks',
      'hi', 'hello', 'dear', 'sir', 'madam', 'team', 'need', 'help', 'get', 'got'
    ]);

    const words = text
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Get unique keywords, limited to 20
    return [...new Set(words)].slice(0, 20);
  }

  /**
   * Build question pattern from ticket subject and description
   */
  buildQuestionPattern(ticket) {
    let pattern = ticket.subject || '';
    if (ticket.description) {
      // Add first sentence of description
      const firstSentence = ticket.description.split(/[.!?\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        pattern += '. ' + firstSentence;
      }
    }
    return pattern.substring(0, 500);
  }

  /**
   * Clean resolution text for training
   */
  cleanResolutionText(text) {
    if (!text) return '';
    // Remove excessive whitespace, trim
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 2000);
  }

  /**
   * Search training data for matching patterns
   * Used by the bot to supplement local NLP answers
   */
  async searchTrainingData(query, limit = 3) {
    try {
      const keywords = this.extractKeywords({ subject: query, description: '', resolution_notes: '' });
      if (keywords.length === 0) return [];

      // Use up to 8 keywords for broader matching
      const usedKeywords = keywords.slice(0, 8);
      const keywordConditions = usedKeywords.map((kw, i) => {
        return `(td.keywords LIKE @kw${i} OR td.question_pattern LIKE @kw${i})`;
      });

      // Build a relevance score: count how many keywords match each row
      const scoreParts = usedKeywords.map((kw, i) => {
        return `CASE WHEN td.keywords LIKE @kw${i} OR td.question_pattern LIKE @kw${i} THEN 1 ELSE 0 END`;
      });

      const params = { limit };
      usedKeywords.forEach((kw, i) => {
        params[`kw${i}`] = `%${kw}%`;
      });

      // Fetch more candidates than needed, then rank by relevance
      const query_sql = `
        SELECT TOP (@limit * 3)
          td.training_id,
          td.source_ticket_number,
          td.category,
          td.question_pattern,
          td.resolution_text,
          td.confidence_score,
          td.usage_count,
          (${scoreParts.join(' + ')}) AS relevance_score
        FROM bot_training_data td
        WHERE td.is_active = 1
          AND (${keywordConditions.join(' OR ')})
        ORDER BY (${scoreParts.join(' + ')}) DESC, td.confidence_score DESC, td.usage_count DESC
      `;

      const result = await db.executeQuery(query_sql, params);
      const matches = (result.recordset || []).slice(0, limit);

      // Update usage count for matched entries
      if (matches.length > 0) {
        const ids = matches.map(m => m.training_id);
        await db.executeQuery(`
          UPDATE bot_training_data 
          SET usage_count = usage_count + 1, last_used_at = GETDATE()
          WHERE training_id IN (${ids.join(',')})
        `);
      }

      return matches;
    } catch (error) {
      logger.error('Error searching training data:', error);
      return [];
    }
  }

  /**
   * Get all training data with pagination
   */
  async getTrainingData(page = 1, pageSize = 20, filters = {}) {
    try {
      const offset = (page - 1) * pageSize;
      let whereClause = 'WHERE 1=1';
      const params = { offset, pageSize };

      if (filters.category) {
        whereClause += ' AND td.category = @category';
        params.category = filters.category;
      }
      if (filters.isActive !== undefined) {
        whereClause += ' AND td.is_active = @isActive';
        params.isActive = filters.isActive;
      }
      if (filters.search) {
        whereClause += ' AND (td.question_pattern LIKE @search OR td.resolution_text LIKE @search)';
        params.search = `%${filters.search}%`;
      }

      const countResult = await db.executeQuery(
        `SELECT COUNT(*) as total FROM bot_training_data td ${whereClause}`,
        params
      );

      const result = await db.executeQuery(`
        SELECT 
          td.training_id,
          td.source_ticket_id,
          td.source_ticket_number,
          td.category,
          td.keywords,
          td.question_pattern,
          td.resolution_text,
          td.confidence_score,
          td.usage_count,
          td.is_active,
          td.is_verified,
          td.trained_at,
          td.last_used_at
        FROM bot_training_data td
        ${whereClause}
        ORDER BY td.trained_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `, params);

      return {
        data: (result.recordset || []).map(r => ({
          ...r,
          keywords: r.keywords ? JSON.parse(r.keywords) : []
        })),
        total: countResult.recordset?.[0]?.total || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Error getting training data:', error);
      throw error;
    }
  }

  /**
   * Get training stats
   */
  async getTrainingStats() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          COUNT(*) as total_patterns,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_patterns,
          COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_patterns,
          SUM(usage_count) as total_usage,
          COUNT(DISTINCT category) as categories_covered,
          MAX(trained_at) as last_trained,
          AVG(confidence_score) as avg_confidence
        FROM bot_training_data
      `);

      const logResult = await db.executeQuery(`
        SELECT TOP 5
          log_id, scan_type, tickets_scanned, new_patterns_learned,
          patterns_updated, patterns_skipped, duration_ms, status,
          error_message, triggered_by, created_at
        FROM bot_training_log
        ORDER BY created_at DESC
      `);

      const categoryResult = await db.executeQuery(`
        SELECT category, COUNT(*) as count, SUM(usage_count) as total_usage
        FROM bot_training_data
        WHERE is_active = 1
        GROUP BY category
        ORDER BY count DESC
      `);

      return {
        stats: result.recordset?.[0] || {},
        recentLogs: logResult.recordset || [],
        categories: categoryResult.recordset || []
      };
    } catch (error) {
      logger.error('Error getting training stats:', error);
      throw error;
    }
  }

  /**
   * Toggle training data active/inactive
   */
  async toggleTrainingEntry(trainingId, isActive) {
    try {
      await db.executeQuery(`
        UPDATE bot_training_data 
        SET is_active = @isActive
        WHERE training_id = @trainingId
      `, { trainingId, isActive: isActive ? 1 : 0 });
      return { success: true };
    } catch (error) {
      logger.error('Error toggling training entry:', error);
      throw error;
    }
  }

  /**
   * Delete training entry
   */
  async deleteTrainingEntry(trainingId) {
    try {
      await db.executeQuery(
        `DELETE FROM bot_training_data WHERE training_id = @trainingId`,
        { trainingId }
      );
      return { success: true };
    } catch (error) {
      logger.error('Error deleting training entry:', error);
      throw error;
    }
  }

  /**
   * Log a training run
   */
  async logTrainingRun(data) {
    try {
      await db.executeQuery(`
        INSERT INTO bot_training_log 
        (scan_type, tickets_scanned, new_patterns_learned, patterns_updated,
         patterns_skipped, duration_ms, status, error_message, triggered_by)
        VALUES
        (@scanType, @ticketsScanned, @newPatternsLearned, @patternsUpdated,
         @patternsSkipped, @durationMs, @status, @errorMessage, @triggeredBy)
      `, {
        scanType: data.scanType || 'full_scan',
        ticketsScanned: data.ticketsScanned || 0,
        newPatternsLearned: data.newPatternsLearned || 0,
        patternsUpdated: data.patternsUpdated || 0,
        patternsSkipped: data.patternsSkipped || 0,
        durationMs: data.durationMs || 0,
        status: data.status || 'completed',
        errorMessage: data.errorMessage || null,
        triggeredBy: data.triggeredBy || 'system'
      });
    } catch (error) {
      logger.error('Error logging training run:', error);
    }
  }

  /**
   * Run comprehensive diagnostics on bot training system
   * Checks database state, ticket counts, and training configuration
   */
  async runDiagnostics() {
    try {
      const diagnostics = {};

      // 1. Check auto-training feature status
      const featureStatus = await this.isAutoTrainingEnabled();
      diagnostics.autoTrainingEnabled = featureStatus.enabled;
      diagnostics.configuration = featureStatus.config;

      // 2. Count total tickets in database
      const totalTicketsResult = await db.executeQuery(
        `SELECT COUNT(*) as count FROM tickets`
      );
      diagnostics.totalTicketsInDb = totalTicketsResult.recordset?.[0]?.count || 0;

      // 3. Count resolved tickets
      const resolvedTicketsResult = await db.executeQuery(`
        SELECT COUNT(*) as count 
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
      `);
      diagnostics.totalResolvedTickets = resolvedTicketsResult.recordset?.[0]?.count || 0;

      // 4. Count resolved tickets with resolution_notes
      const resolvedWithNotesResult = await db.executeQuery(`
        SELECT COUNT(*) as count 
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          AND t.resolution_notes IS NOT NULL
      `);
      diagnostics.resolvedTicketsWithNotes = resolvedWithNotesResult.recordset?.[0]?.count || 0;

      // 5. Count resolved tickets with sufficient resolution_notes (>= 20 chars)
      const minLen = featureStatus.config?.min_resolution_length || 20;
      const sufficinetLenResult = await db.executeQuery(`
        SELECT COUNT(*) as count 
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          AND t.resolution_notes IS NOT NULL
          AND LEN(t.resolution_notes) >= @minLen
      `, { minLen });
      diagnostics.resolvedTicketsWithSufficientNotes = sufficinetLenResult.recordset?.[0]?.count || 0;

      // 6. Count already-trained tickets
      const trainedTicketsResult = await db.executeQuery(`
        SELECT COUNT(*) as count FROM bot_training_data
      `);
      diagnostics.totalTrainedPatterns = trainedTicketsResult.recordset?.[0]?.count || 0;

      // 7. Count source tickets already in training data
      const sourceTicketsResult = await db.executeQuery(`
        SELECT COUNT(DISTINCT source_ticket_id) as count 
        FROM bot_training_data 
        WHERE source_ticket_id IS NOT NULL
      `);
      diagnostics.sourceTicketsInTraining = sourceTicketsResult.recordset?.[0]?.count || 0;

      // 8. Count tickets eligible for training (resolved, has notes, not yet trained)
      const eligibleResult = await db.executeQuery(`
        SELECT COUNT(*) as count 
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          AND t.resolution_notes IS NOT NULL
          AND LEN(t.resolution_notes) >= @minLen
          AND t.ticket_id NOT IN (SELECT source_ticket_id FROM bot_training_data WHERE source_ticket_id IS NOT NULL)
      `, { minLen });
      diagnostics.ticketsEligibleForTraining = eligibleResult.recordset?.[0]?.count || 0;

      // 9. Get sample of eligible tickets
      const sampleResult = await db.executeQuery(`
        SELECT TOP 3
          t.ticket_id,
          t.ticket_number,
          t.subject,
          SUBSTRING(t.resolution_notes, 1, 100) as resolution_notes_preview,
          LEN(t.resolution_notes) as notes_length
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          AND t.resolution_notes IS NOT NULL
          AND LEN(t.resolution_notes) >= @minLen
          AND t.ticket_id NOT IN (SELECT source_ticket_id FROM bot_training_data WHERE source_ticket_id IS NOT NULL)
        ORDER BY t.closed_at DESC
      `, { minLen });
      diagnostics.sampleEligibleTickets = sampleResult.recordset || [];

      // 10. Check bot_training_log recent entries
      const logsResult = await db.executeQuery(`
        SELECT TOP 5
          log_id, scan_type, tickets_scanned, new_patterns_learned,
          duration_ms, status, error_message, created_at
        FROM bot_training_log
        ORDER BY created_at DESC
      `);
      diagnostics.recentTrainingLogs = logsResult.recordset || [];

      return {
        success: true,
        diagnostics,
        summary: {
          isHealthy: diagnostics.ticketsEligibleForTraining > 0,
          recommendation: diagnostics.ticketsEligibleForTraining > 0 
            ? 'Training can proceed - eligible tickets found'
            : 'No eligible tickets found for training. Check: 1) Are there resolved tickets with resolution_notes? 2) Min resolution length requirement'
        }
      };
    } catch (error) {
      logger.error('Error running diagnostics:', error);
      return {
        success: false,
        error: error.message,
        diagnostics: null
      };
    }
  }
}

module.exports = new BotTrainingService();
