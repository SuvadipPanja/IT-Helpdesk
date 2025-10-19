// ============================================
// Users Routes
// ============================================

const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// User CRUD
router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;