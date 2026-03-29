// ============================================
// Database Connection Manager
// Manages SQL Server connection pool with retry and fallback
// Production-ready: retry on failure, connection validation
// ============================================

const sql = require('mssql');
const config = require('./config');
const logger = require('../utils/logger');

// Connection pool instance
let poolPromise = null;
const MAX_RETRIES = parseInt(process.env.DB_CONNECT_RETRIES, 10) || 3;
const RETRY_DELAY_MS = parseInt(process.env.DB_RETRY_DELAY_MS, 10) || 2000;

/**
 * Sleep helper for retry delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get database connection pool with retry logic
 * Creates a new pool if one doesn't exist
 * @returns {Promise<sql.ConnectionPool>}
 */
const getPool = async () => {
  if (poolPromise) {
    return poolPromise;
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      poolPromise = sql.connect(config.database);
      const pool = await poolPromise;

      logger.success('Connected to SQL Server database');

      // Handle pool errors - reset so next getPool will retry
      pool.on('error', (err) => {
        logger.error('Database pool error', { error: err?.message || err });
        poolPromise = null;
      });

      return pool;
    } catch (error) {
      lastError = error;
      poolPromise = null;
      logger.error(`Database connection attempt ${attempt}/${MAX_RETRIES} failed`, { error: error.message });
      if (attempt < MAX_RETRIES) {
        logger.warn(`Retrying database connection in ${RETRY_DELAY_MS}ms`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  logger.error('Database connection failed after all retries', { error: lastError?.message });
  throw lastError;
};

/**
 * Close database connection pool
 */
const closePool = async () => {
  try {
    if (poolPromise) {
      const pool = await poolPromise;
      await pool.close();
      poolPromise = null;
      logger.success('Database connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connection', { error: error.message });
    throw error;
  }
};

/**
 * Execute a query with parameters (with single retry on connection loss)
 * @param {string} query - SQL query
 * @param {Object} params - Query parameters
 * @returns {Promise<sql.IResult>}
 */
const executeQuery = async (query, params = {}, retryCount = 0) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    Object.keys(params).forEach((key) => {
      const v = params[key];
      // Reports & pagination: OFFSET/FETCH require integer params; date range filters need DATE type
      if (key === 'off' || key === 'ps' || key === 'rowEnd') {
        const n = parseInt(v, 10);
        request.input(key, sql.Int, Number.isNaN(n) ? 0 : n);
        return;
      }
      if (
        (key === 'startDate' || key === 'endDate') &&
        typeof v === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
      ) {
        request.input(key, sql.Date, v.trim());
        return;
      }
      request.input(key, v);
    });

    const result = await request.query(query);
    return result;
  } catch (error) {
    // On connection/pool loss, reset and retry once
    const isConnectionError = /ECONNRESET|ETIMEDOUT|ConnectionError|ConnectionLost|Connection is closed/i.test(error?.message || '');
    if (isConnectionError && retryCount === 0) {
      poolPromise = null;
      await sleep(500);
      return executeQuery(query, params, 1);
    }
    logger.error('Query execution error', { error: error.message });
    throw error;
  }
};

/**
 * Execute a stored procedure
 * @param {string} procedureName - Name of stored procedure
 * @param {Object} params - Procedure parameters
 * @returns {Promise<sql.IResult>}
 */
const executeProcedure = async (procedureName, params = {}) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Add input parameters
    Object.keys(params.input || {}).forEach((key) => {
      request.input(key, params.input[key]);
    });

    // Add output parameters
    Object.keys(params.output || {}).forEach((key) => {
      request.output(key, params.output[key]);
    });

    const result = await request.execute(procedureName);
    return result;
  } catch (error) {
    logger.error('Procedure execution error', { error: error.message });
    throw error;
  }
};

/**
 * Execute multiple queries inside a transaction (for atomic operations)
 * @param {Function} callback - Async fn(transaction) that receives a transaction with .request()
 * @returns {Promise<any>} - Return value from callback
 */
const executeInTransaction = async (callback) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.error('Transaction rollback error', { error: rollbackErr?.message });
    }
    throw error;
  }
};

/**
 * Run a query within a transaction
 * @param {sql.Transaction} transaction
 * @param {string} query
 * @param {Object} params
 * @returns {Promise<sql.IResult>}
 */
const executeInTransactionQuery = async (transaction, query, params = {}) => {
  const request = new sql.Request(transaction);
  Object.keys(params).forEach((key) => {
    const v = params[key];
    if (key === 'off' || key === 'ps' || key === 'rowEnd') {
      const n = parseInt(v, 10);
      request.input(key, sql.Int, Number.isNaN(n) ? 0 : n);
      return;
    }
    if (
      (key === 'startDate' || key === 'endDate') &&
      typeof v === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
    ) {
      request.input(key, sql.Date, v.trim());
      return;
    }
    request.input(key, v);
  });
  return request.query(query);
};

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const result = await executeQuery('SELECT 1 AS test');
    return result.recordset[0].test === 1;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
};

module.exports = {
  sql,
  getPool,
  closePool,
  executeQuery,
  executeProcedure,
  executeInTransaction,
  executeInTransactionQuery,
  testConnection,
}; 
