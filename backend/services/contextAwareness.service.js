const db = require('../config/database');
const logger = require('../utils/logger');

class ContextAwarenessService {
  /**
   * Initialize a new conversation session
   * @param {number} userId - User ID
   * @param {string} sessionId - Unique session ID
   * @returns {Promise<Object>} Created context
   */
  async initializeConversation(userId, sessionId) {
    try {
      const query = `
        INSERT INTO bot_conversation_context 
        (session_id, user_id, conversation_state, created_at, updated_at, expires_at)
        VALUES (@sessionId, @userId, @conversationState, GETDATE(), GETDATE(), DATEADD(HOUR, 24, GETDATE()))
      `;

      const initialState = JSON.stringify({
        user_id: userId,
        started_at: new Date(),
        intent_history: [],
        step_count: 0,
        draft_data: {}
      });

      await db.executeQuery(query, { sessionId, userId, conversationState: initialState });
      
      logger.info(`Initialized conversation session ${sessionId} for user ${userId}`);
      
      return {
        session_id: sessionId,
        user_id: userId,
        initialized: true
      };
    } catch (error) {
      logger.error(`Error initializing conversation:`, error);
      throw error;
    }
  }

  /**
   * Update context with new data
   * @param {string} sessionId - Session ID
   * @param {string} key - Key to update
   * @param {*} value - Value to set
   * @returns {Promise<Boolean>} Success
   */
  async updateContext(sessionId, key, value) {
    try {
      // Get current context
      const selectQuery = `SELECT conversation_state FROM bot_conversation_context WHERE session_id = @sessionId`;
      const result = await db.executeQuery(selectQuery, { sessionId });
      const rows = result.recordset || [];

      if (!rows.length) {
        throw new Error(`Session ${sessionId} not found`);
      }

      let state = {};
      try {
        state = JSON.parse(rows[0].conversation_state || '{}');
      } catch (e) {
        state = {};
      }

      // Update context
      state[key] = value;
      if (key === 'last_intent') {
        if (!state.intent_history) state.intent_history = [];
        state.intent_history.push({ intent: value, timestamp: new Date() });
      }

      const updateQuery = `
        UPDATE bot_conversation_context 
        SET conversation_state = @conversationState, updated_at = GETDATE()
        WHERE session_id = @sessionId
      `;

      await db.executeQuery(updateQuery, { conversationState: JSON.stringify(state), sessionId });
      
      logger.info(`Updated context for session ${sessionId}, key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Error updating context:`, error);
      throw error;
    }
  }

  /**
   * Get context value
   * @param {string} sessionId - Session ID
   * @param {string} key - Key to retrieve
   * @returns {Promise<*>} Value (or null if not found)
   */
  async getContext(sessionId, key = null) {
    try {
      const query = `SELECT conversation_state, user_id FROM bot_conversation_context WHERE session_id = @sessionId`;
      const result = await db.executeQuery(query, { sessionId });
      const rows = result.recordset || [];

      if (!rows.length) {
        return null;
      }

      let state = {};
      try {
        state = JSON.parse(rows[0].conversation_state || '{}');
      } catch (e) {
        state = {};
      }

      state.user_id = rows[0].user_id;

      if (key) {
        return state[key] || null;
      }

      logger.info(`Retrieved context for session ${sessionId}`);
      return state;
    } catch (error) {
      logger.error(`Error getting context:`, error);
      throw error;
    }
  }

  /**
   * Track conversation flow
   * @param {string} sessionId - Session ID
   * @param {string} intent - Intent matched
   * @param {object} result - Intent execution result
   * @returns {Promise<Boolean>} Success
   */
  async trackConversationFlow(sessionId, intent, result) {
    try {
      const context = await this.getContext(sessionId);
      
      if (!context.conversation_flow) {
        context.conversation_flow = [];
      }

      context.conversation_flow.push({
        intent: intent,
        success: result.success,
        timestamp: new Date(),
        response_type: result.type || 'info'
      });

      await this.updateContext(sessionId, 'conversation_flow', context.conversation_flow);
      
      logger.info(`Tracked conversation flow for session ${sessionId}, intent: ${intent}`);
      return true;
    } catch (error) {
      logger.error(`Error tracking conversation flow:`, error);
      throw error;
    }
  }

  /**
   * Persist conversation history
   * @param {number} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {array} messages - Array of {type: 'user'|'bot', content: string, intent?: string}
   * @returns {Promise<Boolean>} Success
   */
  async persistConversationHistory(userId, sessionId, messages) {
    try {
      for (const msg of messages) {
        const query = `
          INSERT INTO bot_conversation_history 
          (user_id, session_id, message_type, message_content, intent_matched, confidence, created_at)
          VALUES (@userId, @sessionId, @messageType, @messageContent, @intentMatched, @confidence, GETDATE())
        `;
        await db.executeQuery(query, {
          userId,
          sessionId,
          messageType: msg.type || msg.role || 'user',
          messageContent: msg.content || msg.message || '',
          intentMatched: msg.intent || null,
          confidence: msg.confidence || 1.0,
        });
      }

      logger.info(`Persisted ${messages.length} messages for user ${userId}, session ${sessionId}`);
      return true;
    } catch (error) {
      logger.error(`Error persisting conversation history:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum messages to return
   * @returns {Promise<Array>} Messages
   */
  async getConversationHistory(sessionId, limit = 50) {
    try {
      const query = `
        SELECT TOP (@limit)
          history_id, user_id, message_type, message_content, intent_matched, confidence, created_at
        FROM bot_conversation_history 
        WHERE session_id = @sessionId
        ORDER BY created_at DESC
      `;

      const result = await db.executeQuery(query, { limit, sessionId });
      const rows = result.recordset || [];

      logger.info(`Retrieved ${rows.length} messages from conversation history`);
      return rows.reverse();
    } catch (error) {
      logger.error(`Error getting conversation history:`, error);
      throw error;
    }
  }

  /**
   * Clear expired sessions
   * @returns {Promise<number>} Number of sessions cleared
   */
  async clearExpiredSessions() {
    try {
      const query = `
        DELETE FROM bot_conversation_context 
        WHERE expires_at < GETDATE()
      `;

      const result = await db.executeQuery(query);
      
      logger.info(`Cleared expired conversation sessions`);
      return result.rowsAffected?.[0] || 0;
    } catch (error) {
      logger.error(`Error clearing expired sessions:`, error);
      throw error;
    }
  }

  /**
   * Clear specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Boolean>} Success
   */
  async clearSession(sessionId) {
    try {
      const query = `DELETE FROM bot_conversation_context WHERE session_id = @sessionId`;
      await db.executeQuery(query, { sessionId });
      
      logger.info(`Cleared session ${sessionId}`);
      return true;
    } catch (error) {
      logger.error(`Error clearing session:`, error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  async getActiveSessions(userId) {
    try {
      const query = `
        SELECT session_id, conversation_state, created_at, updated_at
        FROM bot_conversation_context 
        WHERE user_id = @userId AND expires_at > GETDATE()
        ORDER BY updated_at DESC
      `;

      const result = await db.executeQuery(query, { userId });
      const rows = result.recordset || [];

      logger.info(`Retrieved ${rows.length} active sessions for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(`Error getting active sessions:`, error);
      throw error;
    }
  }

  /**
   * Get session statistics
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Statistics
   */
  async getSessionStats(sessionId) {
    try {
      const contextQuery = `
        SELECT conversation_state, created_at, updated_at 
        FROM bot_conversation_context 
        WHERE session_id = @sessionId
      `;
      
      const messageCountQuery = `
        SELECT COUNT(*) as message_count FROM bot_conversation_history WHERE session_id = @sessionId
      `;

      const contextResult = await db.executeQuery(contextQuery, { sessionId });
      const countResult = await db.executeQuery(messageCountQuery, { sessionId });
      const contextRows = contextResult.recordset || [];
      const countRows = countResult.recordset || [];

      if (!contextRows.length) {
        return null;
      }

      const context = JSON.parse(contextRows[0].conversation_state || '{}');
      const created = new Date(contextRows[0].created_at);
      const updated = new Date(contextRows[0].updated_at);
      const duration = (updated - created) / 1000; // seconds

      return {
        session_id: sessionId,
        message_count: countRows[0]?.message_count || 0,
        intent_count: context.intent_history?.length || 0,
        duration_seconds: Math.round(duration),
        created_at: created,
        updated_at: updated
      };
    } catch (error) {
      logger.error(`Error getting session statistics:`, error);
      throw error;
    }
  }
}

module.exports = new ContextAwarenessService();
