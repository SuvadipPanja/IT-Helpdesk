/**
 * wait-for-db.js
 * Polls SQL Server until it accepts connections.
 * Called by docker-entrypoint.sh before starting the app.
 *
 * Environment variables:
 *   DB_WAIT_ATTEMPTS   — max poll attempts (default 60)
 *   DB_WAIT_DELAY_MS   — ms between attempts  (default 5000)
 *   DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD — connection credentials
 */

const sql = require('mssql');

const MAX   = parseInt(process.env.DB_WAIT_ATTEMPTS, 10) || 60;
const DELAY = parseInt(process.env.DB_WAIT_DELAY_MS,  10) || 5000;

const config = {
  server:   process.env.DB_SERVER   || 'db',
  database: process.env.DB_NAME     || 'ITHelpdesk',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || '',
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
  connectionTimeout: 10000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 1; i <= MAX; i++) {
    try {
      const pool = await sql.connect(config);
      await pool.request().query('SELECT 1');
      await pool.close();
      console.log(`[wait-for-db] Database ready (attempt ${i}/${MAX})`);
      process.exit(0);
    } catch {
      console.log(`[wait-for-db] Attempt ${i}/${MAX} — waiting ${DELAY}ms...`);
      await sleep(DELAY);
    }
  }
  console.error(`[wait-for-db] Database not ready after ${MAX} attempts — aborting`);
  process.exit(1);
})();
