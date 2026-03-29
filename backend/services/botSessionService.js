// ============================================
// BOT SESSION SERVICE
// Manages chat session lifecycle, message persistence,
// and dashboard statistics from real DB data
// Created: March 2026
// ============================================

const db = require('../config/database');
const logger = require('../utils/logger');

class BotSessionService {

  // ============================================
  // SESSION LIFECYCLE
  // ============================================

  /**
   * Start or resume a chat session
   * @param {Object} params - { sessionId, userId, userName, userRole, ipAddress, userAgent }
   * @returns {Object} session record
   */
  async startSession({ sessionId, userId, userName, userRole, ipAddress, userAgent }) {
    try {
      // Check if session already exists and is active
      const existing = await db.executeQuery(`
        SELECT id, session_id, is_active, total_messages
        FROM bot_chat_sessions
        WHERE session_id = @sessionId AND user_id = @userId
      `, { sessionId, userId });

      if (existing.recordset && existing.recordset.length > 0) {
        const session = existing.recordset[0];
        if (session.is_active) {
          return session; // Session already active
        }
        // Reactivate ended session
        await db.executeQuery(`
          UPDATE bot_chat_sessions
          SET is_active = 1, updated_at = GETDATE()
          WHERE id = @id
        `, { id: session.id });
        return { ...session, is_active: true };
      }

      // Create new session
      const result = await db.executeQuery(`
        INSERT INTO bot_chat_sessions 
          (session_id, user_id, user_name, user_role, ip_address, user_agent)
        VALUES 
          (@sessionId, @userId, @userName, @userRole, @ipAddress, @userAgent);
        
        SELECT id, session_id, user_id, user_name, user_role, started_at, is_active
        FROM bot_chat_sessions
        WHERE id = SCOPE_IDENTITY();
      `, {
        sessionId,
        userId,
        userName: userName || 'Unknown',
        userRole: userRole || 'User',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      });

      const newSession = result.recordset?.[0];
      logger.info('Bot session started', { sessionId, userId, userName });
      return newSession;
    } catch (error) {
      logger.error('Error starting bot session:', error);
      throw error;
    }
  }

  /**
   * End a chat session and generate summary
   * @param {string} sessionId 
   * @param {number} userId 
   */
  async endSession(sessionId, userId) {
    try {
      // Generate summary from messages
      const messages = await this.getSessionMessages(sessionId);
      const summary = this._generateSessionSummary(messages);
      const categories = this._extractCategories(messages);
      const actions = this._extractActions(messages);

      // Calculate averages
      const botMessages = messages.filter(m => m.message_type === 'bot');
      const avgConfidence = botMessages.length > 0
        ? botMessages.reduce((sum, m) => sum + (m.confidence || 0), 0) / botMessages.length
        : 0;
      const avgResponseTime = botMessages.length > 0
        ? botMessages.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / botMessages.length
        : 0;

      await db.executeQuery(`
        UPDATE bot_chat_sessions
        SET 
          is_active = 0,
          ended_at = GETDATE(),
          summary = @summary,
          categories_used = @categories,
          actions_performed = @actions,
          avg_confidence = @avgConfidence,
          avg_response_time_ms = @avgResponseTime,
          updated_at = GETDATE()
        WHERE session_id = @sessionId AND user_id = @userId
      `, {
        sessionId,
        userId,
        summary,
        categories: JSON.stringify(categories),
        actions: JSON.stringify(actions),
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime)
      });

      logger.info('Bot session ended', { sessionId, userId, messageCount: messages.length });
      return { success: true, summary, categories, actions };
    } catch (error) {
      logger.error('Error ending bot session:', error);
      throw error;
    }
  }

  // ============================================
  // MESSAGE PERSISTENCE
  // ============================================

  /**
   * Record a user message
   * @param {Object} params
   */
  async recordUserMessage({ sessionId, userId, messageContent }) {
    try {
      await db.executeQuery(`
        INSERT INTO bot_chat_messages 
          (session_id, user_id, message_type, message_content)
        VALUES 
          (@sessionId, @userId, 'user', @messageContent);

        UPDATE bot_chat_sessions
        SET total_messages = total_messages + 1,
            user_messages = user_messages + 1,
            updated_at = GETDATE()
        WHERE session_id = @sessionId AND user_id = @userId;
      `, { sessionId, userId, messageContent });

      return { success: true };
    } catch (error) {
      logger.error('Error recording user message:', error);
      // Don't throw - message recording should not break chat flow
      return { success: false, error: error.message };
    }
  }

  /**
   * Record a bot response message with all metadata
   * @param {Object} params
   */
  async recordBotMessage({
    sessionId, userId, messageContent,
    intentMatched, category, confidence,
    aiEnhanced, aiProvider, responseTimeMs,
    followUpOptions, actionType, actionData
  }) {
    try {
      await db.executeQuery(`
        INSERT INTO bot_chat_messages 
          (session_id, user_id, message_type, message_content,
           intent_matched, category, confidence,
           ai_enhanced, ai_provider, response_time_ms,
           follow_up_options, action_type, action_data)
        VALUES 
          (@sessionId, @userId, 'bot', @messageContent,
           @intentMatched, @category, @confidence,
           @aiEnhanced, @aiProvider, @responseTimeMs,
           @followUpOptions, @actionType, @actionData);

        UPDATE bot_chat_sessions
        SET total_messages = total_messages + 1,
            bot_messages = bot_messages + 1,
            intents_matched = intents_matched + CASE WHEN @intentMatched IS NOT NULL THEN 1 ELSE 0 END,
            ai_enhanced_count = ai_enhanced_count + CASE WHEN @aiEnhanced = 1 THEN 1 ELSE 0 END,
            tickets_created = tickets_created + CASE WHEN @actionType = 'ticket_created' THEN 1 ELSE 0 END,
            passwords_changed = passwords_changed + CASE WHEN @actionType = 'password_changed' THEN 1 ELSE 0 END,
            updated_at = GETDATE()
        WHERE session_id = @sessionId AND user_id = @userId;
      `, {
        sessionId,
        userId,
        messageContent: messageContent || '',
        intentMatched: intentMatched || null,
        category: category || null,
        confidence: confidence || null,
        aiEnhanced: aiEnhanced ? 1 : 0,
        aiProvider: aiProvider || null,
        responseTimeMs: responseTimeMs || 0,
        followUpOptions: followUpOptions ? JSON.stringify(followUpOptions) : null,
        actionType: actionType || null,
        actionData: actionData ? JSON.stringify(actionData) : null
      });

      return { success: true };
    } catch (error) {
      logger.error('Error recording bot message:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // SESSION QUERIES
  // ============================================

  /**
   * List all sessions with pagination and filters
   * @param {Object} options - { page, limit, userId, dateFrom, dateTo, isActive, search }
   */
  async listSessions({ page = 1, limit = 20, userId, dateFrom, dateTo, isActive, search } = {}) {
    try {
      let whereClause = '1=1';
      const params = {};

      if (userId) {
        whereClause += ' AND s.user_id = @userId';
        params.userId = userId;
      }
      if (dateFrom) {
        whereClause += ' AND s.started_at >= @dateFrom';
        params.dateFrom = dateFrom;
      }
      if (dateTo) {
        whereClause += ' AND s.started_at <= @dateTo';
        params.dateTo = dateTo;
      }
      if (isActive !== undefined && isActive !== null && isActive !== '') {
        whereClause += ' AND s.is_active = @isActive';
        params.isActive = isActive === true || isActive === 'true' || isActive === 1 ? 1 : 0;
      }
      if (search) {
        whereClause += ' AND (s.user_name LIKE @search OR s.summary LIKE @search OR s.session_id LIKE @search)';
        params.search = `%${search}%`;
      }

      const offset = (page - 1) * limit;
      params.offset = offset;
      params.limit = limit;

      // Get total count
      const countResult = await db.executeQuery(`
        SELECT COUNT(*) AS total
        FROM bot_chat_sessions s
        WHERE ${whereClause}
      `, params);
      const total = countResult.recordset?.[0]?.total || 0;

      // Get paginated results
      const result = await db.executeQuery(`
        SELECT 
          s.id,
          s.session_id,
          s.user_id,
          s.user_name,
          s.user_role,
          s.started_at,
          s.ended_at,
          s.is_active,
          s.total_messages,
          s.user_messages,
          s.bot_messages,
          s.intents_matched,
          s.ai_enhanced_count,
          s.tickets_created,
          s.passwords_changed,
          s.avg_confidence,
          s.avg_response_time_ms,
          s.summary,
          s.categories_used,
          s.actions_performed
        FROM bot_chat_sessions s
        WHERE ${whereClause}
        ORDER BY s.started_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `, params);

      const sessions = (result.recordset || []).map(s => ({
        ...s,
        categories_used: s.categories_used ? JSON.parse(s.categories_used) : [],
        actions_performed: s.actions_performed ? JSON.parse(s.actions_performed) : [],
        duration: s.ended_at 
          ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 1000) 
          : Math.round((new Date() - new Date(s.started_at)) / 1000)
      }));

      return {
        sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error listing sessions:', error);
      throw error;
    }
  }

  /**
   * Get a single session by session_id
   */
  async getSessionById(sessionId) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          s.*
        FROM bot_chat_sessions s
        WHERE s.session_id = @sessionId
      `, { sessionId });

      const session = result.recordset?.[0];
      if (!session) return null;

      return {
        ...session,
        categories_used: session.categories_used ? JSON.parse(session.categories_used) : [],
        actions_performed: session.actions_performed ? JSON.parse(session.actions_performed) : [],
        duration: session.ended_at 
          ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 1000) 
          : Math.round((new Date() - new Date(session.started_at)) / 1000)
      };
    } catch (error) {
      logger.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Get all messages for a session
   */
  async getSessionMessages(sessionId) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          id, session_id, user_id, message_type, message_content,
          intent_matched, category, confidence,
          ai_enhanced, ai_provider, response_time_ms,
          follow_up_options, action_type, action_data,
          created_at
        FROM bot_chat_messages
        WHERE session_id = @sessionId
        ORDER BY created_at ASC, id ASC
      `, { sessionId });

      return (result.recordset || []).map(m => ({
        ...m,
        follow_up_options: m.follow_up_options ? JSON.parse(m.follow_up_options) : [],
        action_data: m.action_data ? JSON.parse(m.action_data) : null
      }));
    } catch (error) {
      logger.error('Error getting session messages:', error);
      throw error;
    }
  }

  /**
   * Get full session detail with messages
   */
  async getSessionDetail(sessionId) {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) return null;

      const messages = await this.getSessionMessages(sessionId);

      return {
        session,
        messages,
        messageCount: messages.length,
        userMessages: messages.filter(m => m.message_type === 'user').length,
        botMessages: messages.filter(m => m.message_type === 'bot').length
      };
    } catch (error) {
      logger.error('Error getting session detail:', error);
      throw error;
    }
  }

  // ============================================
  // DASHBOARD STATISTICS
  // ============================================

  /**
   * Get comprehensive dashboard stats from the view
   */
  async getDashboardStats() {
    try {
      const result = await db.executeQuery(`SELECT * FROM v_bot_dashboard_stats`);
      const stats = result.recordset?.[0] || {};

      // Parse JSON fields
      if (stats.top_intents_json) {
        try { stats.top_intents = JSON.parse(stats.top_intents_json); } 
        catch { stats.top_intents = []; }
      } else {
        stats.top_intents = [];
      }
      
      if (stats.top_categories_json) {
        try { stats.top_categories = JSON.parse(stats.top_categories_json); } 
        catch { stats.top_categories = []; }
      } else {
        stats.top_categories = [];
      }

      // Clean up raw JSON fields
      delete stats.top_intents_json;
      delete stats.top_categories_json;

      return stats;
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get session stats for a specific user
   */
  async getUserSessionStats(userId) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          COUNT(*) AS total_sessions,
          SUM(total_messages) AS total_messages,
          SUM(user_messages) AS total_user_messages,
          SUM(bot_messages) AS total_bot_messages,
          SUM(tickets_created) AS total_tickets_created,
          SUM(passwords_changed) AS total_passwords_changed,
          AVG(avg_confidence) AS avg_confidence,
          MIN(started_at) AS first_session,
          MAX(started_at) AS last_session
        FROM bot_chat_sessions
        WHERE user_id = @userId
      `, { userId });

      return result.recordset?.[0] || {};
    } catch (error) {
      logger.error('Error getting user session stats:', error);
      throw error;
    }
  }

  // ============================================
  // EXPORT & DOWNLOAD
  // ============================================

  /**
   * Export a session as a structured JSON object
   */
  async exportSession(sessionId) {
    try {
      const detail = await this.getSessionDetail(sessionId);
      if (!detail) return null;

      return {
        exportedAt: new Date().toISOString(),
        session: {
          id: detail.session.session_id,
          user: detail.session.user_name,
          role: detail.session.user_role,
          startedAt: detail.session.started_at,
          endedAt: detail.session.ended_at,
          duration: detail.session.duration,
          isActive: detail.session.is_active,
          summary: detail.session.summary,
          stats: {
            totalMessages: detail.session.total_messages,
            userMessages: detail.session.user_messages,
            botMessages: detail.session.bot_messages,
            intentsMatched: detail.session.intents_matched,
            aiEnhancedCount: detail.session.ai_enhanced_count,
            ticketsCreated: detail.session.tickets_created,
            passwordsChanged: detail.session.passwords_changed,
            avgConfidence: detail.session.avg_confidence,
            avgResponseTimeMs: detail.session.avg_response_time_ms
          },
          categoriesUsed: detail.session.categories_used,
          actionsPerformed: detail.session.actions_performed
        },
        messages: detail.messages.map(m => ({
          type: m.message_type,
          content: m.message_content,
          timestamp: m.created_at,
          ...(m.message_type === 'bot' && {
            intent: m.intent_matched,
            category: m.category,
            confidence: m.confidence,
            aiEnhanced: m.ai_enhanced,
            aiProvider: m.ai_provider,
            responseTimeMs: m.response_time_ms,
            followUp: m.follow_up_options,
            action: m.action_type ? {
              type: m.action_type,
              data: m.action_data
            } : null
          })
        }))
      };
    } catch (error) {
      logger.error('Error exporting session:', error);
      throw error;
    }
  }

  /**
   * Export session as CSV text
   */
  async exportSessionCSV(sessionId) {
    try {
      const detail = await this.getSessionDetail(sessionId);
      if (!detail) return null;

      const headers = 'Timestamp,Type,Content,Intent,Category,Confidence,AI Enhanced,AI Provider,Response Time (ms),Action';
      const rows = detail.messages.map(m => {
        const timestamp = new Date(m.created_at).toLocaleString();
        const content = `"${(m.message_content || '').replace(/"/g, '""')}"`;
        const intent = m.intent_matched || '';
        const category = m.category || '';
        const confidence = m.confidence || '';
        const aiEnhanced = m.ai_enhanced ? 'Yes' : 'No';
        const aiProvider = m.ai_provider || '';
        const responseTime = m.response_time_ms || '';
        const action = m.action_type || '';
        return `${timestamp},${m.message_type},${content},${intent},${category},${confidence},${aiEnhanced},${aiProvider},${responseTime},${action}`;
      });

      return `${headers}\n${rows.join('\n')}`;
    } catch (error) {
      logger.error('Error exporting session CSV:', error);
      throw error;
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Auto-close inactive sessions (older than specified hours)
   */
  async closeInactiveSessions(hoursThreshold = 2) {
    try {
      const result = await db.executeQuery(`
        UPDATE bot_chat_sessions
        SET is_active = 0,
            ended_at = GETDATE(),
            updated_at = GETDATE()
        WHERE is_active = 1
          AND updated_at < DATEADD(HOUR, -@hours, GETDATE())
      `, { hours: hoursThreshold });

      const closedCount = result.rowsAffected?.[0] || 0;
      if (closedCount > 0) {
        logger.info(`Auto-closed ${closedCount} inactive bot sessions`);
      }
      return { closedCount };
    } catch (error) {
      logger.error('Error closing inactive sessions:', error);
      throw error;
    }
  }

  /**
   * Delete sessions older than specified days
   */
  async purgeOldSessions(daysThreshold = 90) {
    try {
      // First delete messages
      await db.executeQuery(`
        DELETE FROM bot_chat_messages
        WHERE session_id IN (
          SELECT session_id FROM bot_chat_sessions
          WHERE started_at < DATEADD(DAY, -@days, GETDATE())
        )
      `, { days: daysThreshold });

      // Then delete sessions
      const result = await db.executeQuery(`
        DELETE FROM bot_chat_sessions
        WHERE started_at < DATEADD(DAY, -@days, GETDATE())
      `, { days: daysThreshold });

      const purgedCount = result.rowsAffected?.[0] || 0;
      logger.info(`Purged ${purgedCount} bot sessions older than ${daysThreshold} days`);
      return { purgedCount };
    } catch (error) {
      logger.error('Error purging old sessions:', error);
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Generate a human-readable summary from session messages
   */
  _generateSessionSummary(messages) {
    if (!messages || messages.length === 0) return 'Empty session';

    const userMessages = messages.filter(m => m.message_type === 'user');
    const botMessages = messages.filter(m => m.message_type === 'bot');
    const actions = messages.filter(m => m.action_type);
    const intents = [...new Set(botMessages.map(m => m.intent_matched).filter(Boolean))];
    const categories = [...new Set(botMessages.map(m => m.category).filter(Boolean))];

    let summary = `Session with ${userMessages.length} user message(s) and ${botMessages.length} bot response(s).`;

    if (intents.length > 0) {
      summary += ` Intents: ${intents.join(', ')}.`;
    }
    if (categories.length > 0) {
      summary += ` Categories: ${categories.join(', ')}.`;
    }
    if (actions.length > 0) {
      const actionTypes = [...new Set(actions.map(a => a.action_type))];
      summary += ` Actions performed: ${actionTypes.join(', ')}.`;
    }

    // Add first user question as context
    if (userMessages.length > 0) {
      const firstQ = userMessages[0].message_content;
      const truncated = firstQ.length > 100 ? firstQ.substring(0, 100) + '...' : firstQ;
      summary += ` Started with: "${truncated}"`;
    }

    return summary;
  }

  /**
   * Extract unique categories from messages
   */
  _extractCategories(messages) {
    return [...new Set(
      messages
        .filter(m => m.category)
        .map(m => m.category)
    )];
  }

  /**
   * Extract actions from messages  
   */
  _extractActions(messages) {
    return messages
      .filter(m => m.action_type)
      .map(m => ({
        type: m.action_type,
        data: m.action_data,
        timestamp: m.created_at
      }));
  }
}

module.exports = new BotSessionService();
