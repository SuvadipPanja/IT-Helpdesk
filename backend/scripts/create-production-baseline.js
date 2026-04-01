const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

const sourceDbName = process.env.DB_NAME || 'ITHelpdesk';
const baselineDbName = process.env.BASELINE_DB_NAME || `${sourceDbName}_ProdBaseline`;
const seedDir = path.resolve(__dirname, '../../docker/db/seed');
const sourceBackupPath = path.join(seedDir, `${sourceDbName}-source-temp.bak`);
const finalBackupPath = path.join(seedDir, `${sourceDbName}-baseline.bak`);

const preferredAdminUsername = process.env.BASELINE_KEEP_ADMIN_USERNAME || 'admin';

const connectionConfig = {
  server: process.env.DB_SERVER,
  database: sourceDbName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const escapeSqlString = (value) => String(value).replace(/'/g, "''");

const writeLine = (message) => process.stdout.write(`${message}\n`);

async function withConnection(database, callback) {
  const pool = new sql.ConnectionPool({ ...connectionConfig, database });
  await pool.connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
}

async function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

async function tableExists(pool, tableName) {
  const request = pool.request();
  request.input('tableName', sql.NVarChar, tableName);
  const result = await request.query(`
    SELECT CASE WHEN EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    ) THEN 1 ELSE 0 END AS tableExists
  `);
  return result.recordset[0].tableExists === 1;
}

async function runDeleteIfExists(pool, tableName, whereClause = '') {
  if (!(await tableExists(pool, tableName))) {
    return;
  }
  const sqlText = `DELETE FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''};`;
  await pool.request().query(sqlText);
}

async function columnExists(pool, tableName, columnName) {
  const request = pool.request();
  request.input('tableName', sql.NVarChar, tableName);
  request.input('columnName', sql.NVarChar, columnName);
  const result = await request.query(`
    SELECT CASE WHEN EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @columnName
    ) THEN 1 ELSE 0 END AS columnExists
  `);
  return result.recordset[0].columnExists === 1;
}

async function deleteWhereUserNotAdmin(pool, tableName, columnName, adminUserId) {
  if (!(await tableExists(pool, tableName)) || !(await columnExists(pool, tableName, columnName))) {
    return;
  }
  await pool.request().query(`
    DELETE FROM ${tableName}
    WHERE ${columnName} <> ${adminUserId}
  `);
}

async function repointUserReference(pool, tableName, columnName, adminUserId) {
  if (!(await tableExists(pool, tableName)) || !(await columnExists(pool, tableName, columnName))) {
    return;
  }
  await pool.request().query(`
    UPDATE ${tableName}
    SET ${columnName} = ${adminUserId}
    WHERE ${columnName} IS NOT NULL AND ${columnName} <> ${adminUserId}
  `);
}

async function nullTicketReference(pool, tableName, columnName) {
  if (!(await tableExists(pool, tableName)) || !(await columnExists(pool, tableName, columnName))) {
    return;
  }
  await pool.request().query(`
    UPDATE ${tableName}
    SET ${columnName} = NULL
    WHERE ${columnName} IS NOT NULL
  `);
}

async function getServerPaths(pool) {
  const result = await pool.request().query(`
    SELECT
      CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(4000)) AS dataPath,
      CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS NVARCHAR(4000)) AS logPath
  `);

  let { dataPath, logPath } = result.recordset[0];

  if (!dataPath || !logPath) {
    const fallback = await pool.request().query(`
      SELECT TOP 1 physical_name
      FROM sys.master_files
      WHERE database_id = 1
      ORDER BY file_id
    `);
    const masterPath = fallback.recordset[0]?.physical_name || 'C:\\Program Files\\Microsoft SQL Server\\MSSQL\\DATA\\master.mdf';
    const baseDir = path.win32.dirname(masterPath);
    dataPath = dataPath || `${baseDir}\\`;
    logPath = logPath || `${baseDir}\\`;
  }

  return { dataPath, logPath };
}

async function getLogicalFiles(pool) {
  const result = await pool.request().query(`
    SELECT name, type_desc
    FROM sys.database_files
    ORDER BY file_id
  `);

  const dataFile = result.recordset.find((row) => row.type_desc === 'ROWS');
  const logFile = result.recordset.find((row) => row.type_desc === 'LOG');

  if (!dataFile || !logFile) {
    throw new Error('Could not determine source database logical file names.');
  }

  return {
    dataLogicalName: dataFile.name,
    logLogicalName: logFile.name,
  };
}

async function backupSourceDatabase(masterPool) {
  await fs.promises.mkdir(seedDir, { recursive: true });
  await removeFileIfExists(sourceBackupPath);
  await removeFileIfExists(finalBackupPath);

  const backupSql = `
    BACKUP DATABASE [${sourceDbName}]
    TO DISK = N'${escapeSqlString(sourceBackupPath)}'
    WITH COPY_ONLY, FORMAT, INIT, STATS = 5, NAME = N'${escapeSqlString(sourceDbName)} Source Backup';
  `;

  writeLine(`Backing up source database to ${sourceBackupPath}`);
  await masterPool.request().query(backupSql);
}

async function dropDatabaseIfExists(masterPool, databaseName) {
  const escapedName = escapeSqlString(databaseName);
  await masterPool.request().query(`
    IF DB_ID(N'${escapedName}') IS NOT NULL
    BEGIN
      ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${databaseName}];
    END
  `);
}

async function restoreBaselineDatabase(masterPool, dataPath, logPath, logicalFiles) {
  const dataFilePath = path.win32.join(dataPath, `${baselineDbName}.mdf`);
  const logFilePath = path.win32.join(logPath, `${baselineDbName}_log.ldf`);

  await dropDatabaseIfExists(masterPool, baselineDbName);

  const restoreSql = `
    RESTORE DATABASE [${baselineDbName}]
    FROM DISK = N'${escapeSqlString(sourceBackupPath)}'
    WITH MOVE N'${escapeSqlString(logicalFiles.dataLogicalName)}' TO N'${escapeSqlString(dataFilePath)}',
         MOVE N'${escapeSqlString(logicalFiles.logLogicalName)}' TO N'${escapeSqlString(logFilePath)}',
         REPLACE,
         RECOVERY,
         STATS = 5;
  `;

  writeLine(`Restoring temporary baseline database ${baselineDbName}`);
  await masterPool.request().query(restoreSql);
}

async function sanitizeBaselineDatabase() {
  await withConnection(baselineDbName, async (pool) => {
    const adminRoleResult = await pool.request().query(`
      SELECT TOP 1 role_id
      FROM user_roles
      WHERE role_code = 'ADMIN'
      ORDER BY role_id
    `);
    const adminRoleId = adminRoleResult.recordset[0]?.role_id;

    if (!adminRoleId) {
      throw new Error('ADMIN role not found in baseline database.');
    }

    const adminUserResult = await pool.request().query(`
      SELECT TOP 1 user_id
      FROM users
      WHERE role_id = ${adminRoleId}
      ORDER BY CASE WHEN username = '${escapeSqlString(preferredAdminUsername)}' THEN 0 ELSE 1 END, user_id
    `);
    const adminUserId = adminUserResult.recordset[0]?.user_id;

    if (!adminUserId) {
      throw new Error('No existing admin user found to keep in the baseline database.');
    }

    await nullTicketReference(pool, 'notifications', 'related_ticket_id');
    await nullTicketReference(pool, 'bot_training_data', 'source_ticket_id');

    const ticketTables = [
      'ticket_attachments',
      'ticket_comments',
      'ticket_custom_field_values',
      'ticket_info_requests',
      'ticket_ratings',
      'ticket_activities',
      'tickets',
    ];

    for (const tableName of ticketTables) {
      await runDeleteIfExists(pool, tableName);
    }

    const adminOnlyTables = [
      ['password_history', 'user_id'],
      ['password_reset_tokens', 'user_id'],
      ['user_2fa_attempts', 'user_id'],
      ['user_2fa_backup_codes', 'user_id'],
      ['user_2fa_otp_codes', 'user_id'],
      ['user_2fa_settings', 'user_id'],
      ['user_sessions', 'user_id'],
      ['user_trusted_devices', 'user_id'],
      ['bot_user_profiles', 'user_id'],
    ];

    for (const [tableName, columnName] of adminOnlyTables) {
      await deleteWhereUserNotAdmin(pool, tableName, columnName, adminUserId);
    }

    const repointTables = [
      ['analytics_logs', 'user_id'],
      ['backup_history', 'created_by'],
      ['bot_advanced_features', 'updated_by'],
      ['bot_api_keys', 'created_by'],
      ['bot_api_keys', 'updated_by'],
      ['bot_api_providers', 'updated_by'],
      ['bot_api_usage', 'user_id'],
      ['bot_chat_messages', 'user_id'],
      ['bot_chat_sessions', 'user_id'],
      ['bot_config', 'updated_by'],
      ['bot_conversation_context', 'user_id'],
      ['bot_conversation_history', 'user_id'],
      ['bot_custom_intents', 'created_by'],
      ['bot_response_rules', 'updated_by'],
      ['departments', 'created_by'],
      ['departments', 'updated_by'],
      ['email_queue', 'recipient_user_id'],
      ['email_templates', 'created_by'],
      ['email_templates', 'updated_by'],
      ['license_events', 'created_by'],
      ['login_attempts', 'user_id'],
      ['notifications', 'user_id'],
      ['security_audit_log', 'user_id'],
      ['system_settings', 'updated_by'],
      ['user_roles', 'created_by'],
      ['user_roles', 'updated_by'],
      ['users', 'created_by'],
      ['users', 'updated_by'],
    ];

    for (const [tableName, columnName] of repointTables) {
      await repointUserReference(pool, tableName, columnName, adminUserId);
    }

    await pool.request().query(`
      UPDATE users
      SET is_active = 1,
          is_locked = 0,
          locked_until = NULL
      WHERE user_id = ${adminUserId};
    `);

    await pool.request().query(`
      DELETE FROM users
      WHERE user_id <> ${adminUserId};
    `);

    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bot_api_providers')
      BEGIN
        UPDATE bot_api_providers
        SET api_endpoint = CASE
          WHEN provider_name = 'local' OR provider_label = 'Local LLM' THEN 'http://ollama:11434/api/generate'
          ELSE api_endpoint
        END
      END
    `);

    if (await tableExists(pool, 'license_runtime_state')) {
      await pool.request().query(`
        UPDATE license_runtime_state
        SET current_status = CASE
              WHEN active_license_id IS NULL THEN 'MISSING'
              ELSE 'VALID'
            END,
            status_message = CASE
              WHEN active_license_id IS NULL THEN 'No license installed.'
              ELSE 'Pending runtime validation after deployment.'
            END,
            warning_days_remaining = NULL,
            last_checked_at = GETDATE(),
            sessions_invalidated_at = NULL,
            last_observed_at = NULL,
            max_observed_at = NULL,
            clock_tamper_detected_at = NULL
      `);
    }
  });
}

async function backupSanitizedBaseline(masterPool) {
  const backupSql = `
    BACKUP DATABASE [${baselineDbName}]
    TO DISK = N'${escapeSqlString(finalBackupPath)}'
    WITH FORMAT, INIT, STATS = 5, NAME = N'${escapeSqlString(sourceDbName)} Production Baseline';
  `;

  writeLine(`Creating sanitized baseline backup at ${finalBackupPath}`);
  await masterPool.request().query(backupSql);
}

async function main() {
  await fs.promises.mkdir(seedDir, { recursive: true });

  await withConnection('master', async (masterPool) => {
    await backupSourceDatabase(masterPool);

    const sourceMetadata = await withConnection(sourceDbName, async (pool) => ({
      paths: await getServerPaths(masterPool),
      logicalFiles: await getLogicalFiles(pool),
    }));

    await restoreBaselineDatabase(
      masterPool,
      sourceMetadata.paths.dataPath,
      sourceMetadata.paths.logPath,
      sourceMetadata.logicalFiles
    );

    await sanitizeBaselineDatabase();
    await backupSanitizedBaseline(masterPool);
    await dropDatabaseIfExists(masterPool, baselineDbName);
    await removeFileIfExists(sourceBackupPath);
  });

  writeLine(`Production baseline ready: ${finalBackupPath}`);
}

main().catch((error) => {
  process.stderr.write(`Failed to create production baseline: ${error.message}\n`);
  process.exit(1);
});
