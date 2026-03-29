const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/publicEmailApproval.controller');

const router = express.Router();

const windowMs = parseInt(process.env.PUBLIC_EMAIL_APPROVAL_RATE_WINDOW_MS || '900000', 10);
const max = parseInt(process.env.PUBLIC_EMAIL_APPROVAL_RATE_MAX || '40', 10);

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/context', limiter, ctrl.getEmailApprovalContext);
router.post('/decision', limiter, ctrl.postEmailApprovalDecision);

module.exports = router;
