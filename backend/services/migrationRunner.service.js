// ============================================
// PRODUCTION MIGRATION RUNNER
// Connects to DB using .env, checks schema, applies indexes, SP, views, etc.
// Runs automatically on server startup
// ============================================

const { getPool, executeQuery } = require('../config/database');
const emailApprovalSafeBodies = require('../data/emailApprovalSafeBodies');
const emailPendingInfoSafeBodies = require('../data/emailPendingInfoSafeBodies');
const logger = require('../utils/logger');

/**
 * Split SQL by GO (batch separator) - each batch runs separately
 */
const splitBatches = (sql) => {
  return sql
    .split(/\bGO\b/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
};

/**
 * Run a single SQL batch (handles multi-statement)
 */
const runBatch = async (pool, sql) => {
  const request = pool.request();
  await request.query(sql);
};

/**
 * Run a single SQL statement, swallow errors for resilience
 */
const runSafe = async (pool, sql, label) => {
  try {
    await runBatch(pool, sql);
    return true;
  } catch (err) {
    logger.warn(`Migration skip: ${label}`, { error: err.message });
    return false;
  }
};

/**
 * Run production indexes migration (each index separately for resilience)
 */
const runIndexes = async (pool) => {
  const list = [
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_requester' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_requester ON tickets(requester_id)`, label: 'IX_tickets_requester' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_assigned' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_assigned ON tickets(assigned_to)`, label: 'IX_tickets_assigned' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_status' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_status ON tickets(status_id)`, label: 'IX_tickets_status' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_priority' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_priority ON tickets(priority_id)`, label: 'IX_tickets_priority' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_created_at' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_created_at ON tickets(created_at DESC)`, label: 'IX_tickets_created_at' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_due_date' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_due_date ON tickets(due_date) WHERE due_date IS NOT NULL`, label: 'IX_tickets_due_date' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_category' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_category ON tickets(category_id)`, label: 'IX_tickets_category' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_department' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_department ON tickets(department_id) WHERE department_id IS NOT NULL`, label: 'IX_tickets_department' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tickets_list_filter' AND object_id = OBJECT_ID('tickets')) CREATE NONCLUSTERED INDEX IX_tickets_list_filter ON tickets(status_id, priority_id, created_at DESC) INCLUDE (ticket_id, ticket_number, subject, requester_id, assigned_to)`, label: 'IX_tickets_list_filter' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ticket_activities') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ticket_activities_ticket' AND object_id = OBJECT_ID('ticket_activities')) CREATE NONCLUSTERED INDEX IX_ticket_activities_ticket ON ticket_activities(ticket_id)`, label: 'IX_ticket_activities_ticket' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'security_audit_log') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_created' AND object_id = OBJECT_ID('security_audit_log')) CREATE NONCLUSTERED INDEX IX_audit_created ON security_audit_log(created_at DESC)`, label: 'IX_audit_created' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'security_audit_log') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_user' AND object_id = OBJECT_ID('security_audit_log')) CREATE NONCLUSTERED INDEX IX_audit_user ON security_audit_log(user_id) WHERE user_id IS NOT NULL`, label: 'IX_audit_user' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'job_executions') AND COL_LENGTH('job_executions','executed_at') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_job_executions_at' AND object_id = OBJECT_ID('job_executions')) CREATE NONCLUSTERED INDEX IX_job_executions_at ON job_executions(executed_at DESC)`, label: 'IX_job_executions_at' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'email_queue') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_email_queue_status' AND object_id = OBJECT_ID('email_queue')) CREATE NONCLUSTERED INDEX IX_email_queue_status ON email_queue(status)`, label: 'IX_email_queue_status' },
    { sql: `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'email_queue') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_email_queue_created' AND object_id = OBJECT_ID('email_queue')) CREATE NONCLUSTERED INDEX IX_email_queue_created ON email_queue(created_at DESC)`, label: 'IX_email_queue_created' },
    { sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_active' AND object_id = OBJECT_ID('users')) CREATE NONCLUSTERED INDEX IX_users_active ON users(is_active) WHERE is_active = 1`, label: 'IX_users_active' },
  ];
  for (const { sql: s, label } of list) {
    await runSafe(pool, s, label);
  }
  // Optional indexes (may fail if columns differ)
  await runSafe(pool, `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ticket_activities') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ticket_activities_created' AND object_id = OBJECT_ID('ticket_activities')) CREATE NONCLUSTERED INDEX IX_ticket_activities_created ON ticket_activities(created_at DESC)`, 'IX_ticket_activities_created');
  await runSafe(pool, `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'notifications') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_user' AND object_id = OBJECT_ID('notifications')) CREATE NONCLUSTERED INDEX IX_notifications_user ON notifications(user_id)`, 'IX_notifications_user');
  await runSafe(pool, `IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'notifications') AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_read_created' AND object_id = OBJECT_ID('notifications')) CREATE NONCLUSTERED INDEX IX_notifications_read_created ON notifications(user_id, is_read, created_at DESC)`, 'IX_notifications_read_created');
  logger.success('Production indexes applied/verified');
};

/**
 * Create maintenance_config and sp_TruncateOldLogs
 */
const runLogTruncation = async (pool) => {
  const checkConfig = await executeQuery(
    "SELECT 1 FROM sys.tables WHERE name = 'maintenance_config'"
  );
  if (!checkConfig.recordset?.length) {
    await runBatch(pool, `
      CREATE TABLE maintenance_config (
        config_key NVARCHAR(100) PRIMARY KEY,
        config_value NVARCHAR(255) NOT NULL,
        updated_at DATETIME DEFAULT GETDATE()
      );
      INSERT INTO maintenance_config (config_key, config_value) VALUES
        ('audit_log_retention_days', '90'),
        ('job_executions_retention_days', '30'),
        ('bot_history_retention_days', '90');
    `);
    logger.success('Created maintenance_config table');
  }

  // Stored procedure
  await runBatch(pool, `
    IF OBJECT_ID('dbo.sp_TruncateOldLogs', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_TruncateOldLogs;
  `);

  const spSql = `
    CREATE PROCEDURE dbo.sp_TruncateOldLogs @dryRun BIT = 0
    AS
    BEGIN
      SET NOCOUNT ON;
      DECLARE @auditDays INT = 90, @jobDays INT = 30, @botDays INT = 90;
      DECLARE @auditDate DATETIME, @jobDate DATETIME, @botDate DATETIME;
      DECLARE @auditCount INT = 0, @jobCount INT = 0, @botCount INT = 0, @chatMsgCount INT = 0;
      DECLARE @jobCol NVARCHAR(50), @jobSql NVARCHAR(400);

      SELECT @auditDays = CAST(ISNULL(config_value, '90') AS INT) FROM maintenance_config WHERE config_key = 'audit_log_retention_days';
      SELECT @jobDays = CAST(ISNULL(config_value, '30') AS INT) FROM maintenance_config WHERE config_key = 'job_executions_retention_days';
      SELECT @botDays = CAST(ISNULL(config_value, '90') AS INT) FROM maintenance_config WHERE config_key = 'bot_history_retention_days';

      SET @auditDate = DATEADD(DAY, -@auditDays, GETDATE());
      SET @jobDate = DATEADD(DAY, -@jobDays, GETDATE());
      SET @botDate = DATEADD(DAY, -@botDays, GETDATE());

      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'security_audit_log')
      BEGIN
        SELECT @auditCount = COUNT(*) FROM security_audit_log WHERE created_at < @auditDate;
        IF @dryRun = 0 AND @auditCount > 0 DELETE FROM security_audit_log WHERE created_at < @auditDate;
      END

      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'job_executions')
      BEGIN
        SET @jobCol = CASE WHEN COL_LENGTH('job_executions','executed_at') IS NOT NULL THEN 'executed_at' WHEN COL_LENGTH('job_executions','created_at') IS NOT NULL THEN 'created_at' ELSE NULL END;
        IF @jobCol IS NOT NULL
        BEGIN
          SET @jobSql = N'SELECT @jobCount = COUNT(*) FROM job_executions WHERE ' + @jobCol + N' < @jobDate';
          EXEC sp_executesql @jobSql, N'@jobDate DATETIME, @jobCount INT OUTPUT', @jobDate = @jobDate, @jobCount = @jobCount OUTPUT;
          IF @dryRun = 0 AND @jobCount > 0
          BEGIN
            SET @jobSql = N'DELETE FROM job_executions WHERE ' + @jobCol + N' < @jobDate';
            EXEC sp_executesql @jobSql, N'@jobDate DATETIME', @jobDate = @jobDate;
          END
        END
      END

      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bot_conversation_history')
      BEGIN
        SELECT @botCount = COUNT(*) FROM bot_conversation_history WHERE created_at < @botDate;
        IF @dryRun = 0 AND @botCount > 0 DELETE FROM bot_conversation_history WHERE created_at < @botDate;
      END

      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bot_chat_messages')
      BEGIN
        SELECT @chatMsgCount = COUNT(*) FROM bot_chat_messages WHERE created_at < @botDate;
        IF @dryRun = 0 AND @chatMsgCount > 0 DELETE FROM bot_chat_messages WHERE created_at < @botDate;
      END

      SELECT @auditCount AS audit_logs_to_delete, @jobCount AS job_executions_to_delete,
        @botCount AS bot_history_to_delete, @chatMsgCount AS bot_messages_to_delete, @dryRun AS dry_run;
    END
  `;
  await runBatch(pool, spSql);
  logger.success('sp_TruncateOldLogs created/updated');
};

/**
 * Create v_ticket_summary view (optional - may fail if schema differs)
 */
const runViews = async (pool) => {
  await runSafe(pool, `IF OBJECT_ID('dbo.v_ticket_summary', 'V') IS NOT NULL DROP VIEW dbo.v_ticket_summary;`, 'drop v_ticket_summary');
  const ok = await runSafe(pool, `
    CREATE VIEW dbo.v_ticket_summary AS
    SELECT t.ticket_id, t.ticket_number, t.subject, t.created_at, t.updated_at, t.due_date, t.resolved_at,
      t.requester_id, t.assigned_to, t.status_id, t.priority_id, t.category_id, t.department_id, t.is_escalated,
      ts.status_name, ts.status_code, ts.is_final_status, tp.priority_name, tp.priority_code, tc.category_name, tc.category_code,
      u_req.first_name + ' ' + u_req.last_name AS requester_name, u_eng.first_name + ' ' + u_eng.last_name AS assigned_to_name, d.department_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
    LEFT JOIN users u_req ON t.requester_id = u_req.user_id
    LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
    LEFT JOIN departments d ON t.department_id = d.department_id;
  `, 'v_ticket_summary');
  if (ok) logger.success('v_ticket_summary view created');
};

/**
 * Add granular permission columns to user_roles and create SUB_ADMIN system role
 */
const runGranularPermissions = async (pool) => {
  const newCols = [
    'can_reopen_tickets',
    'can_manage_kb',
    'can_manage_incidents',
    'can_manage_snippets',
    'can_use_ai_features',
    'can_view_job_monitor',
    'can_manage_settings_general',
    'can_manage_settings_email',
    'can_manage_settings_tickets',
    'can_manage_settings_sla',
    'can_manage_settings_security',
    'can_manage_settings_bot',
    'can_manage_settings_license',
    'can_manage_settings_backup',
  ];

  for (const col of newCols) {
    await runSafe(pool,
      `IF COL_LENGTH('user_roles', '${col}') IS NULL ALTER TABLE user_roles ADD ${col} BIT NOT NULL DEFAULT 0`,
      `add_col_${col}`
    );
  }

  // Give ADMIN role all new permissions
  await runSafe(pool, `
    UPDATE user_roles SET
      can_reopen_tickets = 1,
      can_manage_kb = 1,
      can_manage_incidents = 1,
      can_manage_snippets = 1,
      can_use_ai_features = 1,
      can_view_job_monitor = 1,
      can_manage_settings_general = 1,
      can_manage_settings_email = 1,
      can_manage_settings_tickets = 1,
      can_manage_settings_sla = 1,
      can_manage_settings_security = 1,
      can_manage_settings_bot = 1,
      can_manage_settings_license = 1,
      can_manage_settings_backup = 1
    WHERE role_code = 'ADMIN'
  `, 'admin_perms_update');

  // Insert SUB_ADMIN system role if it does not already exist
  await runSafe(pool, `
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE role_code = 'SUB_ADMIN')
    INSERT INTO user_roles (
      role_name, role_code, description, is_system_role, is_active,
      can_create_tickets, can_view_all_tickets, can_assign_tickets,
      can_close_tickets, can_reopen_tickets, can_delete_tickets, can_manage_users,
      can_manage_departments, can_manage_roles, can_view_analytics,
      can_manage_system,
      can_manage_kb, can_manage_incidents, can_manage_snippets,
      can_use_ai_features, can_view_job_monitor,
      can_manage_settings_general, can_manage_settings_email,
      can_manage_settings_tickets, can_manage_settings_sla,
      can_manage_settings_security, can_manage_settings_bot,
      can_manage_settings_license, can_manage_settings_backup
    ) VALUES (
      'Sub Admin', 'SUB_ADMIN',
      'Limited administrator for customers. Full operational control without access to sensitive system configuration.',
      1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      0,
      1, 1, 1, 1, 1,
      1, 0, 1, 1, 0, 0, 0, 0
    )
  `, 'insert_sub_admin_role');

  // Do not overwrite editable system role permissions on startup.

  logger.success('Granular permissions migration applied/verified');
};

const runTicketGuidanceSetup = async (pool) => {
  await runBatch(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ticket_guided_intake')
    BEGIN
      CREATE TABLE ticket_guided_intake (
        guided_intake_id INT IDENTITY(1,1) PRIMARY KEY,
        ticket_id INT NOT NULL UNIQUE,
        category_code NVARCHAR(100) NULL,
        selected_template_id NVARCHAR(150) NULL,
        selected_template_label NVARCHAR(255) NULL,
        selected_template_text NVARCHAR(500) NULL,
        payload_json NVARCHAR(MAX) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ticket_guided_intake_ticket
          FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE CASCADE
      );
    END
  `);

  await runSafe(
    pool,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ticket_guided_intake_ticket' AND object_id = OBJECT_ID('ticket_guided_intake')) CREATE NONCLUSTERED INDEX IX_ticket_guided_intake_ticket ON ticket_guided_intake(ticket_id)`,
    'IX_ticket_guided_intake_ticket'
  );

  logger.success('Ticket guided intake tables applied/verified');
};

/**
 * Create licensing tables for offline signed licenses
 */
const runLicensingSetup = async (pool) => {
  await runBatch(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'license_store')
    BEGIN
      CREATE TABLE license_store (
        license_row_id INT IDENTITY(1,1) PRIMARY KEY,
        license_id NVARCHAR(100) NOT NULL,
        customer_name NVARCHAR(255) NULL,
        product_name NVARCHAR(255) NULL,
        edition NVARCHAR(100) NULL,
        issued_at DATETIME NULL,
        expires_at DATETIME NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'VALID',
        is_active BIT NOT NULL DEFAULT 0,
        payload_json NVARCHAR(MAX) NOT NULL,
        signature NVARCHAR(MAX) NOT NULL,
        algorithm NVARCHAR(50) NOT NULL DEFAULT 'ed25519',
        installed_by INT NULL,
        installed_at DATETIME NOT NULL DEFAULT GETDATE(),
        server_fingerprint_hash NVARCHAR(255) NULL
      );
    END
  `);

  await runBatch(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'license_events')
    BEGIN
      CREATE TABLE license_events (
        event_id INT IDENTITY(1,1) PRIMARY KEY,
        event_type NVARCHAR(100) NOT NULL,
        details_json NVARCHAR(MAX) NULL,
        created_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    END
  `);

  await runBatch(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'license_runtime_state')
    BEGIN
      CREATE TABLE license_runtime_state (
        state_id INT PRIMARY KEY,
        current_status NVARCHAR(50) NOT NULL,
        status_message NVARCHAR(500) NULL,
        active_license_id NVARCHAR(100) NULL,
        expires_at DATETIME NULL,
        warning_days_remaining INT NULL,
        last_checked_at DATETIME NOT NULL DEFAULT GETDATE(),
        sessions_invalidated_at DATETIME NULL,
        last_observed_at DATETIME NULL,
        max_observed_at DATETIME NULL,
        clock_tamper_detected_at DATETIME NULL
      );
    END
  `);

  await runSafe(pool, `IF COL_LENGTH('license_runtime_state', 'last_observed_at') IS NULL ALTER TABLE license_runtime_state ADD last_observed_at DATETIME NULL`, 'license_runtime_state.last_observed_at');
  await runSafe(pool, `IF COL_LENGTH('license_runtime_state', 'max_observed_at') IS NULL ALTER TABLE license_runtime_state ADD max_observed_at DATETIME NULL`, 'license_runtime_state.max_observed_at');
  await runSafe(pool, `IF COL_LENGTH('license_runtime_state', 'clock_tamper_detected_at') IS NULL ALTER TABLE license_runtime_state ADD clock_tamper_detected_at DATETIME NULL`, 'license_runtime_state.clock_tamper_detected_at');

  await runSafe(pool, `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_license_store_active' AND object_id = OBJECT_ID('license_store')) CREATE NONCLUSTERED INDEX IX_license_store_active ON license_store(is_active, installed_at DESC)`, 'IX_license_store_active');
  await runSafe(pool, `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_license_events_created' AND object_id = OBJECT_ID('license_events')) CREATE NONCLUSTERED INDEX IX_license_events_created ON license_events(created_at DESC)`, 'IX_license_events_created');
  logger.success('Licensing tables applied/verified');
};

/**
 * Seed app_public_url — admins override env APP_PUBLIC_URL for email links (multi-tenant / domain).
 */
const runAppPublicUrlSetting = async (pool) => {
  await runSafe(
    pool,
    `
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'app_public_url')
    BEGIN
      INSERT INTO system_settings (
        setting_key, setting_value, setting_category,
        setting_type, setting_description, is_public
      )
      VALUES (
        'app_public_url',
        '',
        'general',
        'string',
        'Public HTTPS base URL for the web app (email links, password reset). Leave empty to use APP_PUBLIC_URL from environment.',
        1
      );
    END
    `,
    'app_public_url setting seed'
  );
  logger.success('app_public_url setting applied/verified');
};

/**
 * Email when someone requests ticket closure approval (managers notified).
 */
const runNotifyOnClosureRequestSetting = async (pool) => {
  await runSafe(
    pool,
    `
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'notify_on_closure_request')
    BEGIN
      INSERT INTO system_settings (
        setting_key, setting_value, setting_category,
        setting_type, setting_description, is_public
      )
      VALUES (
        'notify_on_closure_request',
        'true',
        'notification',
        'boolean',
        'Send email to managers when an engineer requests approval to close a ticket.',
        0
      );
    END
    `,
    'notify_on_closure_request setting seed'
  );
  logger.success('notify_on_closure_request setting applied/verified');
};

/**
 * Single-use hashed tokens for approve/reject links from email (SPA + POST, no GET side effects).
 */
const runApprovalEmailActionTokensTable = async (pool) => {
  const ok = await runSafe(
    pool,
    `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approval_email_action_tokens')
    BEGIN
      CREATE TABLE approval_email_action_tokens (
        approval_id INT NOT NULL PRIMARY KEY,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        used_at DATETIME2 NULL,
        CONSTRAINT FK_approval_email_action_tokens_approval
          FOREIGN KEY (approval_id) REFERENCES ticket_approvals(approval_id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX UX_approval_email_action_tokens_hash
        ON approval_email_action_tokens(token_hash);
    END
    `,
    'approval_email_action_tokens table'
  );
  if (ok) logger.success('approval_email_action_tokens table applied/verified');
};

/**
 * Idempotency log for inbound approval emails (IMAP poller).
 */
const runApprovalInboundProcessedTable = async (pool) => {
  const ok = await runSafe(
    pool,
    `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approval_inbound_processed')
    BEGIN
      CREATE TABLE approval_inbound_processed (
        message_id_hash CHAR(64) NOT NULL PRIMARY KEY,
        internet_message_id NVARCHAR(512) NULL,
        approval_id INT NULL,
        outcome NVARCHAR(32) NOT NULL,
        detail NVARCHAR(500) NULL,
        processed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_approval_inbound_processed_approval ON approval_inbound_processed(approval_id)
        WHERE approval_id IS NOT NULL;
    END
    `,
    'approval_inbound_processed table'
  );
  if (ok) logger.success('approval_inbound_processed table applied/verified');
};

/**
 * Mailbox address for mailto + IMAP (same inbox).
 */
const runApprovalInboundToSetting = async (pool) => {
  await runSafe(
    pool,
    `
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'approval_inbound_to')
    BEGIN
      INSERT INTO system_settings (
        setting_key, setting_value, setting_category,
        setting_type, setting_description, is_public
      )
      VALUES (
        'approval_inbound_to',
        '',
        'email',
        'string',
        'Inbox address for ticket approval-by-email (e.g. approvals@company.com). Must match the mailbox read by APPROVAL_INBOUND_IMAP_* . Leave empty to hide mailto links.',
        0
      );
    END
    `,
    'approval_inbound_to setting seed'
  );
  logger.success('approval_inbound_to setting applied/verified');
};

/**
 * Replace approval email templates with emoji-free bodies (Gmail/outlook show ? for many emoji).
 */
const runEmailApprovalTemplatesSafeIcons = async () => {
  const rows = [
    ['TICKET_APPROVAL_REQUESTED', emailApprovalSafeBodies.TICKET_APPROVAL_REQUESTED],
    ['TICKET_APPROVAL_APPROVED', emailApprovalSafeBodies.TICKET_APPROVAL_APPROVED],
    ['TICKET_APPROVAL_REJECTED', emailApprovalSafeBodies.TICKET_APPROVAL_REJECTED],
    ['TICKET_PENDING_INFO', emailPendingInfoSafeBodies.TICKET_PENDING_INFO],
    ['TICKET_INFO_PROVIDED', emailPendingInfoSafeBodies.TICKET_INFO_PROVIDED],
  ];
  for (const [templateKey, { subject, body }] of rows) {
    try {
      await executeQuery(
        `IF EXISTS (SELECT 1 FROM email_templates WHERE template_key = @templateKey)
         UPDATE email_templates
         SET subject_template = @subject, body_template = @body
         WHERE template_key = @templateKey`,
        { templateKey, subject, body }
      );
      logger.info(`Email template refreshed (safe icons): ${templateKey}`);
    } catch (err) {
      logger.warn(`Email template safe-icons skip: ${templateKey}`, { error: err.message });
    }
  }
  logger.success('System email templates refreshed (emoji-free, inbox-safe)');
};

/**
 * Seed xAI Grok provider if it doesn't exist yet
 */
const runGrokProviderSeed = async (pool) => {
  try {
    const check = await pool.request().query(
      `SELECT COUNT(*) AS cnt FROM bot_api_providers WHERE provider_name = 'grok'`
    );
    if (check.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO bot_api_providers
        (provider_name, provider_label, description, api_endpoint, priority, capabilities, rate_limit_rpm, rate_limit_tpm, timeout_seconds, is_enabled, is_configured)
        VALUES
        ('grok', 'xAI Grok', 'xAI Grok API - Fast reasoning, real-time knowledge, code analysis', 'https://api.x.ai/v1/chat/completions', 9,
         '["code_analysis","complex_reasoning","real_time_knowledge","fast_processing","debugging"]', 60, 100000, 30, 0, 0)
      `);
      logger.info('Seeded xAI Grok API provider');
    }
  } catch (err) {
    logger.warn('Grok provider seed skipped', { error: err.message });
  }
};

/**
 * Fix deprecated gemini-pro model → gemini-2.0-flash and correct endpoint
 */
const runGeminiModelFix = async (pool) => {
  try {
    // Update endpoint to correct format
    await pool.request().query(`
      UPDATE bot_api_providers
      SET api_endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      WHERE provider_name = 'google'
        AND (api_endpoint NOT LIKE '%/models/%' OR api_endpoint LIKE '%gemini-pro%')
    `);
    // Update stored model_name if it's not a valid gemini model name
    await pool.request().query(`
      UPDATE bot_api_keys
      SET model_name = 'gemini-2.0-flash'
      WHERE provider_id IN (SELECT provider_id FROM bot_api_providers WHERE provider_name = 'google')
        AND (model_name NOT LIKE 'gemini-%' OR model_name = 'gemini-pro')
    `);
    // Widen error_message column so long API error messages are not truncated
    await pool.request().query(`
      IF COL_LENGTH('bot_api_usage', 'error_message') IS NOT NULL
        AND COL_LENGTH('bot_api_usage', 'error_message') < 4000
      BEGIN
        ALTER TABLE bot_api_usage ALTER COLUMN error_message NVARCHAR(2000)
      END
    `);
    logger.info('Gemini model/endpoint migration checked');
  } catch (err) {
    logger.warn('Gemini model fix skipped', { error: err.message });
  }
};

/**
 * Phase 9: WhatsApp Integration — DB foundation
 * Adds whatsapp columns to users, creates support tables, seeds system_settings
 */
const runWhatsAppMigration = async (pool) => {
  try {
    // 1. Add whatsapp columns to users table
    await runSafe(pool, `
      IF COL_LENGTH('users', 'whatsapp_phone') IS NULL
        ALTER TABLE users ADD whatsapp_phone NVARCHAR(20) NULL
    `, 'users.whatsapp_phone');

    await runSafe(pool, `
      IF COL_LENGTH('users', 'whatsapp_opted_in') IS NULL
        ALTER TABLE users ADD whatsapp_opted_in BIT NOT NULL DEFAULT 0
    `, 'users.whatsapp_opted_in');

    await runSafe(pool, `
      IF COL_LENGTH('users', 'whatsapp_verified_at') IS NULL
        ALTER TABLE users ADD whatsapp_verified_at DATETIME NULL
    `, 'users.whatsapp_verified_at');

    // 2. user_channel_preferences
    await runSafe(pool, `
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_channel_preferences')
      CREATE TABLE user_channel_preferences (
        pref_id        INT IDENTITY(1,1) PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        channel        NVARCHAR(20) NOT NULL,
        is_enabled     BIT NOT NULL DEFAULT 1,
        notify_new_ticket     BIT NOT NULL DEFAULT 1,
        notify_update         BIT NOT NULL DEFAULT 1,
        notify_resolved       BIT NOT NULL DEFAULT 1,
        notify_sla_breach     BIT NOT NULL DEFAULT 1,
        notify_assigned       BIT NOT NULL DEFAULT 1,
        notify_comment        BIT NOT NULL DEFAULT 1,
        notify_approval       BIT NOT NULL DEFAULT 1,
        updated_at            DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_user_channel UNIQUE (user_id, channel)
      )
    `, 'user_channel_preferences');

    // 3. whatsapp_message_log
    await runSafe(pool, `
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'whatsapp_message_log')
      CREATE TABLE whatsapp_message_log (
        log_id           INT IDENTITY(1,1) PRIMARY KEY,
        user_id          INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
        direction        NVARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
        wa_message_id    NVARCHAR(100) NULL,
        from_phone       NVARCHAR(30) NULL,
        to_phone         NVARCHAR(30) NULL,
        message_type     NVARCHAR(30) NOT NULL DEFAULT 'text',
        template_name    NVARCHAR(100) NULL,
        content          NVARCHAR(4000) NULL,
        status           NVARCHAR(20) NOT NULL DEFAULT 'sent',
        error_message    NVARCHAR(500) NULL,
        bot_session_id   INT NULL,
        related_ticket_id INT NULL,
        created_at       DATETIME NOT NULL DEFAULT GETDATE()
      )
    `, 'whatsapp_message_log');

    // 4. whatsapp_otp
    await runSafe(pool, `
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'whatsapp_otp')
      CREATE TABLE whatsapp_otp (
        otp_id       INT IDENTITY(1,1) PRIMARY KEY,
        user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        phone        NVARCHAR(20) NOT NULL,
        otp_code     NVARCHAR(6) NOT NULL,
        expires_at   DATETIME NOT NULL,
        used_at      DATETIME NULL,
        created_at   DATETIME NOT NULL DEFAULT GETDATE()
      )
    `, 'whatsapp_otp');

    // 5. bot_chat_sessions — add channel column
    await runSafe(pool, `
      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bot_chat_sessions')
        AND COL_LENGTH('bot_chat_sessions', 'channel') IS NULL
        ALTER TABLE bot_chat_sessions ADD channel NVARCHAR(20) NOT NULL DEFAULT 'web'
    `, 'bot_chat_sessions.channel');

    // 6. system_settings — seed WhatsApp keys
    const waSettings = [
      ['whatsapp_enabled',              'false',  'integrations', 'Enable WhatsApp Business integration'],
      ['whatsapp_api_token',            '',       'integrations', 'Meta WhatsApp Cloud API Bearer token'],
      ['whatsapp_phone_number_id',      '',       'integrations', 'Meta Phone Number ID'],
      ['whatsapp_business_account_id',  '',       'integrations', 'Meta WhatsApp Business Account ID'],
      ['whatsapp_webhook_verify_token', '',       'integrations', 'Webhook verify token (you choose this)'],
      ['whatsapp_bot_enabled',          'false',  'integrations', 'Route incoming WhatsApp messages to AI bot'],
      ['whatsapp_notify_enabled',       'false',  'integrations', 'Send ticket notifications via WhatsApp'],
    ];

    for (const [key, value, category, description] of waSettings) {
      await runSafe(pool, `
        IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = '${key}')
          INSERT INTO system_settings (setting_key, setting_value, category, description)
          VALUES ('${key}', '${value}', '${category}', '${description}')
      `, `seed.${key}`);
    }

    logger.info('WhatsApp Phase 9 migration completed');
  } catch (err) {
    logger.warn('WhatsApp migration skipped', { error: err.message });
  }
};

/**
 * Main: Run all production migrations
 */
const runProductionMigrations = async () => {
  let pool;
  try {
    logger.info('Running production database migrations...');
    pool = await getPool();

    await runIndexes(pool);
    await runLogTruncation(pool);
    await runGranularPermissions(pool);
    await runTicketGuidanceSetup(pool);
    await runLicensingSetup(pool);
    await runAppPublicUrlSetting(pool);
    await runNotifyOnClosureRequestSetting(pool);
    await runApprovalEmailActionTokensTable(pool);
    await runApprovalInboundProcessedTable(pool);
    await runApprovalInboundToSetting(pool);
    await runEmailApprovalTemplatesSafeIcons();
    await runGrokProviderSeed(pool);
    await runGeminiModelFix(pool);
    await runWhatsAppMigration(pool);
    await runViews(pool);

    logger.success('All production migrations completed successfully');
    return { success: true };
  } catch (error) {
    logger.error('Production migration failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

module.exports = {
  runProductionMigrations,
  runIndexes,
  runLogTruncation,
  runGranularPermissions,
  runTicketGuidanceSetup,
  runLicensingSetup,
  runAppPublicUrlSetting,
  runNotifyOnClosureRequestSetting,
  runApprovalEmailActionTokensTable,
  runApprovalInboundProcessedTable,
  runApprovalInboundToSetting,
  runEmailApprovalTemplatesSafeIcons,
  runViews
};
