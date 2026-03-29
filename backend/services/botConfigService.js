// ============================================
// BOT CONFIGURATION SERVICE
// Manages bot settings, features, and advanced configuration
// Date: March 4, 2026
// ============================================

const db = require('../config/database');
const logger = require('../utils/logger');

class BotConfigService {
  /**
   * Get all bot configuration settings
   */
  async getBotConfig() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          config_id,
          config_name,
          config_value,
          config_type,
          description,
          is_active,
          updated_at,
          updated_by
        FROM bot_config
        ORDER BY config_name
      `);
      
      return result.recordset || [];
    } catch (error) {
      logger.error('Error fetching bot config:', error);
      throw error;
    }
  }

  /**
   * Get specific config by name
   */
  async getConfigByName(configName) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          config_id,
          config_name,
          config_value,
          config_type,
          description,
          is_active
        FROM bot_config
        WHERE config_name = @configName
      `, { configName });
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error fetching config by name:', error);
      throw error;
    }
  }

  /**
   * Update bot configuration
   */
  async updateBotConfig(configName, configValue, userId) {
    try {
      const result = await db.executeQuery(`
        UPDATE bot_config
        SET config_value = @configValue,
            updated_at = GETDATE(),
            updated_by = @updatedBy
        WHERE config_name = @configName
        
        SELECT config_id, config_name, config_value, config_type, is_active
        FROM bot_config
        WHERE config_name = @configName
      `, { 
        configName, 
        configValue: JSON.stringify(configValue),
        updatedBy: userId 
      });
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error updating bot config:', error);
      throw error;
    }
  }

  /**
   * Get all advanced features
   */
  async getAdvancedFeatures() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          feature_id,
          feature_name,
          feature_label,
          description,
          is_enabled,
          configuration,
          updated_at,
          updated_by
        FROM bot_advanced_features
        ORDER BY feature_name
      `);
      
      return (result.recordset || []).map(f => ({
        ...f,
        configuration: f.configuration ? JSON.parse(f.configuration) : {}
      }));
    } catch (error) {
      logger.error('Error fetching advanced features:', error);
      throw error;
    }
  }

  /**
   * Get feature by name
   */
  async getFeatureByName(featureName) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          feature_id,
          feature_name,
          feature_label,
          description,
          is_enabled,
          configuration
        FROM bot_advanced_features
        WHERE feature_name = @featureName
      `, { featureName });
      
      const feature = result.recordset?.[0];
      if (feature) {
        feature.configuration = feature.configuration ? JSON.parse(feature.configuration) : {};
      }
      return feature || null;
    } catch (error) {
      logger.error('Error fetching feature by name:', error);
      throw error;
    }
  }

  /**
   * Toggle feature on/off
   */
  async toggleFeature(featureName, enabled, userId) {
    try {
      const result = await db.executeQuery(`
        UPDATE bot_advanced_features
        SET is_enabled = @isEnabled,
            updated_at = GETDATE(),
            updated_by = @updatedBy
        WHERE feature_name = @featureName
        
        SELECT feature_id, feature_name, feature_label, is_enabled, configuration
        FROM bot_advanced_features
        WHERE feature_name = @featureName
      `, { 
        featureName, 
        isEnabled: enabled ? 1 : 0,
        updatedBy: userId 
      });
      
      const feature = result.recordset?.[0];
      if (feature) {
        feature.configuration = feature.configuration ? JSON.parse(feature.configuration) : {};
      }
      return feature || null;
    } catch (error) {
      logger.error('Error toggling feature:', error);
      throw error;
    }
  }

  /**
   * Update feature configuration
   */
  async updateFeatureConfig(featureName, configuration, userId) {
    try {
      const result = await db.executeQuery(`
        UPDATE bot_advanced_features
        SET configuration = @configuration,
            updated_at = GETDATE(),
            updated_by = @updatedBy
        WHERE feature_name = @featureName
        
        SELECT feature_id, feature_name, feature_label, is_enabled, configuration
        FROM bot_advanced_features
        WHERE feature_name = @featureName
      `, { 
        featureName, 
        configuration: JSON.stringify(configuration),
        updatedBy: userId 
      });
      
      const feature = result.recordset?.[0];
      if (feature) {
        feature.configuration = feature.configuration ? JSON.parse(feature.configuration) : {};
      }
      return feature || null;
    } catch (error) {
      logger.error('Error updating feature config:', error);
      throw error;
    }
  }

  /**
   * Get enabled features only
   */
  async getEnabledFeatures() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          feature_id,
          feature_name,
          feature_label,
          configuration
        FROM bot_advanced_features
        WHERE is_enabled = 1
        ORDER BY feature_name
      `);
      
      return (result.recordset || []).map(f => ({
        ...f,
        configuration: f.configuration ? JSON.parse(f.configuration) : {}
      }));
    } catch (error) {
      logger.error('Error fetching enabled features:', error);
      throw error;
    }
  }

  /**
   * Get response rules
   */
  async getResponseRules(departmentId = null) {
    try {
      let query = `
        SELECT 
          rule_id,
          rule_name,
          description,
          rule_type,
          condition_json,
          action_json,
          priority,
          is_active,
          department_id,
          updated_at
        FROM bot_response_rules
        WHERE is_active = 1
      `;
      
      const params = {};
      if (departmentId) {
        query += ` AND (department_id IS NULL OR department_id = @deptId)`;
        params.deptId = departmentId;
      }
      
      query += ` ORDER BY priority DESC, rule_id`;
      
      const result = await db.executeQuery(query, params);
      
      return (result.recordset || []).map(r => ({
        ...r,
        condition: r.condition_json ? JSON.parse(r.condition_json) : {},
        action: r.action_json ? JSON.parse(r.action_json) : {}
      }));
    } catch (error) {
      logger.error('Error fetching response rules:', error);
      throw error;
    }
  }

  /**
   * Create new response rule
   */
  async createResponseRule(ruleData, userId) {
    try {
      const result = await db.executeQuery(`
        INSERT INTO bot_response_rules 
        (rule_name, description, rule_type, condition_json, action_json, 
         priority, department_id, updated_by)
        VALUES 
        (@ruleName, @description, @ruleType, @condition, @action, 
         @priority, @deptId, @userId)
        
        SELECT rule_id, rule_name, rule_type, priority, is_active
        FROM bot_response_rules
        WHERE rule_id = SCOPE_IDENTITY()
      `, {
        ruleName: ruleData.rule_name,
        description: ruleData.description || null,
        ruleType: ruleData.rule_type,
        condition: JSON.stringify(ruleData.condition || {}),
        action: JSON.stringify(ruleData.action || {}),
        priority: ruleData.priority || 0,
        deptId: ruleData.department_id || null,
        userId
      });
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error creating response rule:', error);
      throw error;
    }
  }

  /**
   * Update response rule
   */
  async updateResponseRule(ruleId, ruleData, userId) {
    try {
      const result = await db.executeQuery(`
        UPDATE bot_response_rules
        SET rule_name = @ruleName,
            description = @description,
            rule_type = @ruleType,
            condition_json = @condition,
            action_json = @action,
            priority = @priority,
            is_active = @isActive,
            updated_at = GETDATE(),
            updated_by = @userId
        WHERE rule_id = @ruleId
        
        SELECT rule_id, rule_name, rule_type, priority, is_active
        FROM bot_response_rules
        WHERE rule_id = @ruleId
      `, {
        ruleId,
        ruleName: ruleData.rule_name,
        description: ruleData.description || null,
        ruleType: ruleData.rule_type,
        condition: JSON.stringify(ruleData.condition || {}),
        action: JSON.stringify(ruleData.action || {}),
        priority: ruleData.priority || 0,
        isActive: ruleData.is_active ? 1 : 0,
        userId
      });
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error updating response rule:', error);
      throw error;
    }
  }

  /**
   * Delete response rule
   */
  async deleteResponseRule(ruleId) {
    try {
      await db.executeQuery(`
        DELETE FROM bot_response_rules
        WHERE rule_id = @ruleId
      `, { ruleId });
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting response rule:', error);
      throw error;
    }
  }

  /**
   * Get bot statistics - REAL DATA from v_bot_dashboard_stats view
   */
  async getBotStats() {
    try {
      const result = await db.executeQuery(`SELECT * FROM v_bot_dashboard_stats`);
      const stats = result.recordset?.[0] || {};

      // Parse JSON fields safely
      let topIntents = [];
      let topCategories = [];
      try { if (stats.top_intents_json) topIntents = JSON.parse(stats.top_intents_json); } catch {}
      try { if (stats.top_categories_json) topCategories = JSON.parse(stats.top_categories_json); } catch {}

      return {
        active_sessions: stats.active_sessions || 0,
        total_sessions: stats.total_sessions || 0,
        unique_users: stats.unique_users || 0,
        total_messages: stats.total_messages || 0,
        total_user_messages: stats.total_user_messages || 0,
        total_bot_messages: stats.total_bot_messages || 0,
        sessions_today: stats.sessions_today || 0,
        messages_today: stats.messages_today || 0,
        sessions_30d: stats.sessions_30d || 0,
        messages_30d: stats.messages_30d || 0,
        sessions_7d: stats.sessions_7d || 0,
        messages_7d: stats.messages_7d || 0,
        overall_avg_confidence: stats.overall_avg_confidence || 0,
        overall_avg_response_ms: stats.overall_avg_response_ms || 0,
        ai_enhanced_responses: stats.ai_enhanced_responses || 0,
        ai_enhanced_30d: stats.ai_enhanced_30d || 0,
        active_custom_intents: stats.active_custom_intents || 0,
        total_intents_matched: stats.total_intents_matched || 0,
        total_tickets_created: stats.total_tickets_created || 0,
        total_passwords_changed: stats.total_passwords_changed || 0,
        api_calls_30d: stats.api_calls_30d || 0,
        tokens_used_30d: stats.tokens_used_30d || 0,
        api_cost_30d: stats.api_cost_30d || 0,
        top_intents: topIntents,
        top_categories: topCategories
      };
    } catch (error) {
      logger.error('Error fetching bot stats:', error);
      throw error;
    }
  }
}

module.exports = new BotConfigService();
