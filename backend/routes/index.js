// ============================================
// Main Routes Index
// Centralizes all route modules
// ============================================

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const ticketsRoutes = require('./tickets.routes');
const systemRoutes = require('./system.routes');
const usersRoutes = require('./users.routes');
const attachmentsRoutes = require('./attachments.routes');
const departmentsRoutes = require('./departments.routes');
const rolesRoutes = require('./roles.routes');
const analyticsRoutes = require('./analytics.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/system', systemRoutes);
router.use('/users', usersRoutes);
router.use('/tickets', attachmentsRoutes);
router.use('/departments', departmentsRoutes);
router.use('/roles', rolesRoutes);
router.use('/analytics', analyticsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;