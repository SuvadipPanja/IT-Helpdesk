// ============================================================
// ASSIGNMENT RULES SERVICE
// Skill-based / category-based ticket routing rules.
// Auto-creates assignment_rules table if missing.
// ============================================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// -------------------------
// Idempotent table setup
// -------------------------
async function ensureTable() {
  await executeQuery(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'assignment_rules'
    )
    BEGIN
      CREATE TABLE assignment_rules (
        rule_id       INT IDENTITY(1,1) PRIMARY KEY,
        rule_name     NVARCHAR(100)  NOT NULL,
        category_id   INT            NULL,
        priority_code NVARCHAR(50)   NULL,
        assign_to_user INT           NULL,
        assign_method NVARCHAR(50)   NOT NULL DEFAULT 'load_balanced',
        is_active     BIT            NOT NULL DEFAULT 1,
        priority_order INT           NOT NULL DEFAULT 0,
        created_by    INT            NULL,
        created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updated_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_arule_category FOREIGN KEY (category_id) REFERENCES ticket_categories(category_id),
        CONSTRAINT FK_arule_user     FOREIGN KEY (assign_to_user) REFERENCES users(user_id)
      );
      CREATE INDEX IX_arule_active   ON assignment_rules(is_active);
      CREATE INDEX IX_arule_category ON assignment_rules(category_id);
    END
  `);
}

// ============================================================
// GET ALL RULES
// ============================================================
async function getRules() {
  await ensureTable();
  const result = await executeQuery(`
    SELECT
      r.rule_id, r.rule_name, r.category_id, r.priority_code,
      r.assign_to_user, r.assign_method, r.is_active, r.priority_order,
      r.created_at, r.updated_at,
      tc.category_name, tc.category_code,
      ISNULL(u.first_name,'') + ' ' + ISNULL(u.last_name,'') AS assign_to_name
    FROM assignment_rules r
    LEFT JOIN ticket_categories tc ON r.category_id = tc.category_id
    LEFT JOIN users u ON r.assign_to_user = u.user_id
    ORDER BY r.priority_order ASC, r.rule_id ASC
  `);
  return result.recordset;
}

// ============================================================
// FIND BEST ENGINEER by rules (category + priority)
// Returns user object or null if no rule matches
// ============================================================
async function findEngineerByRules({ categoryId = null, priorityCode = null } = {}) {
  await ensureTable();

  // Build a WHERE clause that matches the most specific rule first
  // Rules are prioritised by: (category + priority) > (category only) > (priority only)
  const result = await executeQuery(`
    SELECT TOP 1
      r.rule_id, r.assign_to_user, r.assign_method,
      u.user_id, u.email,
      ISNULL(u.first_name,'') + ' ' + ISNULL(u.last_name,'') AS full_name
    FROM assignment_rules r
    LEFT JOIN users u ON r.assign_to_user = u.user_id AND u.is_active = 1
    WHERE r.is_active = 1
      AND (r.category_id IS NULL OR r.category_id = @catId)
      AND (r.priority_code IS NULL OR r.priority_code = @priCode)
    ORDER BY
      -- Most specific rules first
      CASE WHEN r.category_id IS NOT NULL AND r.priority_code IS NOT NULL THEN 0
           WHEN r.category_id IS NOT NULL THEN 1
           WHEN r.priority_code IS NOT NULL THEN 2
           ELSE 3 END ASC,
      r.priority_order ASC
  `, { catId: categoryId, priCode: priorityCode || '' });

  const rule = result.recordset?.[0];
  if (!rule) return null;

  // If rule points to a specific user, return them
  if (rule.assign_to_user && rule.user_id) {
    logger.info('Assignment rule matched — specific user', {
      ruleId: rule.rule_id, userId: rule.user_id
    });
    return { user_id: rule.user_id, email: rule.email, full_name: rule.full_name, method: 'skill_based_direct' };
  }

  // Rule uses method-based assignment (load_balanced etc.) — caller should fall through
  logger.info('Assignment rule matched — method delegation', { ruleId: rule.rule_id, method: rule.assign_method });
  return { method: rule.assign_method };
}

// ============================================================
// CREATE RULE
// ============================================================
async function createRule({ rule_name, category_id, priority_code, assign_to_user, assign_method = 'load_balanced', priority_order = 0, created_by }) {
  await ensureTable();
  if (!rule_name?.trim()) throw new Error('rule_name is required');

  const result = await executeQuery(`
    INSERT INTO assignment_rules (rule_name, category_id, priority_code, assign_to_user, assign_method, priority_order, created_by)
    OUTPUT INSERTED.rule_id
    VALUES (@name, @catId, @priCode, @assignUser, @method, @order, @createdBy)
  `, {
    name: rule_name.trim(),
    catId: category_id || null,
    priCode: priority_code || null,
    assignUser: assign_to_user || null,
    method: assign_method,
    order: priority_order,
    createdBy: created_by || null
  });

  return result.recordset[0]?.rule_id;
}

// ============================================================
// UPDATE RULE
// ============================================================
async function updateRule(ruleId, { rule_name, category_id, priority_code, assign_to_user, assign_method, priority_order, is_active }) {
  await ensureTable();
  await executeQuery(`
    UPDATE assignment_rules
    SET
      rule_name     = ISNULL(@name, rule_name),
      category_id   = CASE WHEN @catId IS NULL AND @clearCat = 0 THEN category_id ELSE @catId END,
      priority_code = CASE WHEN @priCode IS NULL AND @clearPri = 0 THEN priority_code ELSE @priCode END,
      assign_to_user = CASE WHEN @assignUser IS NULL AND @clearUser = 0 THEN assign_to_user ELSE @assignUser END,
      assign_method = ISNULL(@method, assign_method),
      priority_order= ISNULL(@order,  priority_order),
      is_active     = ISNULL(@active, is_active),
      updated_at    = GETUTCDATE()
    WHERE rule_id = @ruleId
  `, {
    ruleId,
    name: rule_name || null,
    catId: category_id !== undefined ? (category_id || null) : null,
    clearCat: category_id === undefined ? 1 : 0,
    priCode: priority_code !== undefined ? (priority_code || null) : null,
    clearPri: priority_code === undefined ? 1 : 0,
    assignUser: assign_to_user !== undefined ? (assign_to_user || null) : null,
    clearUser: assign_to_user === undefined ? 1 : 0,
    method: assign_method || null,
    order: priority_order !== undefined ? priority_order : null,
    active: is_active !== undefined ? (is_active ? 1 : 0) : null,
  });
}

// ============================================================
// DELETE RULE
// ============================================================
async function deleteRule(ruleId) {
  await ensureTable();
  await executeQuery('DELETE FROM assignment_rules WHERE rule_id = @id', { id: ruleId });
}

module.exports = { getRules, findEngineerByRules, createRule, updateRule, deleteRule };
