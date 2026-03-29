// ============================================================
// KNOWLEDGE BASE ROUTES
// /api/v1/kb/*
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getCategories, createCategory, updateCategory,
  getArticles, getArticleBySlug,
  createArticle, updateArticle, archiveArticle, publishArticle, getAdminArticles,
  submitFeedback,
  getFaqs, createFaq, updateFaq, deleteFaq,
  searchKB,
  getPopularArticles, getPopularSearches,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, getAdminAnnouncements,
  getKbAnalytics,
} = require('../controllers/kb.controller');

// All KB routes require authentication
router.use(authenticate);

// ── Public (any authenticated user) ─────────────────────────
router.get('/categories',                  getCategories);
router.get('/articles',                    getArticles);
router.get('/articles/by-slug/:slug',      getArticleBySlug);
router.post('/articles/:id/feedback',      submitFeedback);
router.get('/faqs',                        getFaqs);
router.get('/search',                      searchKB);
router.get('/popular',                     getPopularArticles);
router.get('/popular-searches',            getPopularSearches);
router.get('/announcements',               getAnnouncements);

// ── Admin routes ─────────────────────────────────────────────
const adminAuth = authorize('can_manage_kb');

router.get('/admin/articles',          adminAuth, getAdminArticles);
router.post('/admin/articles',         adminAuth, createArticle);
router.put('/admin/articles/:id',      adminAuth, updateArticle);
router.delete('/admin/articles/:id',   adminAuth, archiveArticle);
router.post('/admin/articles/:id/publish', adminAuth, publishArticle);

router.post('/admin/categories',       adminAuth, createCategory);
router.put('/admin/categories/:id',    adminAuth, updateCategory);

router.post('/admin/faqs',             adminAuth, createFaq);
router.put('/admin/faqs/:id',          adminAuth, updateFaq);
router.delete('/admin/faqs/:id',       adminAuth, deleteFaq);

router.get('/admin/analytics',         adminAuth, getKbAnalytics);

router.get('/admin/announcements',          adminAuth, getAdminAnnouncements);
router.post('/admin/announcements',         adminAuth, createAnnouncement);
router.put('/admin/announcements/:id',      adminAuth, updateAnnouncement);
router.delete('/admin/announcements/:id',   adminAuth, deleteAnnouncement);

module.exports = router;
