// ============================================
// BOT USER INTELLIGENCE SERVICE
// Remembers users across sessions: preferences,
// tone, common topics, frequently asked questions,
// and uses this data to personalize responses.
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

class BotUserIntelligenceService {

  /**
   * Get or create a user profile for the bot
   */
  async getUserProfile(userId) {
    try {
      // Ensure table exists
      await this._ensureTable();

      const query = `
        SELECT * FROM bot_user_profiles WHERE user_id = @userId
      `;
      const result = await executeQuery(query, { userId });

      if (result.recordset.length > 0) {
        const profile = result.recordset[0];
        profile.preferences = this._safeJsonParse(profile.preferences, {});
        profile.common_topics = this._safeJsonParse(profile.common_topics, []);
        profile.tone_analysis = this._safeJsonParse(profile.tone_analysis, {});
        profile.frequent_issues = this._safeJsonParse(profile.frequent_issues, []);
        return profile;
      }

      // Create new profile
      const insertQuery = `
        INSERT INTO bot_user_profiles (user_id, preferences, common_topics, tone_analysis, frequent_issues, total_interactions, last_interaction_at)
        VALUES (@userId, '{}', '[]', '{}', '[]', 0, GETDATE())
      `;
      await executeQuery(insertQuery, { userId });

      return {
        user_id: userId,
        preferences: {},
        common_topics: [],
        tone_analysis: {},
        frequent_issues: [],
        total_interactions: 0,
        last_interaction_at: new Date()
      };
    } catch (err) {
      logger.warn('getUserProfile failed:', err.message);
      return {
        user_id: userId,
        preferences: {},
        common_topics: [],
        tone_analysis: {},
        frequent_issues: [],
        total_interactions: 0
      };
    }
  }

  /**
   * Update user profile after each interaction
   */
  async recordInteraction(userId, message, intent, confidence, category) {
    try {
      await this._ensureTable();

      const profile = await this.getUserProfile(userId);
      
      // Update common topics
      const topics = profile.common_topics || [];
      const existingTopic = topics.find(t => t.category === category);
      if (existingTopic) {
        existingTopic.count = (existingTopic.count || 0) + 1;
        existingTopic.last_asked = new Date().toISOString();
      } else if (category && category !== 'general' && category !== 'error') {
        topics.push({ category, count: 1, last_asked: new Date().toISOString() });
      }
      // Keep top 20 topics
      topics.sort((a, b) => (b.count || 0) - (a.count || 0));
      const trimmedTopics = topics.slice(0, 20);

      // Analyze tone
      const tone = this._analyzeTone(message);
      const toneAnalysis = profile.tone_analysis || {};
      toneAnalysis.last_tone = tone;
      toneAnalysis[tone] = (toneAnalysis[tone] || 0) + 1;
      toneAnalysis.total_analyzed = (toneAnalysis.total_analyzed || 0) + 1;

      // Track frequent issues (intents)
      const issues = profile.frequent_issues || [];
      const existingIssue = issues.find(i => i.intent === intent);
      if (existingIssue) {
        existingIssue.count = (existingIssue.count || 0) + 1;
        existingIssue.last_asked = new Date().toISOString();
      } else if (intent) {
        issues.push({ intent, count: 1, last_asked: new Date().toISOString() });
      }
      issues.sort((a, b) => (b.count || 0) - (a.count || 0));
      const trimmedIssues = issues.slice(0, 20);

      const updateQuery = `
        UPDATE bot_user_profiles 
        SET common_topics = @topics,
            tone_analysis = @tone,
            frequent_issues = @issues,
            total_interactions = total_interactions + 1,
            last_interaction_at = GETDATE()
        WHERE user_id = @userId
      `;

      await executeQuery(updateQuery, {
        userId,
        topics: JSON.stringify(trimmedTopics),
        tone: JSON.stringify(toneAnalysis),
        issues: JSON.stringify(trimmedIssues),
      });

    } catch (err) {
      logger.warn('recordInteraction failed:', err.message);
    }
  }

  /**
   * Get personalized context string for external AI providers
   */
  async getPersonalizationContext(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      const ticketMemory = await this.getUserTicketMemory(userId);
      if ((!profile || profile.total_interactions === 0) && !ticketMemory) return '';

      const parts = [];

      if (profile && profile.total_interactions > 0) {
        const topTopics = (profile.common_topics || []).slice(0, 5);
        if (topTopics.length > 0) {
          parts.push(`User frequently asks about: ${topTopics.map(t => t.category).join(', ')}.`);
        }

        const toneData = profile.tone_analysis || {};
        const dominantTone = this._getDominantTone(toneData);
        if (dominantTone) {
          parts.push(`User typically communicates in a ${dominantTone} tone. Match their communication style.`);
        }

        const topIssues = (profile.frequent_issues || []).slice(0, 3);
        if (topIssues.length > 0) {
          parts.push(`Common issues: ${topIssues.map(i => i.intent).join(', ')}.`);
        }

        if (profile.total_interactions > 10) {
          parts.push(`Returning user with ${profile.total_interactions} previous interactions.`);
        }
      }

      if (ticketMemory) {
        if (ticketMemory.summary.totalTickets > 0) {
          parts.push(`User ticket history: ${ticketMemory.summary.totalTickets} total tickets, ${ticketMemory.summary.openTickets} open, ${ticketMemory.summary.pendingTickets} pending customer response, ${ticketMemory.summary.closedTickets} closed.`);
        }

        if (ticketMemory.topCategories.length > 0) {
          parts.push(`Recurring support categories: ${ticketMemory.topCategories.map((item) => item.category_name).join(', ')}.`);
        }

        if (ticketMemory.recentOpenTickets.length > 0) {
          const recent = ticketMemory.recentOpenTickets
            .map((ticket) => `${ticket.ticket_number}: ${ticket.subject} (${ticket.status_name || 'Open'})`)
            .join('; ');
          parts.push(`Current unresolved tickets: ${recent}.`);
        }
      }

      return parts.length > 0 ? `\n\nUser Context: ${parts.join(' ')}` : '';
    } catch (err) {
      return '';
    }
  }

  async getUserTicketMemory(userId) {
    try {
      const summaryResult = await executeQuery(`
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
          SUM(CASE WHEN UPPER(ISNULL(ts.status_code, '')) = 'PENDING' THEN 1 ELSE 0 END) AS pending_tickets,
          SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE t.requester_id = @userId
      `, { userId });

      const recentOpenTicketsResult = await executeQuery(`
        SELECT TOP 3
          t.ticket_number,
          t.subject,
          ts.status_name,
          tc.category_name
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
        WHERE t.requester_id = @userId
          AND ISNULL(ts.is_final_status, 0) = 0
        ORDER BY ISNULL(t.updated_at, t.created_at) DESC, t.ticket_id DESC
      `, { userId });

      const topCategoriesResult = await executeQuery(`
        SELECT TOP 3
          COALESCE(tc.category_name, 'General') AS category_name,
          COUNT(*) AS total
        FROM tickets t
        LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
        WHERE t.requester_id = @userId
        GROUP BY COALESCE(tc.category_name, 'General')
        ORDER BY COUNT(*) DESC, COALESCE(tc.category_name, 'General') ASC
      `, { userId });

      const summary = summaryResult.recordset?.[0] || {};
      const totalTickets = Number(summary.total_tickets || 0);

      if (totalTickets === 0) {
        return null;
      }

      return {
        summary: {
          totalTickets,
          openTickets: Number(summary.open_tickets || 0),
          pendingTickets: Number(summary.pending_tickets || 0),
          closedTickets: Number(summary.closed_tickets || 0),
        },
        recentOpenTickets: recentOpenTicketsResult.recordset || [],
        topCategories: topCategoriesResult.recordset || [],
      };
    } catch (err) {
      logger.warn('getUserTicketMemory failed:', err.message);
      return null;
    }
  }

  /**
   * Simple tone classifier
   */
  _analyzeTone(message) {
    const lower = (message || '').toLowerCase();
    
    // Frustrated/angry
    if (/(!{2,}|still\s+not|not\s+working|broken|useless|terrible|worst|hate|angry|frustrated|urgently|asap|!!)/i.test(lower)) {
      return 'frustrated';
    }
    // Formal
    if (/\b(dear|kindly|request|please\s+assist|would\s+you|could\s+you|regarding|with\s+respect)\b/i.test(lower)) {
      return 'formal';
    }
    // Casual
    if (/\b(hey|hi|yo|sup|gonna|wanna|lol|haha|thanks|thx|btw|fyi|pls)\b/i.test(lower)) {
      return 'casual';
    }
    // Urgent
    if (/\b(urgent|emergency|critical|immediately|asap|right\s+now|blocking|blocked|p1|production\s+down)\b/i.test(lower)) {
      return 'urgent';
    }
    return 'neutral';
  }

  _getDominantTone(toneData) {
    const tones = ['frustrated', 'formal', 'casual', 'urgent', 'neutral'];
    let max = 0;
    let dominant = null;
    for (const t of tones) {
      if ((toneData[t] || 0) > max) {
        max = toneData[t];
        dominant = t;
      }
    }
    return dominant;
  }

  /**
   * Ensure the user profiles table exists
   */
  async _ensureTable() {
    if (this._tableChecked) return;
    try {
      await executeQuery(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bot_user_profiles')
        BEGIN
          CREATE TABLE bot_user_profiles (
            user_id INT PRIMARY KEY,
            preferences NVARCHAR(MAX) DEFAULT '{}',
            common_topics NVARCHAR(MAX) DEFAULT '[]',
            tone_analysis NVARCHAR(MAX) DEFAULT '{}',
            frequent_issues NVARCHAR(MAX) DEFAULT '[]',
            total_interactions INT DEFAULT 0,
            last_interaction_at DATETIME DEFAULT GETDATE(),
            created_at DATETIME DEFAULT GETDATE()
          )
        END
      `);
      this._tableChecked = true;
    } catch (err) {
      logger.warn('bot_user_profiles table check failed:', err.message);
      this._tableChecked = true; // don't retry endlessly
    }
  }

  _safeJsonParse(str, fallback) {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return fallback; }
  }
}

module.exports = new BotUserIntelligenceService();
