// ============================================================
// SNIPPETS CONTROLLER
// Response snippet templates for IT engineers.
// Auto-creates the response_snippets table if it doesn't exist.
// ============================================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// -------------------------
// Idempotent table setup
// -------------------------
async function ensureTable() {
  await executeQuery(
    `IF NOT EXISTS (
       SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME = 'response_snippets'
     )
     BEGIN
       CREATE TABLE response_snippets (
         snippet_id   INT IDENTITY(1,1) PRIMARY KEY,
         title        NVARCHAR(200)  NOT NULL,
         body         NVARCHAR(MAX)  NOT NULL,
         category     NVARCHAR(100)  NOT NULL DEFAULT 'General',
         shortcut     NVARCHAR(50)   NULL,
         is_shared    BIT            NOT NULL DEFAULT 1,
         created_by   INT            NOT NULL,
         created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
         updated_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
         CONSTRAINT FK_snippet_user FOREIGN KEY (created_by) REFERENCES users(user_id)
       );
       CREATE INDEX IX_snippets_category ON response_snippets(category);
       CREATE INDEX IX_snippets_shared   ON response_snippets(is_shared);
     END`
  );
}

// ============================================================
// GET /api/v1/snippets
// ============================================================
const getSnippets = async (req, res, next) => {
  try {
    await ensureTable();
    const userId = req.user.user_id;
    const { category, search } = req.query;

    let query = `
      SELECT
        s.snippet_id, s.title, s.body, s.category, s.shortcut,
        s.is_shared, s.created_by, s.created_at, s.updated_at,
        u.username AS created_by_name
      FROM response_snippets s
      LEFT JOIN users u ON u.user_id = s.created_by
      WHERE (s.is_shared = 1 OR s.created_by = @userId)
    `;
    const params = { userId };

    if (category) {
      query += ` AND s.category = @category`;
      params.category = category;
    }
    if (search) {
      query += ` AND (s.title LIKE @search OR s.body LIKE @search OR s.shortcut LIKE @search)`;
      params.search = `%${search}%`;
    }

    query += ` ORDER BY s.category, s.title`;

    const result = await executeQuery(query, params);
    res.json(createResponse(true, 'Snippets retrieved', { snippets: result.recordset }));
  } catch (err) {
    logger.error('getSnippets error', { error: err?.message });
    next(err);
  }
};

// ============================================================
// POST /api/v1/snippets
// ============================================================
const createSnippet = async (req, res, next) => {
  try {
    await ensureTable();
    const { title, body, category = 'General', shortcut = null, is_shared = true } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json(createResponse(false, 'title and body are required'));
    }

    const result = await executeQuery(
      `INSERT INTO response_snippets (title, body, category, shortcut, is_shared, created_by)
       OUTPUT INSERTED.*
       VALUES (@title, @body, @category, @shortcut, @isShared, @userId)`,
      {
        title: title.trim(),
        body: body.trim(),
        category: category?.trim() || 'General',
        shortcut: shortcut?.trim() || null,
        isShared: is_shared ? 1 : 0,
        userId: req.user.user_id,
      }
    );
    res.status(201).json(createResponse(true, 'Snippet created', result.recordset[0]));
  } catch (err) {
    logger.error('createSnippet error', { error: err?.message });
    next(err);
  }
};

// ============================================================
// PUT /api/v1/snippets/:id
// ============================================================
const updateSnippet = async (req, res, next) => {
  try {
    await ensureTable();
    const snippetId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const isAdmin = req.user.role_name?.toUpperCase() === 'ADMIN';

    const existing = await executeQuery(
      `SELECT snippet_id, created_by FROM response_snippets WHERE snippet_id = @snippetId`,
      { snippetId }
    );
    if (!existing.recordset.length) {
      return res.status(404).json(createResponse(false, 'Snippet not found'));
    }
    if (existing.recordset[0].created_by !== userId && !isAdmin) {
      return res.status(403).json(createResponse(false, 'Not authorised to edit this snippet'));
    }

    const { title, body, category, shortcut, is_shared } = req.body;
    await executeQuery(
      `UPDATE response_snippets
       SET title      = COALESCE(@title, title),
           body       = COALESCE(@body, body),
           category   = COALESCE(@category, category),
           shortcut   = @shortcut,
           is_shared  = COALESCE(@isShared, is_shared),
           updated_at = GETUTCDATE()
       WHERE snippet_id = @snippetId`,
      {
        title: title?.trim() || null,
        body: body?.trim() || null,
        category: category?.trim() || null,
        shortcut: shortcut?.trim() || null,
        isShared: is_shared !== undefined ? (is_shared ? 1 : 0) : null,
        snippetId,
      }
    );
    res.json(createResponse(true, 'Snippet updated'));
  } catch (err) {
    logger.error('updateSnippet error', { error: err?.message });
    next(err);
  }
};

// ============================================================
// DELETE /api/v1/snippets/:id
// ============================================================
const deleteSnippet = async (req, res, next) => {
  try {
    await ensureTable();
    const snippetId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const isAdmin = req.user.role_name?.toUpperCase() === 'ADMIN';

    const existing = await executeQuery(
      `SELECT snippet_id, created_by FROM response_snippets WHERE snippet_id = @snippetId`,
      { snippetId }
    );
    if (!existing.recordset.length) {
      return res.status(404).json(createResponse(false, 'Snippet not found'));
    }
    if (existing.recordset[0].created_by !== userId && !isAdmin) {
      return res.status(403).json(createResponse(false, 'Not authorised to delete this snippet'));
    }

    await executeQuery(
      `DELETE FROM response_snippets WHERE snippet_id = @snippetId`,
      { snippetId }
    );
    res.json(createResponse(true, 'Snippet deleted'));
  } catch (err) {
    logger.error('deleteSnippet error', { error: err?.message });
    next(err);
  }
};

module.exports = { getSnippets, createSnippet, updateSnippet, deleteSnippet };
