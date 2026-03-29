// ============================================
// RESTORE SERVICE
// Handles database and file restore operations
// with two-phase confirmation (token + code)
// Developer: Suvadip Panja
// Date: January 30, 2026
// FILE: backend/services/restore.service.js
// ============================================

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const sql = require('mssql');
const { executeQuery, closePool } = require('../config/database');
const config = require('../config/config');
const logger = require('../utils/logger');

const BACKUP_ROOT = process.env.BACKUP_PATH || path.join(__dirname, '../../Data_Backup');

// ============================================
// IN-MEMORY PENDING RESTORE SESSIONS
// token -> { confirmationCode, expiresAt, bakPath, filesPath, tempDir, backupInfo }
// ============================================
const pendingRestores = new Map();

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingRestores.entries()) {
    if (data.expiresAt < now) {
      if (data.tempDir && fs.existsSync(data.tempDir)) {
        fs.rm(data.tempDir, { recursive: true, force: true }, () => {});
      }
      pendingRestores.delete(token);
      logger.info('Expired restore token cleaned up');
    }
  }
}, 60 * 1000);

// ============================================
// HELPERS
// ============================================

// 8-char alphanumeric code (no ambiguous chars: 0/O, 1/I/L)
const generateConfirmationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

const generateToken = () => crypto.randomBytes(32).toString('hex');

// ============================================
// PREPARE RESTORE — from server-side backup ID
// ============================================
const prepareRestoreFromBackupId = async (backupId) => {
  const query = `
    SELECT
      backup_id, backup_name, backup_path,
      database_backup_path, files_backup_path,
      status, completed_at, total_size_mb, files_count
    FROM backup_history
    WHERE backup_id = @backupId AND is_deleted = 0
  `;

  const result = await executeQuery(query, { backupId });

  if (!result.recordset || result.recordset.length === 0) {
    throw new Error('Backup not found');
  }

  const backup = result.recordset[0];

  if (backup.status !== 'COMPLETED') {
    throw new Error('Only completed backups can be restored');
  }

  if (!backup.database_backup_path || !fs.existsSync(backup.database_backup_path)) {
    throw new Error('Database backup file not found on server. The backup file may have been deleted.');
  }

  const token = generateToken();
  const confirmationCode = generateConfirmationCode();

  pendingRestores.set(token, {
    confirmationCode,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    bakPath: backup.database_backup_path,
    filesPath: backup.files_backup_path || null,
    tempDir: null,
    backupInfo: {
      backupId: backup.backup_id,
      backupName: backup.backup_name,
      backupDate: backup.completed_at,
      totalSizeMB: backup.total_size_mb,
      filesCount: backup.files_count
    }
  });

  logger.info('Restore session prepared from server-side backup', { backupId });

  return {
    token,
    confirmationCode,
    expiresIn: 600,
    backupInfo: {
      backupId: backup.backup_id,
      backupName: backup.backup_name,
      backupDate: backup.completed_at,
      totalSizeMB: backup.total_size_mb,
      filesCount: backup.files_count
    }
  };
};

// ============================================
// PREPARE RESTORE — from uploaded ZIP file
// ============================================
const prepareRestoreFromZip = async (zipFilePath) => {
  // Validate zipFilePath is within BACKUP_ROOT (security: prevent path traversal)
  if (!path.resolve(zipFilePath).startsWith(path.resolve(BACKUP_ROOT))) {
    await fsPromises.unlink(zipFilePath).catch(() => {});
    throw new Error('Security violation: invalid upload path');
  }

  const tempDirName = `restore_temp_${Date.now()}`;
  const tempDir = path.join(BACKUP_ROOT, tempDirName);

  try {
    await fsPromises.mkdir(tempDir, { recursive: true });

    // Extract ZIP
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(tempDir, true);

    // Remove the uploaded ZIP file after extraction
    await fsPromises.unlink(zipFilePath).catch(() => {});

    // Validate metadata.json
    const metadataPath = path.join(tempDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Invalid backup file: metadata.json not found. This does not appear to be a valid backup.');
    }

    let metadata = {};
    try {
      metadata = JSON.parse(await fsPromises.readFile(metadataPath, 'utf8'));
    } catch {
      throw new Error('Invalid backup file: metadata.json is corrupted or unreadable.');
    }

    // Find .bak database backup file
    const files = await fsPromises.readdir(tempDir);
    const bakFile = files.find((f) => f.endsWith('.bak'));
    if (!bakFile) {
      throw new Error('Invalid backup file: no database backup (.bak) file found in the archive.');
    }

    const bakPath = path.join(tempDir, bakFile);
    const filesPath = path.join(tempDir, 'files');

    const token = generateToken();
    const confirmationCode = generateConfirmationCode();

    pendingRestores.set(token, {
      confirmationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      bakPath,
      filesPath: fs.existsSync(filesPath) ? filesPath : null,
      tempDir,
      backupInfo: {
        backupId: metadata.backupId || null,
        backupName: metadata.backupName || bakFile.replace('.bak', ''),
        backupDate: metadata.createdAt || null,
        totalSizeMB: metadata.total?.sizeMB || null,
        filesCount: metadata.files?.count || null
      }
    });

    logger.info('Restore session prepared from uploaded ZIP', { bakFile });

    return {
      token,
      confirmationCode,
      expiresIn: 600,
      backupInfo: {
        backupId: metadata.backupId || null,
        backupName: metadata.backupName || bakFile.replace('.bak', ''),
        backupDate: metadata.createdAt || null,
        totalSizeMB: metadata.total?.sizeMB || null,
        filesCount: metadata.files?.count || null
      }
    };
  } catch (error) {
    // Clean up
    if (fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    await fsPromises.unlink(zipFilePath).catch(() => {});
    throw error;
  }
};

// ============================================
// EXECUTE RESTORE
// ============================================
const executeRestore = async (token, confirmationCode) => {
  const pending = pendingRestores.get(token);

  if (!pending) {
    throw new Error('Invalid or expired restore session. Please start the restore process again.');
  }

  if (Date.now() > pending.expiresAt) {
    pendingRestores.delete(token);
    if (pending.tempDir && fs.existsSync(pending.tempDir)) {
      await fsPromises.rm(pending.tempDir, { recursive: true, force: true }).catch(() => {});
    }
    throw new Error('Restore session has expired (10 minute limit). Please start the restore process again.');
  }

  if (pending.confirmationCode !== confirmationCode.toUpperCase().trim()) {
    throw new Error('Incorrect confirmation code. Please check and try again.');
  }

  // One-time use — remove immediately
  pendingRestores.delete(token);

  const { bakPath, filesPath, tempDir, backupInfo } = pending;

  // Safety: ensure bakPath is within BACKUP_ROOT
  if (!path.resolve(bakPath).startsWith(path.resolve(BACKUP_ROOT))) {
    if (tempDir && fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    throw new Error('Security violation: backup path is outside the allowed directory');
  }

  try {
    logger.separator('RESTORE EXECUTION');
    logger.try('Starting restore', { backupName: backupInfo.backupName });

    // ============================================
    // STEP 1: RESTORE DATABASE
    // ============================================
    await restoreDatabase(bakPath);
    logger.success('Database restored successfully');

    // ============================================
    // STEP 2: RESTORE FILES (if available)
    // ============================================
    if (filesPath && fs.existsSync(filesPath)) {
      logger.try('Restoring upload files');
      await restoreFiles(filesPath);
      logger.success('Files restored successfully');
    } else {
      logger.warn('No files backup available — skipping file restore');
    }

    // ============================================
    // STEP 3: CLEAN UP TEMP DIR (uploaded ZIP case)
    // ============================================
    if (tempDir && fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      logger.info('Temp restore directory removed');
    }

    logger.separator();
    logger.success('✅ RESTORE COMPLETED SUCCESSFULLY', { backupName: backupInfo.backupName });
    logger.separator();

    return {
      success: true,
      message: 'System restored successfully. All active sessions have been invalidated — all users must log in again.'
    };

  } catch (error) {
    // Best-effort cleanup
    if (tempDir && fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    logger.error('Restore execution failed', error);
    throw error;
  }
};

// ============================================
// RESTORE DATABASE (dedicated master connection)
// ============================================
const restoreDatabase = async (bakPath) => {
  // Forward slashes for SQL Server
  const sqlPath = bakPath.replace(/\\/g, '/');

  logger.try('Restoring database', { sqlPath });

  // STEP 1: Close main app pool FIRST — prevents the pool from re-acquiring
  // connections to ITHelpdesk while we're trying to restore it.
  try {
    await closePool();
    logger.info('Main connection pool closed before restore');
  } catch (e) {
    logger.warn('Could not close main pool (may already be closed)', e.message);
  }

  // Brief pause to let the OS fully release existing DB connections
  await new Promise((r) => setTimeout(r, 1000));

  const masterConfig = {
    server: config.database.server,
    database: 'master',
    user: config.database.user,
    password: config.database.password,
    port: config.database.port,
    options: {
      ...config.database.options,
      requestTimeout: 600000  // 10 minutes for large restores
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 10000 }
  };

  // Use an isolated ConnectionPool (NOT sql.connect which shares global state)
  const masterPool = new sql.ConnectionPool(masterConfig);

  try {
    await masterPool.connect();
    logger.info('Connected to master database');

    // Terminate any remaining connections to ITHelpdesk
    await masterPool.request().query(
      `ALTER DATABASE [ITHelpdesk] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`
    );
    logger.info('Database set to SINGLE_USER mode — all existing sessions terminated');

    // Give SQL Server a moment to fully close sessions
    await new Promise((r) => setTimeout(r, 1000));

    // Execute the restore
    logger.try('Executing RESTORE DATABASE command');
    await masterPool.request().query(
      `RESTORE DATABASE [ITHelpdesk] FROM DISK = N'${sqlPath}' WITH REPLACE, RECOVERY, STATS = 10`
    );
    logger.success('RESTORE DATABASE command completed');

    // Set back to MULTI_USER
    await masterPool.request().query(`ALTER DATABASE [ITHelpdesk] SET MULTI_USER`);
    logger.info('Database set back to MULTI_USER mode');

  } finally {
    try { await masterPool.close(); } catch (_) {}
    logger.info('Master connection closed after restore');
  }
};

// ============================================
// RESTORE FILES (backup files/ → app uploads/)
// ============================================
const restoreFiles = async (filesBackupPath) => {
  const uploadsDir = path.join(__dirname, '../uploads');

  // Clear current uploads
  logger.try('Clearing current uploads directory');
  if (fs.existsSync(uploadsDir)) {
    const entries = await fsPromises.readdir(uploadsDir);
    for (const entry of entries) {
      await fsPromises.rm(path.join(uploadsDir, entry), { recursive: true, force: true });
    }
  } else {
    await fsPromises.mkdir(uploadsDir, { recursive: true });
  }
  logger.info('Uploads directory cleared');

  // Copy from backup
  await copyDirRecursive(filesBackupPath, uploadsDir);
  logger.success('Files restored to uploads directory');
};

const copyDirRecursive = async (src, dest) => {
  const entries = await fsPromises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fsPromises.mkdir(destPath, { recursive: true });
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fsPromises.copyFile(srcPath, destPath);
    }
  }
};

module.exports = {
  prepareRestoreFromBackupId,
  prepareRestoreFromZip,
  executeRestore
};
