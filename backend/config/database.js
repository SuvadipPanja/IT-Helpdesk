// ============================================
// Database Connection Manager
// Manages SQL Server connection pool
// ============================================

const sql = require('mssql');
const config = require('./config');

// Connection pool instance
let poolPromise = null;

/**
 * Get database connection pool
 * Creates a new pool if one doesn't exist
 * @returns {Promise<sql.ConnectionPool>}
 */
const getPool = async () => {
  if (poolPromise) {
    return poolPromise;
  }

  try {
    poolPromise = sql.connect(config.database);
    const pool = await poolPromise;

    console.log('✅ Connected to SQL Server database');
    console.log(`   Database: ${config.database.database}`);
    console.log(`   Server: ${config.database.server}`);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('❌ Database pool error:', err);
      poolPromise = null;
    });

    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    poolPromise = null;
    throw error;
  }
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
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
    throw error;
  }
};

/**
 * Execute a query with parameters
 * @param {string} query - SQL query
 * @param {Object} params - Query parameters
 * @returns {Promise<sql.IResult>}
 */
const executeQuery = async (query, params = {}) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Add parameters to request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('❌ Query execution error:', error.message);
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
    console.error('❌ Procedure execution error:', error.message);
    throw error;
  }
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
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

module.exports = {
  sql,
  getPool,
  closePool,
  executeQuery,
  executeProcedure,
  testConnection,
}; 
