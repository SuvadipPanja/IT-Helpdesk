// ============================================
// CR (Change Request) Routes
// All change request endpoints
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeAny } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  createCRValidator,
  updateCRValidator,
  crQueryValidator,
  addCRCommentValidator,
  scheduleCRValidator,
  completeCRValidator,
} = require('../validators/cr.validators');
const {
  getLookups,
  getApprovers,
  getCRSettings,
  getCRStats,
  getCRs,
  getCRById,
  createCR,
  updateCR,
  deleteCR,
  submitCR,
  startReview,
  requestInfo,
  provideInfo,
  approveCR,
  rejectCR,
  scheduleCR,
  startImplementation,
  completeCR,
  rollbackCR,
  cancelCR,
  resubmitCR,
  closeCR,
  addComment,
  assignCR,
  getPendingApprovals,
  getApprovalStats,
  decideApproval,
  getCalendar,
  getBlackouts,
  createBlackout,
  deleteBlackout,
  rescheduleCR,
  sendToApproval,
  raiseIssue,
  notBelongsToMe,
  getMyCRApprovals,
} = require('../controllers/cr.controller');

// All routes require authentication
router.use(authenticate);

// ============================================
// STATIC ROUTES — Must be before /:id
// ============================================
router.get('/lookups', getLookups);
router.get('/approvers', getApprovers);
router.get('/cr-settings', getCRSettings);
router.get('/stats', getCRStats);
router.get('/pending-approvals', getPendingApprovals);
router.get('/approval-stats', getApprovalStats);
router.get('/my-cr-approvals', getMyCRApprovals);
router.get('/calendar', getCalendar);
router.get('/blackouts', getBlackouts);
router.post('/blackouts', authorize('can_manage_cr_settings'), createBlackout);
router.delete('/blackouts/:id', authorize('can_manage_cr_settings'), deleteBlackout);

// ============================================
// CRUD
// ============================================
router.get('/', crQueryValidator, validateRequest, getCRs);
router.post('/', authorize('can_create_cr'), createCRValidator, validateRequest, createCR);
router.get('/:id', getCRById);
router.put('/:id', updateCRValidator, validateRequest, updateCR);
router.delete('/:id', deleteCR);

// ============================================
// WORKFLOW TRANSITIONS
// ============================================
router.patch('/:id/submit', submitCR);
router.patch('/:id/start-review', startReview);
router.patch('/:id/request-info', requestInfo);
router.patch('/:id/provide-info', provideInfo);
router.patch('/:id/approve', authorize('can_approve_cr'), approveCR);
router.patch('/:id/reject', authorize('can_approve_cr'), rejectCR);
router.patch('/:id/schedule', scheduleCRValidator, validateRequest, scheduleCR);
router.patch('/:id/start', authorize('can_implement_cr'), startImplementation);
router.patch('/:id/complete', completeCRValidator, validateRequest, completeCR);
router.patch('/:id/rollback', rollbackCR);
router.patch('/:id/cancel', cancelCR);
router.patch('/:id/resubmit', resubmitCR);
router.patch('/:id/close', closeCR);
router.patch('/:id/reschedule', rescheduleCR);
router.patch('/:id/send-to-approval', sendToApproval);
router.patch('/:id/raise-issue', raiseIssue);
router.patch('/:id/not-belongs-to-me', notBelongsToMe);

// ============================================
// COMMENTS & ASSIGNMENT
// ============================================
router.post('/:id/comments', addCRCommentValidator, validateRequest, addComment);
router.patch('/:id/assign', assignCR);
router.patch('/:id/approvals/decide', authorize('can_approve_cr'), decideApproval);

module.exports = router;
