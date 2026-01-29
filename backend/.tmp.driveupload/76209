// ============================================
// BACKUP SERVICE
// Core backup logic for database and file backups
// Developer: Suvadip Panja
// Date: January 30, 2026
// FILE: backend/services/backup.service.js
// ============================================

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');

// ============================================
// BACKUP CONFIGURATION
// ============================================
const BACKUP_ROOT = path.join(__dirname, '../../Data_Backup');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_ROOT)) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  logger.info('Created backup root directory', { path: BACKUP_ROOT });
}

// ============================================
// CREATE BACKUP (MAIN FUNCTION)
// ============================================
const createBackup = async (trigger = 'AUTOMATIC', userId = null) => {
  const startTime = Date.now();
  let backupId = null;

  try {
    logger.separator('BACKUP CREATION');
    logger.try('Starting backup process', { trigger, userId });

    // ============================================
    // STEP 1: LOAD SETTINGS
    // ============================================
    logger.try('Loading backup settings from database');
    const settings = await settingsService.getByCategory('backup');

    const backupEnabled = settings.backup_enabled === 'true' || settings.backup_enabled === true;

    if (!backupEnabled) {
      logger.warn('Backup is disabled in settings');
      return {
        success: false,
        message: 'Backup is disabled in system settings'
      };
    }

    logger.success('Backup settings loaded', {
      enabled: backupEnabled,
      frequency: settings.backup_frequency,
      retentionDays: settings.backup_retention_days
    });

    // ============================================
    // STEP 2: CREATE BACKUP DIRECTORY
    // ============================================
    const timestamp = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .substring(0, 19);

    const backupName = `BACKUP_${timestamp.replace(/[-_]/g, '').replace(/T/, '_')}`;
    const backupDir = path.join(BACKUP_ROOT, timestamp);
    const databaseDir = path.join(backupDir, 'database');
    const filesDir = path.join(backupDir, 'files');

    logger.try('Creating backup directories', { backupDir });

    // Create directories
    await fsPromises.mkdir(backupDir, { recursive: true });
    await fsPromises.mkdir(databaseDir, { recursive: true });
    await fsPromises.mkdir(filesDir, { recursive: true });

    logger.success('Backup directories created');

    // ============================================
    // STEP 3: INSERT BACKUP RECORD (IN_PROGRESS)
    // ============================================
    logger.try('Creating backup record in database');

    const insertQuery = `
      INSERT INTO backup_history (
        backup_name,
        backup_type,
        backup_trigger,
        backup_path,
        status,
        started_at,
        database_included,
        files_included,
        created_by
      )
      OUTPUT INSERTED.backup_id
      VALUES (
        @backupName,
        'FULL',
        @trigger,
        @backupPath,
        'IN_PROGRESS',
        GETDATE(),
        1,
        1,
        @userId
      )
    `;

    const result = await executeQuery(insertQuery, {
      backupName,
      trigger,
      backupPath: backupDir,
      userId: userId || null
    });

    backupId = result.recordset[0].backup_id;
    logger.success('Backup record created', { backupId });

    // ============================================
    // STEP 4: BACKUP DATABASE
    // ============================================
    logger.try('Starting database backup');

    const databaseBackupPath = path.join(databaseDir, 'ITHelpdesk_backup.bak');
    const databaseSizeMB = await backupDatabase(databaseBackupPath);

    logger.success('Database backup completed', {
      path: databaseBackupPath,
      sizeMB: databaseSizeMB
    });

    // ============================================
    // STEP 5: BACKUP FILES
    // ============================================
    logger.try('Starting file backup');

    const uploadsDir = path.join(__dirname, '../uploads');
    const fileBackupResult = await backupFiles(uploadsDir, filesDir);

    logger.success('File backup completed', {
      filesCount: fileBackupResult.filesCount,
      sizeMB: fileBackupResult.sizeMB
    });

    // ============================================
    // STEP 6: CREATE METADATA FILE
    // ============================================
    const metadata = {
      backupName,
      backupId,
      trigger,
      timestamp,
      database: {
        included: true,
        path: databaseBackupPath,
        sizeMB: databaseSizeMB
      },
      files: {
        included: true,
        path: filesDir,
        count: fileBackupResult.filesCount,
        sizeMB: fileBackupResult.sizeMB
      },
      total: {
        sizeMB: databaseSizeMB + fileBackupResult.sizeMB
      },
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    const metadataPath = path.join(backupDir, 'metadata.json');
    await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    logger.success('Metadata file created', { path: metadataPath });

    // ============================================
    // STEP 7: UPDATE BACKUP RECORD (COMPLETED)
    // ============================================
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const totalSizeMB = databaseSizeMB + fileBackupResult.sizeMB;

    const updateQuery = `
      UPDATE backup_history
      SET 
        database_backup_path = @databasePath,
        files_backup_path = @filesPath,
        database_size_mb = @databaseSizeMB,
        files_size_mb = @filesSizeMB,
        total_size_mb = @totalSizeMB,
        files_count = @filesCount,
        status = 'COMPLETED',
        completed_at = GETDATE(),
        duration_seconds = @durationSeconds
      WHERE backup_id = @backupId
    `;

    await executeQuery(updateQuery, {
      backupId,
      databasePath: databaseBackupPath,
      filesPath: filesDir,
      databaseSizeMB,
      filesSizeMB: fileBackupResult.sizeMB,
      totalSizeMB,
      filesCount: fileBackupResult.filesCount,
      durationSeconds
    });

    logger.success('Backup record updated to COMPLETED');

    // ============================================
    // STEP 8: CLEANUP OLD BACKUPS
    // ============================================
    logger.try('Cleaning up old backups');
    const retentionDays = parseInt(settings.backup_retention_days) || 30;
    await cleanupOldBackups(retentionDays);

    logger.separator();
    logger.success('✅ BACKUP COMPLETED SUCCESSFULLY', {
      backupId,
      backupName,
      durationSeconds,
      totalSizeMB: totalSizeMB.toFixed(2),
      filesCount: fileBackupResult.filesCount
    });
    logger.separator();

    return {
      success: true,
      message: 'Backup created successfully',
      data: {
        backupId,
        backupName,
        backupPath: backupDir,
        databaseSizeMB,
        filesSizeMB: fileBackupResult.sizeMB,
        totalSizeMB,
        filesCount: fileBackupResult.filesCount,
        durationSeconds
      }
    };

  } catch (error) {
    logger.error('Backup creation failed', error);

    // Update backup record to FAILED if backupId exists
    if (backupId) {
      try {
        const failQuery = `
          UPDATE backup_history
          SET 
            status = 'FAILED',
            error_message = @errorMessage,
            completed_at = GETDATE(),
            duration_seconds = @durationSeconds
          WHERE backup_id = @backupId
        `;

        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

        await executeQuery(failQuery, {
          backupId,
          errorMessage: error.message || 'Unknown error',
          durationSeconds
        });

        logger.info('Backup record updated to FAILED');
      } catch (updateError) {
        logger.error('Failed to update backup record status', updateError);
      }
    }

    throw error;
  }
};

// ============================================
// BACKUP DATABASE (SQL SERVER)
// ============================================
const backupDatabase = async (backupPath) => {
  try {
    logger.try('Executing SQL Server BACKUP command');

    // Normalize path for SQL Server (use forward slashes or double backslashes)
    const normalizedPath = backupPath.replace(/\\/g, '\\\\');

    const backupQuery = `
      BACKUP DATABASE [ITHelpdesk]
      TO DISK = '${normalizedPath}'
      WITH FORMAT,
           COMPRESSION,
           STATS = 10,
           NAME = 'Full Backup of ITHelpdesk'
    `;

    await executeQuery(backupQuery);

    // Get backup file size
    const stats = await fsPromises.stat(backupPath);
    const sizeMB = parseFloat((stats.size / (1024 * 1024)).toFixed(2));

    logger.success('Database backup completed', {
      path: backupPath,
      sizeMB
    });

    return sizeMB;

  } catch (error) {
    logger.error('Database backup failed', error);
    throw new Error(`Database backup failed: ${error.message}`);
  }
};

// ============================================
// BACKUP FILES (COPY UPLOADS DIRECTORY)
// ============================================
const backupFiles = async (sourceDir, targetDir) => {
  try {
    logger.try('Copying files from uploads directory', { sourceDir, targetDir });

    let filesCount = 0;
    let totalSize = 0;

    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      logger.warn('Source directory does not exist', { sourceDir });
      return { filesCount: 0, sizeMB: 0 };
    }

    // Recursive copy function
    const copyRecursive = async (src, dest) => {
      const entries = await fsPromises.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await fsPromises.mkdir(destPath, { recursive: true });
          await copyRecursive(srcPath, destPath);
        } else {
          await fsPromises.copyFile(srcPath, destPath);
          const stats = await fsPromises.stat(srcPath);
          totalSize += stats.size;
          filesCount++;
        }
      }
    };

    await copyRecursive(sourceDir, targetDir);

    const sizeMB = parseFloat((totalSize / (1024 * 1024)).toFixed(2));

    logger.success('Files copied successfully', { filesCount, sizeMB });

    return {
      filesCount,
      sizeMB
    };

  } catch (error) {
    logger.error('File backup failed', error);
    throw new Error(`File backup failed: ${error.message}`);
  }
};

// ============================================
// CLEANUP OLD BACKUPS
// ============================================
const cleanupOldBackups = async (retentionDays = 30) => {
  try {
    logger.try('Cleaning up backups older than retention period', { retentionDays });

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get old backups from database
    const query = `
      SELECT 
        backup_id,
        backup_name,
        backup_path,
        created_at
      FROM backup_history
      WHERE created_at < @cutoffDate
        AND is_deleted = 0
        AND status = 'COMPLETED'
      ORDER BY created_at ASC
    `;

    const result = await executeQuery(query, { cutoffDate });
    const oldBackups = result.recordset;

    if (oldBackups.length === 0) {
      logger.info('No old backups to clean up');
      return 0;
    }

    logger.info(`Found ${oldBackups.length} old backups to delete`);

    let deletedCount = 0;

    for (const backup of oldBackups) {
      try {
        // Delete physical backup directory
        if (fs.existsSync(backup.backup_path)) {
          await fsPromises.rm(backup.backup_path, { recursive: true, force: true });
          logger.info('Deleted backup directory', {
            backupId: backup.backup_id,
            path: backup.backup_path
          });
        }

        // Mark as deleted in database
        const deleteQuery = `
          UPDATE backup_history
          SET 
            is_deleted = 1,
            deleted_at = GETDATE()
          WHERE backup_id = @backupId
        `;

        await executeQuery(deleteQuery, { backupId: backup.backup_id });

        deletedCount++;

      } catch (deleteError) {
        logger.error('Failed to delete backup', {
          backupId: backup.backup_id,
          error: deleteError.message
        });
      }
    }

    logger.success(`Cleaned up ${deletedCount} old backups`);

    return deletedCount;

  } catch (error) {
    logger.error('Cleanup old backups failed', error);
    throw error;
  }
};

// ============================================
// GET BACKUP HISTORY
// ============================================
const getBackupHistory = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = null,
      trigger = null,
      includeDeleted = false
    } = options;

    const offset = (page - 1) * limit;

    logger.try('Fetching backup history', { page, limit, status, trigger });

    // Build WHERE clause
    let whereConditions = [];
    let params = { limit, offset };

    if (!includeDeleted) {
      whereConditions.push('is_deleted = 0');
    }

    if (status) {
      whereConditions.push('status = @status');
      params.status = status;
    }

    if (trigger) {
      whereConditions.push('backup_trigger = @trigger');
      params.trigger = trigger;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM backup_history
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const total = countResult.recordset[0].total;

    // Get backups
    const query = `
      SELECT 
        b.backup_id,
        b.backup_name,
        b.backup_type,
        b.backup_trigger,
        b.backup_path,
        b.database_backup_path,
        b.files_backup_path,
        b.database_size_mb,
        b.files_size_mb,
        b.total_size_mb,
        b.status,
        b.error_message,
        b.started_at,
        b.completed_at,
        b.duration_seconds,
        b.files_count,
        b.database_included,
        b.files_included,
        b.created_by,
        b.created_at,
        CASE 
          WHEN b.created_by IS NOT NULL 
          THEN u.first_name + ' ' + u.last_name 
          ELSE 'System (Automatic)' 
        END as created_by_name
      FROM backup_history b
      LEFT JOIN users u ON b.created_by = u.user_id
      ${whereClause}
      ORDER BY b.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, params);

    logger.success('Backup history fetched', {
      total,
      returned: result.recordset.length
    });

    return {
      backups: result.recordset,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    logger.error('Get backup history failed', error);
    throw error;
  }
};

// ============================================
// GET BACKUP BY ID
// ============================================
const getBackupById = async (backupId) => {
  try {
    logger.try('Fetching backup by ID', { backupId });

    const query = `
      SELECT 
        b.backup_id,
        b.backup_name,
        b.backup_type,
        b.backup_trigger,
        b.backup_path,
        b.database_backup_path,
        b.files_backup_path,
        b.database_size_mb,
        b.files_size_mb,
        b.total_size_mb,
        b.status,
        b.error_message,
        b.started_at,
        b.completed_at,
        b.duration_seconds,
        b.files_count,
        b.database_included,
        b.files_included,
        b.created_by,
        b.created_at,
        b.is_deleted,
        b.deleted_at,
        CASE 
          WHEN b.created_by IS NOT NULL 
          THEN u.first_name + ' ' + u.last_name 
          ELSE 'System (Automatic)' 
        END as created_by_name
      FROM backup_history b
      LEFT JOIN users u ON b.created_by = u.user_id
      WHERE b.backup_id = @backupId
    `;

    const result = await executeQuery(query, { backupId });

    if (result.recordset.length === 0) {
      throw new Error('Backup not found');
    }

    logger.success('Backup fetched', { backupId });

    return result.recordset[0];

  } catch (error) {
    logger.error('Get backup by ID failed', error);
    throw error;
  }
};

// ============================================
// DELETE BACKUP
// ============================================
const deleteBackup = async (backupId, userId = null) => {
  try {
    logger.try('Deleting backup', { backupId, userId });

    // Get backup details
    const backup = await getBackupById(backupId);

    if (backup.is_deleted) {
      throw new Error('Backup is already deleted');
    }

    // Delete physical backup directory
    if (fs.existsSync(backup.backup_path)) {
      await fsPromises.rm(backup.backup_path, { recursive: true, force: true });
      logger.success('Deleted backup directory', { path: backup.backup_path });
    }

    // Mark as deleted in database
    const deleteQuery = `
      UPDATE backup_history
      SET 
        is_deleted = 1,
        deleted_at = GETDATE(),
        deleted_by = @userId
      WHERE backup_id = @backupId
    `;

    await executeQuery(deleteQuery, { backupId, userId });

    logger.success('Backup deleted successfully', { backupId });

    return {
      success: true,
      message: 'Backup deleted successfully'
    };

  } catch (error) {
    logger.error('Delete backup failed', error);
    throw error;
  }
};

// ============================================
// GET BACKUP STATISTICS
// ============================================
const getBackupStatistics = async () => {
  try {
    logger.try('Fetching backup statistics');

    const query = `
      SELECT 
        COUNT(*) as total_backups,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_backups,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_backups,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_backups,
        SUM(CASE WHEN backup_trigger = 'AUTOMATIC' THEN 1 ELSE 0 END) as automatic_backups,
        SUM(CASE WHEN backup_trigger = 'MANUAL' THEN 1 ELSE 0 END) as manual_backups,
        ISNULL(SUM(total_size_mb), 0) as total_size_mb,
        ISNULL(AVG(duration_seconds), 0) as avg_duration_seconds,
        MAX(created_at) as last_backup_at
      FROM backup_history
      WHERE is_deleted = 0
    `;

    const result = await executeQuery(query);
    const stats = result.recordset[0];

    logger.success('Backup statistics fetched');

    return stats;

  } catch (error) {
    logger.error('Get backup statistics failed', error);
    throw error;
  }
};

// ============================================
// EXPORT SERVICE METHODS
// ============================================
module.exports = {
  createBackup,
  getBackupHistory,
  getBackupById,
  deleteBackup,
  cleanupOldBackups,
  getBackupStatistics,
  BACKUP_ROOT
};