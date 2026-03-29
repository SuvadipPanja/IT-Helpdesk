// ============================================
// Main Server File
// Entry point for the IT Helpdesk application
// UPDATED: Added Backup System + Security Background Jobs + Security Routes + Password Expiry Routes + 2FA Routes
// Developed by: Suvadip Panja
// Date: January 30, 2026
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { apiLimiter, loadConfigFromDB: loadRateLimitConfig } = require('./middleware/rateLimiter');
const path = require('path');
const fs = require('fs');

const { v4: uuidv4 } = require('uuid');

// Import configurations and utilities
const config = require('./config/config');
const logger = require('./utils/logger');
const { testConnection, closePool } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { enforceLicense } = require('./middleware/license.middleware');
const licenseService = require('./services/license.service');

// ============================================
// IMPORT BACKGROUND JOBS
// ============================================
const emailProcessorJob = require('./jobs/emailProcessor.job');
const autoEscalationJob = require('./jobs/autoEscalation.job');
const autoCloseJob = require('./jobs/autoClose.job');
const slaBreachJob = require('./jobs/slaBreach.job');

// ⭐ NEW: Security Background Jobs
const passwordExpiryJob = require('./jobs/passwordExpiry.job');
const sessionCleanupJob = require('./jobs/sessionCleanup.job');
const autoUnlockJob = require('./jobs/autoUnlock.job');

// 💾 Backup Background Job
const backupJob = require('./jobs/backup.job');

// 📱 WhatsApp Digest Job (Phase 9 Phase 4)
const waDigestJob = require('./jobs/whatsappDigest.job');

// 🧹 Log Truncation Job (production - cleans old audit/job logs)
const logTruncationJob = require('./jobs/logTruncation.job');
const approvalInboundMailJob = require('./jobs/approvalInboundMail.job');

let backgroundJobsRunning = false;
let licenseMonitorTimer = null;

const startBackgroundJobs = async () => {
  if (backgroundJobsRunning) {
    logger.info('Background jobs are already running');
    return;
  }

  logger.separator('STARTING BACKGROUND JOBS');

  logger.info('📧 Starting Email Processor Job...');
  emailProcessorJob.start();

  logger.info('🚨 Starting Auto-Escalation Job...');
  autoEscalationJob.start();

  logger.info('🔒 Starting Auto-Close Job...');
  autoCloseJob.start();

  logger.info('⚠️ Starting SLA Breach Detection Job...');
  slaBreachJob.start();

  logger.info('🔐 Starting Password Expiry Job...');
  passwordExpiryJob.start();

  logger.info('🧹 Starting Session Cleanup Job...');
  sessionCleanupJob.start();

  logger.info('🔓 Starting Auto-Unlock Job...');
  autoUnlockJob.start();

  logger.info('💾 Starting Backup Job...');
  await backupJob.startBackupJob();

  logger.info('🧹 Starting Log Truncation Job...');
  logTruncationJob.startLogTruncationJob();

  logger.info('📥 Starting Approval Inbound Mail Job (IMAP, if configured)...');
  approvalInboundMailJob.start();

  logger.info('📱 Starting WhatsApp Digest Job...');
  waDigestJob.start();

  backgroundJobsRunning = true;
  logger.separator();
};

const stopBackgroundJobs = async () => {
  logger.info('Stopping background jobs...');
  emailProcessorJob.stop();
  autoEscalationJob.stop();
  autoCloseJob.stop();
  slaBreachJob.stop();
  passwordExpiryJob.stop();
  sessionCleanupJob.stop();
  autoUnlockJob.stop();
  backupJob.stopBackupJob();
  logTruncationJob.stopLogTruncationJob();
  approvalInboundMailJob.stop();
  waDigestJob.stop();
  backgroundJobsRunning = false;
};

const startLicenseMonitor = () => {
  if (licenseMonitorTimer) {
    clearInterval(licenseMonitorTimer);
  }

  licenseMonitorTimer = setInterval(async () => {
    try {
      const state = await licenseService.syncRuntimeState();
      const shouldAllowRuntime = ['VALID', 'WARNING'].includes(state.status);

      if (!shouldAllowRuntime) {
        if (backgroundJobsRunning) {
          logger.warn('License monitor stopping background jobs', { status: state.status });
          await stopBackgroundJobs();
        }
        if (state.status === 'EXPIRED') {
          await licenseService.invalidateActiveSessions('LICENSE_EXPIRED');
        }
        return;
      }

      if (!backgroundJobsRunning) {
        logger.info('License monitor restoring background jobs after valid license state');
        await startBackgroundJobs();
      }
    } catch (error) {
      logger.error('License monitor error', error);
    }
  }, 60 * 1000);
};

// Initialize Express app
const app = express();

// So req.ip reflects X-Forwarded-For when behind a reverse proxy (nginx, IIS, cloud load balancer)
const tp = process.env.TRUST_PROXY;
if (tp === 'true' || tp === '1') {
  app.set('trust proxy', true);
} else if (tp && tp !== 'false' && !Number.isNaN(Number(tp))) {
  app.set('trust proxy', Number(tp));
} else {
  app.set('trust proxy', 1);
}

// ============================================
// Security Middleware
// ============================================

logger.info('Initializing security middleware');

// Helmet - Security headers
app.use(helmet({
  // CSP for the API backend: deny all browser sub-resource loading on bare API responses.
  // Uploads (images/documents) are served via the nginx reverse-proxy where the
  // frontend CSP applies; this API-level CSP acts as a defence-in-depth layer.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri:    ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc:  ["'none'"],
      scriptSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Explicitly allow cross-origin loading of uploads (profile pics, branding)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors(config.cors));

logger.success('CORS enabled', { origin: config.cors.origin });

// Rate limiting (dynamic, DB-configurable via Settings > Security Tab)
app.use('/api/', apiLimiter);
logger.success('Rate limiting enabled (DB-driven, configured in Settings > Security)');

// ============================================
// Body Parser Middleware
// ============================================

logger.info('Initializing body parsers');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// Request ID Middleware
// ============================================
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

logger.success('Body parsers initialized');

// ============================================
// Compression Middleware
// ============================================

app.use(compression());
logger.success('Response compression enabled');

// ============================================
// Request Logging Middleware
// ============================================

app.use(requestLogger);

// ============================================
// Create Upload Directories
// ============================================

const createUploadDirectories = () => {
  const directories = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'tickets'),
    path.join(__dirname, 'uploads', 'profiles'),
    path.join(__dirname, 'uploads', 'documents'),
    path.join(__dirname, 'uploads', 'branding')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.success('Directory created', { path: dir });
    } else {
      logger.info('Directory exists', { path: dir });
    }
  });
};

createUploadDirectories();

// ============================================
// Static Files - Serve with CORS headers
// Profile pictures: public (used in UI avatars)
// Ticket/document uploads: require authentication
// ============================================

const uploadDir = path.join(__dirname, 'uploads');
const { authenticate: staticAuth } = require('./middleware/auth');

// Branding assets — public (logo displayed on login, sidebar)
app.use('/uploads/branding', express.static(path.join(uploadDir, 'branding'), {
  setHeaders: (res, filePath) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-cache, must-revalidate');
    if (filePath.endsWith('.svg')) {
      res.set('Content-Type', 'image/svg+xml');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    } else if (filePath.endsWith('.webp')) {
      res.set('Content-Type', 'image/webp');
    }
  }
}));

// Profile pictures — public (avatars displayed without auth)
app.use('/uploads/profiles', express.static(path.join(uploadDir, 'profiles'), {
  setHeaders: (res, filePath) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-cache, must-revalidate');
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.set('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.set('Content-Type', 'image/webp');
    }
  }
}));

// Ticket attachments & documents — require authentication
app.use('/uploads/tickets', staticAuth, express.static(path.join(uploadDir, 'tickets'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'private, no-cache');
  }
}));

app.use('/uploads/documents', staticAuth, express.static(path.join(uploadDir, 'documents'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'private, no-cache');
  }
}));

logger.success('Static file serving enabled with CORS', { path: '/uploads', dir: uploadDir });

// ============================================
// Health Check Route
// ============================================

app.get('/health', (req, res) => {
  const response = {
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  // Only expose environment/version outside production (avoid info disclosure)
  if (config.env !== 'production') {
    response.environment = config.env;
    response.version = '1.0.0';
  }
  res.json(response);
});

// Root endpoint — minimal info in production to avoid API enumeration
app.get('/', (req, res) => {
  if (config.env === 'production') {
    return res.json({ success: true, message: 'IT Helpdesk API Server' });
  }
  res.json({
    success: true,
    message: 'IT Helpdesk API Server',
    version: '1.0.0',
    documentation: `http://localhost:${config.port}${config.apiPrefix}`,
    endpoints: {
      health: '/health',
      auth: `${config.apiPrefix}/auth`,
      users: `${config.apiPrefix}/users`,
      tickets: `${config.apiPrefix}/tickets`,
      system: `${config.apiPrefix}/system`,
      departments: `${config.apiPrefix}/departments`,
      roles: `${config.apiPrefix}/roles`,
      analytics: `${config.apiPrefix}/analytics`,
      reports: `${config.apiPrefix}/reports`,
      profile: `${config.apiPrefix}/profile`,
      settings: `${config.apiPrefix}/settings`,
      security: `${config.apiPrefix}/security`,
      passwordExpiry: `${config.apiPrefix}/password-expiry`,
      emailQueue: `${config.apiPrefix}/email-queue`,
      emailTemplates: `${config.apiPrefix}/email-templates`,
      ticketApprovals: `${config.apiPrefix}/ticket-approvals`,
      twoFactor: `${config.apiPrefix}/2fa`,
      backup: `${config.apiPrefix}/backup`,
      ai: `${config.apiPrefix}/ai`,
      botTickets: `${config.apiPrefix}/bot/tickets`,
      botContext: `${config.apiPrefix}/bot/context`,
      botAdmin: `${config.apiPrefix}/bot/admin`,
      botSettings: `${config.apiPrefix}/bot/settings`,
    },
  });
});

// ============================================
// API Routes
// ============================================

logger.info('Initializing API routes');

// Block protected API traffic whenever the runtime license is not usable.
// Public endpoints remain reachable through the license service allowlist.
app.use(`${config.apiPrefix}`, enforceLicense);

// Import route modules
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const systemRoutes = require('./routes/system.routes');
const ticketRoutes = require('./routes/tickets.routes');
const attachmentRoutes = require('./routes/attachments.routes');
const departmentsRoutes = require('./routes/departments.routes');
const rolesRoutes = require('./routes/roles.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const reportsRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const profileRoutes = require('./routes/profile.routes');
const settingsRoutes = require('./routes/settings.routes');
const securityRoutes = require('./routes/securityRoutes'); // ⭐ NEW: Security routes (already exists!)
const passwordExpiryRoutes = require('./routes/passwordExpiry.routes'); // ⭐ NEW: Password Expiry routes
const emailQueueRoutes = require('./routes/emailQueue.routes');
const emailTemplatesRoutes = require('./routes/emailTemplates.routes');
const ticketApprovalsRoutes = require('./routes/ticketApprovals.routes');
const twoFactorRoutes = require('./routes/twoFactor.routes'); // ⭐ NEW: Two-Factor Authentication routes
const backupRoutes = require('./routes/backup.routes'); // 💾 NEW: Backup routes
const aiRoutes = require('./routes/ai.routes'); // 🤖 NEW: AI Assistant routes
const botTicketsRoutes = require('./routes/bot-tickets.routes'); // 🤖 PHASE4: Bot Ticket Management
const botContextRoutes = require('./routes/bot-context.routes'); // 🤖 PHASE4: Bot Conversation Context
const botAdminRoutes = require('./routes/bot-admin.routes'); // 🤖 PHASE2: Bot Admin & Custom Intents
const botSettingsRoutes = require('./routes/bot-settings.routes'); // 🤖 BOT ADVANCED: Bot Settings & API Providers
const botSessionsRoutes = require('./routes/bot-sessions.routes'); // 🤖 BOT SESSIONS: Session tracking & analytics
const ratingsRoutes = require('./routes/ratings.routes'); // ⭐ NEW: Ratings routes
const ticketConfigRoutes = require('./routes/ticketConfig.routes'); // ⭐ NEW: Ticket Config routes
const ticketBucketRoutes = require('./routes/ticketBucket.routes'); // 🪣 NEW: Open Ticket Bucket for Engineers
const jobsRoutes = require('./routes/jobs.routes'); // 🖥️ NEW: Job Monitor routes
const licenseRoutes = require('./routes/license.routes'); // 🔐 NEW: Offline license routes
const statusRoutes = require('./routes/status.routes'); // 🚨 NEW: Incident Banner / Service Status
const snippetsRoutes = require('./routes/snippets.routes'); // ✂️ NEW: Response Snippets
const metricsRoutes = require('./routes/metrics.routes'); // 📊 NEW: Health & Metrics
const kbRoutes = require('./routes/kb.routes'); // 📚 NEW: Knowledge Base routes
const slaRoutes = require('./routes/sla.routes'); // 📋 NEW: SLA Policies routes
const teamsRoutes = require('./routes/teams.routes'); // 👥 NEW: Team Management routes
const teamBucketRoutes = require('./routes/teamBucket.routes'); // 🗂️ NEW: Team Bucket routes
const publicEmailApprovalRoutes = require('./routes/publicEmailApproval.routes'); // Email Approve/Reject (public token)
const whatsappRoutes = require('./routes/whatsapp.routes'); // 📱 Phase 9: WhatsApp Integration
const outageRoutes = require('./routes/outageNotification.routes'); // 📢 Phase 10: Outage Notifications

// Register routes
app.use(`${config.apiPrefix}/public/email-approval`, publicEmailApprovalRoutes);
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/users`, userRoutes);
app.use(`${config.apiPrefix}/system`, systemRoutes);
app.use(`${config.apiPrefix}/tickets`, ticketRoutes);
app.use(`${config.apiPrefix}/attachments`, attachmentRoutes);
app.use(`${config.apiPrefix}/departments`, departmentsRoutes);
app.use(`${config.apiPrefix}/roles`, rolesRoutes);
app.use(`${config.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.apiPrefix}/reports`, reportsRoutes);
app.use(`${config.apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${config.apiPrefix}/notifications`, notificationsRoutes);
app.use(`${config.apiPrefix}/profile`, profileRoutes);
app.use(`${config.apiPrefix}/settings`, settingsRoutes);
app.use(`${config.apiPrefix}/security`, securityRoutes); // ⭐ NEW: Security route registration
app.use(`${config.apiPrefix}/password-expiry`, passwordExpiryRoutes); // ⭐ NEW: Password Expiry route registration
app.use(`${config.apiPrefix}/email-queue`, emailQueueRoutes);
app.use(`${config.apiPrefix}/email-templates`, emailTemplatesRoutes);
app.use(`${config.apiPrefix}/ticket-approvals`, ticketApprovalsRoutes);
app.use(`${config.apiPrefix}/2fa`, twoFactorRoutes); // ⭐ NEW: Two-Factor Authentication route registration
app.use(`${config.apiPrefix}/backup`, backupRoutes); // 💾 NEW: Backup route registration
app.use(`${config.apiPrefix}/ai`, aiRoutes); // 🤖 NEW: AI Assistant route registration
app.use(`${config.apiPrefix}/bot/tickets`, botTicketsRoutes); // 🤖 PHASE4: Bot Ticket Management
app.use(`${config.apiPrefix}/bot/context`, botContextRoutes); // 🤖 PHASE4: Bot Conversation Context
app.use(`${config.apiPrefix}/bot/admin`, botAdminRoutes); // 🤖 PHASE2: Bot Admin route registration
app.use(`${config.apiPrefix}/bot/settings`, botSettingsRoutes); // 🤖 BOT ADVANCED: Bot Settings & API Providers
app.use(`${config.apiPrefix}/bot/sessions`, botSessionsRoutes); // 🤖 BOT SESSIONS: Session tracking & analytics
app.use(`${config.apiPrefix}/ratings`, ratingsRoutes); // ⭐ NEW: Ratings route registration
app.use(`${config.apiPrefix}/ticket-config`, ticketConfigRoutes); // ⭐ NEW: Ticket Config route registration
app.use(`${config.apiPrefix}/ticket-bucket`, ticketBucketRoutes); // 🪣 NEW: Open Ticket Bucket route registration
app.use(`${config.apiPrefix}/jobs`, jobsRoutes); // 🖥️ NEW: Job Monitor route registration
app.use(`${config.apiPrefix}/license`, licenseRoutes); // 🔐 NEW: License route registration
app.use(`${config.apiPrefix}/status`, statusRoutes); // 🚨 NEW: Incident Banner route registration
app.use(`${config.apiPrefix}/snippets`, snippetsRoutes); // ✂️ NEW: Response Snippets route registration
app.use(`${config.apiPrefix}/metrics`, metricsRoutes); // 📊 NEW: Health & Metrics route registration
app.use(`${config.apiPrefix}/kb`, kbRoutes); // 📚 NEW: Knowledge Base route registration
app.use(`${config.apiPrefix}/sla`, slaRoutes); // 📋 NEW: SLA Policies route registration
app.use(`${config.apiPrefix}/teams`, teamsRoutes); // 👥 NEW: Team Management route registration
app.use(`${config.apiPrefix}/team-bucket`, teamBucketRoutes); // 🗂️ NEW: Team Bucket route registration
app.use(`${config.apiPrefix}/whatsapp`, whatsappRoutes); // 📱 Phase 9: WhatsApp Integration
app.use(`${config.apiPrefix}/outage`, outageRoutes); // 📢 Phase 10: Outage Notifications

logger.success('API routes initialized', {
  prefix: config.apiPrefix,
  routes: [
    'auth',
    'users',
    'system',
    'tickets',
    'attachments',
    'departments',
    'roles',
    'analytics',
    'reports',
    'dashboard',
    'notifications',
    'profile',
    'settings',
    'security', // ⭐ NEW: Added to routes list
    'password-expiry', // ⭐ NEW: Added password expiry to routes list
    'email-queue',
    'email-templates',
    'ticket-approvals',
    '2fa', // ⭐ NEW: Added 2FA to routes list
    'backup', // 💾 NEW: Added backup to routes list
    'ai', // 🤖 NEW: Added AI to routes list
    'bot/tickets', // 🤖 PHASE4: Bot Ticket Management
    'bot/context', // 🤖 PHASE4: Bot Conversation Context
    'bot/admin', // 🤖 PHASE2: Bot Admin & Custom Intents
    'bot/settings', // 🤖 BOT ADVANCED: Bot Settings & API Providers
    'ratings', // ⭐ NEW: Added ratings to routes list
    'ticket-config', // ⭐ NEW: Added ticket-config to routes list
    'ticket-bucket', // 🪣 NEW: Open Ticket Bucket for Engineers
    'license' // 🔐 NEW: Offline license
  ]
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

logger.success('Error handlers initialized');

// ============================================
// Database Connection Test
// ============================================

const initializeDatabase = async () => {
  try {
    logger.separator('DATABASE CONNECTION TEST');
    logger.try('Testing database connection');

    const isConnected = await testConnection();

    if (isConnected) {
      logger.success('Database connection test passed');
      logger.info('Database details', {
        server: config.database.server,
        database: config.database.database,
        user: config.database.user,
      });
      logger.separator();
      return true;
    } else {
      logger.error('Database connection test failed');
      logger.separator();
      return false;
    }
  } catch (error) {
    logger.error('Database initialization error', error);
    logger.separator();
    return false;
  }
};

// ============================================
// Server Startup
// ============================================

const startServer = async () => {
  try {
    logger.separator('SERVER INITIALIZATION');
    logger.info('Starting IT Helpdesk Backend Server');
    logger.info('Environment', { env: config.env });
    logger.info('Node Version', { version: process.version });
    logger.info('Platform', { platform: process.platform });

    // Test database connection
    const dbConnected = await initializeDatabase();

    if (!dbConnected) {
      logger.error('Failed to connect to database. Server will not start.');
      logger.warn('Please check your database configuration in .env file');
      process.exit(1);
    }

    // ============================================
    // INVALIDATE ALL ACTIVE SESSIONS ON STARTUP
    // When the server restarts, all previously active sessions must be
    // cleared — users need to re-authenticate for security consistency.
    // ============================================
    try {
      const { executeQuery } = require('./config/database');
      const sessionClearResult = await executeQuery(`
        UPDATE user_sessions
        SET is_active = 0
        WHERE is_active = 1
      `);
      logger.info('All active sessions invalidated on startup', {
        rowsCleared: sessionClearResult.rowsAffected?.[0] ?? 0
      });
    } catch (sessionErr) {
      logger.warn('Failed to clear sessions on startup (non-fatal)', { error: sessionErr.message });
    }

    // Run production migrations (indexes, SP, views) using .env credentials
    try {
      const migrationRunner = require('./services/migrationRunner.service');
      const migResult = await migrationRunner.runProductionMigrations();
      if (!migResult.success) {
        logger.warn('Some migrations failed (non-fatal)', { error: migResult.error });
      }
    } catch (migErr) {
      logger.warn('Migration runner error (non-fatal, server will continue)', { error: migErr.message });
    }

    // Load system_settings into memory (email links, public URL resolution, etc.)
    try {
      const settingsService = require('./services/settings.service');
      await settingsService.initialize();
      const { getPublicAppUrl } = require('./utils/publicUrl');
      logger.success('Settings cache initialized', {
        resolvedPublicAppUrl: getPublicAppUrl(),
      });
    } catch (settingsErr) {
      logger.warn('Settings service initialize failed (non-fatal)', { error: settingsErr.message });
    }

    // Initialize timezone from settings (after DB is connected)
    try {
      const dateUtils = require('./utils/dateUtils');
      const dateSettings = await dateUtils.initDateSettings();
      logger.success('Timezone initialized from settings', {
        timezone: dateSettings.timezone,
        date_format: dateSettings.date_format,
        time_format: dateSettings.time_format
      });
    } catch (err) {
      logger.warn('Failed to load timezone settings, using defaults', { error: err.message });
    }

    // Load rate limiter config from DB
    await loadRateLimitConfig();

    // Start server
    const server = app.listen(config.port, async () => {
      const { getPublicAppUrl } = require('./utils/publicUrl');
      logger.separator('SERVER STARTED SUCCESSFULLY');
      logger.success(`Server is running on port ${config.port}`);
      logger.success(`Public App URL (resolved): ${getPublicAppUrl()}`);
      logger.success(`API Base Path: ${config.apiPrefix}`);
      logger.success(`Health Check Path: /health`);
      logger.info('Server Details', {
        port: config.port,
        environment: config.env,
        apiPrefix: config.apiPrefix,
        pid: process.pid,
        uploadDir: path.join(__dirname, 'uploads')
      });
      logger.separator();
      logger.info('🎉 IT Helpdesk Backend is ready to accept requests!');
      logger.info('📂 File uploads enabled at: /uploads');
      logger.info('🖼️ Profile pictures: /uploads/profiles');
      logger.info('📎 Ticket attachments: /uploads/tickets');
      logger.info('🔓 CORS enabled for cross-origin requests');
      logger.info('🔗 Attachments endpoint: /api/v1/tickets/:id/attachments');
      logger.info('👥 Users endpoint: /api/v1/users');
      logger.info('👤 Profile endpoint: /api/v1/profile');
      logger.info('🔐 Security endpoint: /api/v1/security'); // ⭐ NEW: Security endpoint info
      logger.info('⏰ Password Expiry endpoint: /api/v1/password-expiry'); // ⭐ NEW: Password Expiry endpoint info
      logger.info('🔒 Two-Factor Auth endpoint: /api/v1/2fa'); // ⭐ NEW: 2FA endpoint info
      logger.info('📧 Email Queue endpoint: /api/v1/email-queue');
      logger.info('📝 Email Templates endpoint: /api/v1/email-templates');
      logger.info('✅ Ticket Approvals endpoint: /api/v1/ticket-approvals');
      logger.info('💾 Backup endpoint: /api/v1/backup'); // 💾 NEW: Backup endpoint info
      logger.info('🔐 License endpoint: /api/v1/license');
      logger.info('Press CTRL+C to stop the server');
      logger.separator();

      const licenseState = await licenseService.syncRuntimeState();
      const runtimeAllowed = ['VALID', 'WARNING'].includes(licenseState.status);

      if (runtimeAllowed) {
        await startBackgroundJobs();
      } else {
        logger.warn('Background jobs not started because license is not active', {
          status: licenseState.status,
          message: licenseState.message,
        });
      }

      startLicenseMonitor();
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
        logger.info('Please try a different port or stop the other application');
      } else {
        logger.error('Server error', error);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.separator('GRACEFUL SHUTDOWN');
      logger.warn(`${signal} received, closing server gracefully`);

      if (licenseMonitorTimer) {
        clearInterval(licenseMonitorTimer);
        licenseMonitorTimer = null;
      }

      await stopBackgroundJobs();

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await closePool();
          logger.info('Database connections closed');
        } catch (error) {
          logger.error('Error closing database connections', error);
        }

        logger.success('Shutdown complete');
        logger.separator();
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections — exit to avoid undefined state
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection — shutting down', {
        reason: reason,
      });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// ============================================
// Start Application
// ============================================

startServer();

module.exports = app;