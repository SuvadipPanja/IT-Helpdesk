// ============================================
// BACKUP ROUTES
// API routes for backup management
// Developer: Suvadip Panja
// Date: January 30, 2026
// FILE: backend/routes/backup.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceLicensedFeature } = require('../middleware/license.middleware');
const {
  createBackup,
  getBackupHistory,
  getBackupById,
  deleteBackup,
  getBackupStatistics,
  downloadBackup,
  testBackupConfiguration,
  cleanupOldBackups,
  prepareRestore,
  executeRestore
} = require('../controllers/backup.controller');

// ============================================
// MULTER — ZIP uploads for restore-from-file
// Files land in BACKUP_ROOT so SQL Server can also access them
// ============================================
const BACKUP_ROOT = process.env.BACKUP_PATH || path.join(__dirname, '../../Data_Backup');

const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BACKUP_ROOT),
  filename:    (req, file, cb) => cb(null, `upload_temp_${Date.now()}.zip`)
});

const zipUpload = multer({
  storage: zipStorage,
  fileFilter: (req, file, cb) => {
    const isZip =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.toLowerCase().endsWith('.zip');
    if (isZip) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are accepted for restore'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5 GB max
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// All backup routes require authentication + admin permission
// ============================================
router.use(authenticate);
router.use(authorize('can_manage_settings_backup'));
router.use(enforceLicensedFeature('backup'));

// ============================================
// BACKUP ROUTES
// ============================================

/**
 * @route   POST /api/v1/backup/create
 * @desc    Create manual backup
 * @access  Private (Admin only - can_manage_system)
 * @body    None
 * @returns {Object} Backup details (ID, name, size, duration, etc.)
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup created successfully",
 *   data: {
 *     backupId: 3,
 *     backupName: "BACKUP_20260130_153045",
 *     backupPath: "D:/Project/it-helpdesk/Data_Backup/2026-01-30_15-30-45",
 *     databaseSizeMB: 126.50,
 *     filesSizeMB: 458.30,
 *     totalSizeMB: 584.80,
 *     filesCount: 1285,
 *     durationSeconds: 342
 *   }
 * }
 */
router.post('/create', createBackup);

/**
 * @route   POST /api/v1/backup/test
 * @desc    Test backup configuration
 * @access  Private (Admin only - can_manage_system)
 * @body    None
 * @returns {Object} Configuration test results
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup configuration test passed successfully",
 *   data: {
 *     backupEnabled: true,
 *     backupDirectory: "D:/Project/it-helpdesk/Data_Backup",
 *     backupDirectoryExists: true,
 *     backupDirectoryWritable: true,
 *     databaseConnection: true,
 *     uploadsDirectory: "D:/Project/it-helpdesk/backend/uploads",
 *     uploadsDirectoryExists: true,
 *     settings: { ... }
 *   }
 * }
 */
router.post('/test', testBackupConfiguration);

/**
 * @route   POST /api/v1/backup/cleanup
 * @desc    Manually trigger cleanup of old backups
 * @access  Private (Admin only - can_manage_system)
 * @body    None
 * @returns {Object} Cleanup results
 * @example Response:
 * {
 *   success: true,
 *   message: "Cleaned up 5 old backup(s)",
 *   data: {
 *     deletedCount: 5,
 *     retentionDays: 30
 *   }
 * }
 */
router.post('/cleanup', cleanupOldBackups);

/**
 * @route   GET /api/v1/backup/history
 * @desc    Get backup history with pagination
 * @access  Private (Admin only - can_manage_system)
 * @query   page (number, default: 1)
 * @query   limit (number, default: 20, max: 100)
 * @query   status (string, optional: "COMPLETED", "FAILED", "IN_PROGRESS")
 * @query   trigger (string, optional: "AUTOMATIC", "MANUAL")
 * @query   includeDeleted (boolean, default: false)
 * @returns {Object} Paginated backup list
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup history fetched successfully",
 *   data: {
 *     backups: [
 *       {
 *         backup_id: 3,
 *         backup_name: "BACKUP_20260130_153045",
 *         backup_type: "FULL",
 *         backup_trigger: "MANUAL",
 *         status: "COMPLETED",
 *         total_size_mb: 584.80,
 *         duration_seconds: 342,
 *         created_at: "2026-01-30T15:30:45.000Z",
 *         created_by_name: "Admin User"
 *       },
 *       ...
 *     ],
 *     pagination: {
 *       page: 1,
 *       limit: 20,
 *       total: 45,
 *       totalPages: 3
 *     }
 *   }
 * }
 */
router.get('/history', getBackupHistory);

/**
 * @route   GET /api/v1/backup/stats
 * @desc    Get backup statistics
 * @access  Private (Admin only - can_manage_system)
 * @returns {Object} Backup statistics
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup statistics fetched successfully",
 *   data: {
 *     total_backups: 45,
 *     completed_backups: 42,
 *     failed_backups: 2,
 *     in_progress_backups: 1,
 *     automatic_backups: 40,
 *     manual_backups: 5,
 *     total_size_mb: 25678.50,
 *     avg_duration_seconds: 325,
 *     last_backup_at: "2026-01-30T15:30:45.000Z"
 *   }
 * }
 */
router.get('/stats', getBackupStatistics);

/**
 * @route   GET /api/v1/backup/:id
 * @desc    Get backup details by ID
 * @access  Private (Admin only - can_manage_system)
 * @params  id (number) - Backup ID
 * @returns {Object} Backup details
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup details fetched successfully",
 *   data: {
 *     backup_id: 3,
 *     backup_name: "BACKUP_20260130_153045",
 *     backup_type: "FULL",
 *     backup_trigger: "MANUAL",
 *     backup_path: "D:/Project/it-helpdesk/Data_Backup/2026-01-30_15-30-45",
 *     database_backup_path: "D:/Project/.../database/ITHelpdesk_backup.bak",
 *     files_backup_path: "D:/Project/.../files",
 *     database_size_mb: 126.50,
 *     files_size_mb: 458.30,
 *     total_size_mb: 584.80,
 *     status: "COMPLETED",
 *     error_message: null,
 *     started_at: "2026-01-30T15:30:45.000Z",
 *     completed_at: "2026-01-30T15:36:27.000Z",
 *     duration_seconds: 342,
 *     files_count: 1285,
 *     database_included: true,
 *     files_included: true,
 *     created_by: 4,
 *     created_by_name: "Admin User",
 *     created_at: "2026-01-30T15:30:45.000Z",
 *     is_deleted: false,
 *     deleted_at: null
 *   }
 * }
 */
router.get('/:id', getBackupById);

/**
 * @route   GET /api/v1/backup/:id/download
 * @desc    Download backup as ZIP file
 * @access  Private (Admin only - can_manage_system)
 * @params  id (number) - Backup ID
 * @returns {File} ZIP file stream
 * @note    This endpoint streams a ZIP file directly to the client
 *          Content-Type: application/zip
 *          Content-Disposition: attachment; filename="BACKUP_20260130_153045.zip"
 */
router.get('/:id/download', downloadBackup);

/**
 * @route   DELETE /api/v1/backup/:id
 * @desc    Delete backup (files and database record)
 * @access  Private (Admin only - can_manage_system)
 * @params  id (number) - Backup ID
 * @returns {Object} Success message
 * @example Response:
 * {
 *   success: true,
 *   message: "Backup deleted successfully"
 * }
 */
router.delete('/:id', deleteBackup);

// ============================================
// RESTORE ROUTES
// ============================================

/**
 * @route   POST /api/v1/backup/restore/prepare
 * @desc    Prepare a restore session — returns a confirmation code that the
 *          admin must type back to authorise the destructive restore.
 * @access  Private (Admin only - can_manage_system)
 * @body    Option A (JSON):      { "backupId": 42 }
 * @body    Option B (multipart): field "backupFile" = backup ZIP (.zip)
 * @returns { token, confirmationCode, expiresIn, backupInfo }
 */
router.post('/restore/prepare', zipUpload.single('backupFile'), prepareRestore);

/**
 * @route   POST /api/v1/backup/restore/execute
 * @desc    Execute a previously prepared restore after confirmation code is entered.
 *          DESTRUCTIVE: replaces the entire database and all uploaded files.
 * @access  Private (Admin only - can_manage_system)
 * @body    { "token": "...", "confirmationCode": "ABCD1234" }
 * @returns { success: true, message: "..." }
 */
router.post('/restore/execute', executeRestore);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;