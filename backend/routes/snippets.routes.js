// ============================================================
// SNIPPETS ROUTES
// Response snippets for IT engineers
// All routes require authentication + IT Staff role
// ============================================================

const express = require('express');
const router = express.Router();
const { getSnippets, createSnippet, updateSnippet, deleteSnippet } = require('../controllers/snippets.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('can_manage_snippets'));

router.get('/', getSnippets);
router.post('/', createSnippet);
router.put('/:id', updateSnippet);
router.delete('/:id', deleteSnippet);

module.exports = router;
