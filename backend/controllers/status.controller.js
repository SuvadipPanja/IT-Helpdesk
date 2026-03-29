// ============================================
// STATUS CONTROLLER
// Manages known incident banners / service status
// Public GET so end-users can see without auth
// Admin/IT Staff can create, update, resolve
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// ENSURE TABLE EXISTS (idempotent)
// ============================================
const ensureTable = async () => {
  await executeQuery(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'incident_banners')
    BEGIN
      CREATE TABLE incident_banners (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        title        NVARCHAR(255)     NOT NULL,
        description  NVARCHAR(2000)    NOT NULL,
        severity     NVARCHAR(20)      NOT NULL DEFAULT 'medium'
                       CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
        status       NVARCHAR(20)      NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'monitoring', 'resolved')),
        affected_services NVARCHAR(500) NULL,
        created_by   INT               NOT NULL,
        created_at   DATETIME          NOT NULL DEFAULT GETDATE(),
        updated_at   DATETIME          NOT NULL DEFAULT GETDATE(),
        resolved_at  DATETIME          NULL
      );
      CREATE INDEX IX_incident_banners_status ON incident_banners(status);
    END
  `);
};

// ============================================
// GET ACTIVE INCIDENTS (Public — no auth)
// ============================================
const getActiveIncidents = async (req, res) => {
  try {
    await ensureTable();
    const result = await executeQuery(`
      SELECT id, title, description, severity, status, affected_services,
             created_at, updated_at, resolved_at
      FROM incident_banners
      WHERE status IN ('active', 'monitoring')
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          WHEN 'medium'   THEN 3
          WHEN 'low'      THEN 4
          ELSE 5
        END,
        created_at DESC
    `);
    return res.json({
      success: true,
      data: { incidents: result.recordset || [] },
    });
  } catch (err) {
    logger.error('getActiveIncidents error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================
// GET ALL INCIDENTS (Admin/Staff)
// ============================================
const getAllIncidents = async (req, res) => {
  try {
    await ensureTable();
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const result = await executeQuery(`
      SELECT i.id, i.title, i.description, i.severity, i.status,
             i.affected_services, i.created_at, i.updated_at, i.resolved_at,
             ISNULL(u.first_name,'') + ' ' + ISNULL(u.last_name,'') AS created_by_name, u.username AS created_by_username
      FROM incident_banners i
      LEFT JOIN users u ON u.user_id = i.created_by
      ORDER BY i.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    const countRes = await executeQuery('SELECT COUNT(*) AS total FROM incident_banners');
    const total = countRes.recordset[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        incidents: result.recordset || [],
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error('getAllIncidents error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================
// CREATE INCIDENT
// ============================================
const createIncident = async (req, res) => {
  try {
    await ensureTable();
    const { title, description, severity = 'medium', affected_services } = req.body;
    const userId = req.user.user_id || req.user.id;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'title and description are required',
      });
    }

    const result = await executeQuery(`
      INSERT INTO incident_banners (title, description, severity, status, affected_services, created_by)
      OUTPUT INSERTED.*
      VALUES (@title, @description, @severity, 'active', @affected_services, @created_by)
    `, {
      title: title.trim().substring(0, 255),
      description: description.trim().substring(0, 2000),
      severity: ['info','low','medium','high','critical'].includes(severity) ? severity : 'medium',
      affected_services: affected_services ? String(affected_services).substring(0, 500) : null,
      created_by: userId,
    });

    logger.info('Incident banner created', { title, userId });
    return res.status(201).json({
      success: true,
      message: 'Incident created',
      data: result.recordset[0],
    });
  } catch (err) {
    logger.error('createIncident error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================
// UPDATE INCIDENT (resolve, change severity, etc.)
// ============================================
const updateIncident = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { title, description, severity, status, affected_services } = req.body;

    const existing = await executeQuery(
      'SELECT id FROM incident_banners WHERE id = @id',
      { id: parseInt(id) }
    );
    if (!existing.recordset?.length) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    const resolvedAt = status === 'resolved' ? 'GETDATE()' : 'NULL';

    await executeQuery(`
      UPDATE incident_banners
      SET title             = COALESCE(@title, title),
          description       = COALESCE(@description, description),
          severity          = COALESCE(@severity, severity),
          status            = COALESCE(@status, status),
          affected_services = COALESCE(@affected_services, affected_services),
          updated_at        = GETDATE(),
          resolved_at       = CASE WHEN @status = 'resolved' THEN GETDATE() ELSE resolved_at END
      WHERE id = @id
    `, {
      id: parseInt(id),
      title: title ? title.trim().substring(0, 255) : null,
      description: description ? description.trim().substring(0, 2000) : null,
      severity: severity || null,
      status: status || null,
      affected_services: affected_services ? String(affected_services).substring(0, 500) : null,
    });

    logger.info('Incident banner updated', { id, status });
    return res.json({ success: true, message: 'Incident updated' });
  } catch (err) {
    logger.error('updateIncident error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================
// DELETE INCIDENT (Admin only)
// ============================================
const deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM incident_banners WHERE id = @id', { id: parseInt(id) });
    return res.json({ success: true, message: 'Incident deleted' });
  } catch (err) {
    logger.error('deleteIncident error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getActiveIncidents,
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
};
