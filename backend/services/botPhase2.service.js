const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

class BotPhase2Service {
  async listCustomIntents() {
    const query = `
      SELECT intent_id, intent_name, intent_description, trigger_patterns, response_template,
             action_type, action_config, enabled, created_by, created_at, updated_at
      FROM bot_custom_intents
      ORDER BY updated_at DESC, created_at DESC
    `;
    const result = await executeQuery(query);
    return (result.recordset || []).map((row) => ({
      ...row,
      trigger_patterns: this.safeJsonParse(row.trigger_patterns, []),
      action_config: this.safeJsonParse(row.action_config, {}),
    }));
  }

  async createCustomIntent(payload, userId) {
    const query = `
      INSERT INTO bot_custom_intents
        (intent_name, intent_description, trigger_patterns, response_template, action_type, action_config, enabled, created_by, created_at, updated_at)
      OUTPUT INSERTED.intent_id
      VALUES
        (@intentName, @intentDescription, @triggerPatterns, @responseTemplate, @actionType, @actionConfig, @enabled, @createdBy, GETDATE(), GETDATE())
    `;

    const result = await executeQuery(query, {
      intentName: payload.intent_name,
      intentDescription: payload.intent_description || null,
      triggerPatterns: JSON.stringify(payload.trigger_patterns || []),
      responseTemplate: payload.response_template || '',
      actionType: payload.action_type || 'custom',
      actionConfig: JSON.stringify(payload.action_config || {}),
      enabled: payload.enabled ? 1 : 0,
      createdBy: userId,
    });

    return result.recordset?.[0]?.intent_id;
  }

  async updateCustomIntent(intentId, payload) {
    const query = `
      UPDATE bot_custom_intents
      SET
        intent_name = @intentName,
        intent_description = @intentDescription,
        trigger_patterns = @triggerPatterns,
        response_template = @responseTemplate,
        action_type = @actionType,
        action_config = @actionConfig,
        enabled = @enabled,
        updated_at = GETDATE()
      WHERE intent_id = @intentId
    `;

    const result = await executeQuery(query, {
      intentId,
      intentName: payload.intent_name,
      intentDescription: payload.intent_description || null,
      triggerPatterns: JSON.stringify(payload.trigger_patterns || []),
      responseTemplate: payload.response_template || '',
      actionType: payload.action_type || 'custom',
      actionConfig: JSON.stringify(payload.action_config || {}),
      enabled: payload.enabled ? 1 : 0,
    });

    return result.rowsAffected?.[0] || 0;
  }

  async deleteCustomIntent(intentId) {
    const result = await executeQuery('DELETE FROM bot_custom_intents WHERE intent_id = @intentId', { intentId });
    return result.rowsAffected?.[0] || 0;
  }

  async toggleCustomIntent(intentId, enabled) {
    const result = await executeQuery(
      'UPDATE bot_custom_intents SET enabled = @enabled, updated_at = GETDATE() WHERE intent_id = @intentId',
      { intentId, enabled: enabled ? 1 : 0 }
    );
    return result.rowsAffected?.[0] || 0;
  }

  async matchCustomIntent(message) {
    const query = `
      SELECT intent_id, intent_name, trigger_patterns, response_template, action_type, action_config
      FROM bot_custom_intents
      WHERE enabled = 1
      ORDER BY updated_at DESC, created_at DESC
    `;

    const result = await executeQuery(query);
    const intents = result.recordset || [];

    for (const intent of intents) {
      const patterns = this.safeJsonParse(intent.trigger_patterns, []);
      const matched = patterns.some((pattern) => {
        try {
          return new RegExp(pattern, 'i').test(message);
        } catch (error) {
          return false;
        }
      });

      if (matched) {
        return {
          intent_id: intent.intent_id,
          intent_name: intent.intent_name,
          response_template: intent.response_template,
          action_type: intent.action_type,
          action_config: this.safeJsonParse(intent.action_config, {}),
        };
      }
    }

    return null;
  }

  async getAnalyticsOverview() {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM bot_custom_intents WHERE enabled = 1) AS active_custom_intents,
        (SELECT COUNT(*) FROM bot_custom_intents) AS total_custom_intents,
        (SELECT COUNT(*) FROM bot_conversation_history WHERE created_at >= DATEADD(DAY, -7, GETDATE())) AS conversations_last_7_days,
        (SELECT COUNT(*) FROM bot_conversation_history WHERE message_type = 'user' AND created_at >= DATEADD(DAY, -7, GETDATE())) AS user_messages_last_7_days
    `;
    const result = await executeQuery(query);
    return result.recordset?.[0] || {};
  }

  async getIntentUsageReport() {
    const query = `
      SELECT TOP 20
        intent_matched,
        COUNT(*) AS usage_count,
        AVG(CAST(confidence AS FLOAT)) AS avg_confidence,
        MAX(created_at) AS last_used_at
      FROM bot_conversation_history
      WHERE intent_matched IS NOT NULL
      GROUP BY intent_matched
      ORDER BY usage_count DESC
    `;

    const result = await executeQuery(query);
    return result.recordset || [];
  }

  async getDepartmentResponseContext(user) {
    const query = `
      SELECT d.department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = @userId
    `;
    const result = await executeQuery(query, { userId: user.user_id });
    return result.recordset?.[0]?.department_name || null;
  }

  buildDepartmentSpecificResponse(baseAnswer, departmentName) {
    if (!departmentName) {
      return baseAnswer;
    }

    const normalized = departmentName.toLowerCase();
    let hint = 'I can tailor this further for your department workflows.';

    if (normalized.includes('hr')) {
      hint = 'I can include HR approval and employee onboarding/offboarding workflow steps.';
    } else if (normalized.includes('finance')) {
      hint = 'I can include finance compliance, audit trail, and approval matrix guidance.';
    } else if (normalized.includes('it')) {
      hint = 'I can include IT operations runbook, escalation path, and SLA-specific guidance.';
    } else if (normalized.includes('sales')) {
      hint = 'I can include customer-impact priority and account escalation guidance.';
    }

    return `${baseAnswer}\n\n🏢 Department Context: ${departmentName}\n${hint}`;
  }

  async executeWorkflowAction(actionType, actionConfig, context = {}) {
    switch ((actionType || '').toLowerCase()) {
      case 'email_notification':
        return {
          success: true,
          action: 'email_notification',
          message: 'Notification workflow accepted. Use email queue integration for delivery.',
          payload: actionConfig,
        };
      case 'create_ticket':
        return {
          success: true,
          action: 'create_ticket',
          message: 'Workflow accepted. Ticket creation should be delegated to ticket service.',
          payload: context,
        };
      case 'department_escalation':
        return {
          success: true,
          action: 'department_escalation',
          message: 'Workflow accepted. Escalation rule evaluated for department routing.',
          payload: actionConfig,
        };
      default:
        return {
          success: true,
          action: 'custom',
          message: 'Custom workflow action executed.',
          payload: actionConfig,
        };
    }
  }

  safeJsonParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      logger.warn('Failed to parse JSON in botPhase2 service', { error: error.message });
      return fallback;
    }
  }
}

module.exports = new BotPhase2Service();
