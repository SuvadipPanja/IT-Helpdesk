// ============================================
// EMAIL QUEUE SERVICE
// Manages email queue, sending, and retries
// FILE: backend/services/emailQueue.service.js
// ============================================

const nodemailer = require('nodemailer');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');

// ============================================
// CREATE TRANSPORTER FROM SETTINGS
// ============================================
const createTransporter = async () => {
  try {
    const settings = await settingsService.getAllSettings();
    const emailSettings = settings.email || {};

    if (!emailSettings.smtp_enabled || emailSettings.smtp_enabled === 'false') {
      logger.warn('SMTP is disabled in settings');
      return null;
    }

    const transporter = nodemailer.createTransporter({
      host: emailSettings.smtp_host || 'smtp.gmail.com',
      port: parseInt(emailSettings.smtp_port) || 587,
      secure: emailSettings.smtp_encryption === 'SSL' || emailSettings.smtp_encryption === 'ssl',
      auth: {
        user: emailSettings.smtp_username,
        pass: emailSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: emailSettings.smtp_tls_verify !== 'false'
      }
    });

    return transporter;
  } catch (error) {
    logger.error('Failed to create email transporter', error);
    return null;
  }
};

// ============================================
// ADD EMAIL TO QUEUE
// ============================================
const addToQueue = async ({
  recipientEmail,
  recipientName = null,
  recipientUserId = null,
  subject,
  body,
  templateUsed = null,
  emailType,
  relatedEntityType = null,
  relatedEntityId = null,
  priority = 3,
  metadata = null
}) => {
  try {
    logger.try('Adding email to queue', {
      recipient: recipientEmail,
      type: emailType,
      subject
    });

    const settings = await settingsService.getAllSettings();
    const emailSettings = settings.email || {};

    const query = `
      INSERT INTO email_queue (
        recipient_email,
        recipient_name,
        recipient_user_id,
        subject,
        body,
        template_used,
        email_type,
        related_entity_type,
        related_entity_id,
        status,
        priority,
        smtp_host,
        smtp_port,
        from_email,
        from_name,
        metadata,
        created_at
      )
      OUTPUT INSERTED.email_id
      VALUES (
        @recipientEmail,
        @recipientName,
        @recipientUserId,
        @subject,
        @body,
        @templateUsed,
        @emailType,
        @relatedEntityType,
        @relatedEntityId,
        'PENDING',
        @priority,
        @smtpHost,
        @smtpPort,
        @fromEmail,
        @fromName,
        @metadata,
        GETDATE()
      )
    `;

    const result = await executeQuery(query, {
      recipientEmail,
      recipientName,
      recipientUserId,
      subject,
      body,
      templateUsed,
      emailType,
      relatedEntityType,
      relatedEntityId,
      priority,
      smtpHost: emailSettings.smtp_host || 'smtp.gmail.com',
      smtpPort: emailSettings.smtp_port || 587,
      fromEmail: emailSettings.from_email || emailSettings.smtp_username,
      fromName: emailSettings.from_name || 'IT Helpdesk',
      metadata: metadata ? JSON.stringify(metadata) : null
    });

    const emailId = result.recordset[0].email_id;

    logger.success('Email added to queue', { emailId, recipient: recipientEmail });

    // Try to send immediately (async, don't wait)
    setImmediate(() => processSingleEmail(emailId));

    return emailId;
  } catch (error) {
    logger.error('Failed to add email to queue', error);
    throw error;
  }
};

// ============================================
// PROCESS SINGLE EMAIL
// ============================================
const processSingleEmail = async (emailId) => {
  try {
    logger.try('Processing email from queue', { emailId });

    // Get email from queue
    const emailQuery = `
      SELECT *
      FROM email_queue
      WHERE email_id = @emailId
        AND status = 'PENDING'
        AND retry_count < max_retries
    `;

    const emailResult = await executeQuery(emailQuery, { emailId });

    if (emailResult.recordset.length === 0) {
      logger.warn('Email not found or not eligible for sending', { emailId });
      return false;
    }

    const email = emailResult.recordset[0];

    // Create transporter
    const transporter = await createTransporter();

    if (!transporter) {
      logger.error('Cannot send email - SMTP not configured');
      
      // Mark as failed
      await executeQuery(`
        UPDATE email_queue
        SET 
          status = 'FAILED',
          error_message = 'SMTP not configured',
          failed_at = GETDATE(),
          retry_count = retry_count + 1
        WHERE email_id = @emailId
      `, { emailId });

      return false;
    }

    // Send email
    const mailOptions = {
      from: `"${email.from_name}" <${email.from_email}>`,
      to: email.recipient_email,
      subject: email.subject,
      html: email.body
    };

    logger.try('Sending email via SMTP', { emailId, to: email.recipient_email });

    await transporter.sendMail(mailOptions);

    // Mark as sent
    await executeQuery(`
      UPDATE email_queue
      SET 
        status = 'SENT',
        sent_at = GETDATE(),
        error_message = NULL
      WHERE email_id = @emailId
    `, { emailId });

    logger.success('Email sent successfully', { emailId });
    return true;

  } catch (error) {
    logger.error('Failed to send email', { emailId, error: error.message });

    // Mark as failed and increment retry
    await executeQuery(`
      UPDATE email_queue
      SET 
        status = CASE 
          WHEN retry_count + 1 >= max_retries THEN 'FAILED'
          ELSE 'PENDING'
        END,
        error_message = @errorMessage,
        last_error_at = GETDATE(),
        retry_count = retry_count + 1,
        next_retry_at = CASE 
          WHEN retry_count + 1 < max_retries THEN DATEADD(MINUTE, POWER(2, retry_count + 1) * 5, GETDATE())
          ELSE NULL
        END,
        failed_at = CASE 
          WHEN retry_count + 1 >= max_retries THEN GETDATE()
          ELSE NULL
        END
      WHERE email_id = @emailId
    `, { 
      emailId,
      errorMessage: error.message 
    });

    return false;
  }
};

// ============================================
// PROCESS PENDING EMAILS (Background Job)
// ============================================
const processPendingEmails = async (limit = 10) => {
  try {
    logger.try('Processing pending emails in queue');

    const query = `
      SELECT TOP ${limit} email_id
      FROM email_queue
      WHERE status = 'PENDING'
        AND retry_count < max_retries
        AND (next_retry_at IS NULL OR next_retry_at <= GETDATE())
      ORDER BY priority ASC, created_at ASC
    `;

    const result = await executeQuery(query);
    const emails = result.recordset;

    if (emails.length === 0) {
      logger.info('No pending emails to process');
      return 0;
    }

    logger.info(`Processing ${emails.length} pending emails`);

    let successCount = 0;
    for (const email of emails) {
      const success = await processSingleEmail(email.email_id);
      if (success) successCount++;
    }

    logger.success(`Processed ${successCount}/${emails.length} emails successfully`);
    return successCount;

  } catch (error) {
    logger.error('Failed to process pending emails', error);
    return 0;
  }
};

// ============================================
// RETRY FAILED EMAIL
// ============================================
const retryEmail = async (emailId) => {
  try {
    logger.try('Retrying failed email', { emailId });

    // Reset retry count and status
    await executeQuery(`
      UPDATE email_queue
      SET 
        status = 'PENDING',
        retry_count = 0,
        next_retry_at = NULL,
        error_message = NULL
      WHERE email_id = @emailId
        AND status = 'FAILED'
    `, { emailId });

    // Try sending immediately
    return await processSingleEmail(emailId);

  } catch (error) {
    logger.error('Failed to retry email', error);
    return false;
  }
};

// ============================================
// GET EMAIL QUEUE STATISTICS
// ============================================
const getQueueStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_emails,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        AVG(CASE WHEN status = 'SENT' THEN DATEDIFF(SECOND, created_at, sent_at) ELSE NULL END) as avg_send_time_seconds
      FROM email_queue
    `;

    const result = await executeQuery(query);
    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get queue stats', error);
    return null;
  }
};

// ============================================
// GET EMAIL TEMPLATE
// ============================================
const getTemplate = async (templateKey) => {
  try {
    const query = `
      SELECT *
      FROM email_templates
      WHERE template_key = @templateKey
        AND is_active = 1
    `;

    const result = await executeQuery(query, { templateKey });

    if (result.recordset.length === 0) {
      logger.warn('Email template not found', { templateKey });
      return null;
    }

    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get email template', error);
    return null;
  }
};

// ============================================
// RENDER TEMPLATE WITH VARIABLES
// ============================================
const renderTemplate = (template, variables) => {
  let subject = template.subject_template;
  let body = template.body_template;

  // Replace all {{variable}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value || '');
    body = body.replace(new RegExp(placeholder, 'g'), value || '');
  }

  return { subject, body };
};

// ============================================
// SEND TEMPLATED EMAIL
// ============================================
const sendTemplatedEmail = async (templateKey, recipientEmail, variables, options = {}) => {
  try {
    logger.try('Sending templated email', { templateKey, recipient: recipientEmail });

    // Get template
    const template = await getTemplate(templateKey);

    if (!template) {
      logger.error('Template not found', { templateKey });
      return null;
    }

    // Render template
    const { subject, body } = renderTemplate(template, variables);

    // Add to queue
    const emailId = await addToQueue({
      recipientEmail,
      recipientName: options.recipientName || null,
      recipientUserId: options.recipientUserId || null,
      subject,
      body,
      templateUsed: templateKey,
      emailType: options.emailType || templateKey,
      relatedEntityType: options.relatedEntityType || null,
      relatedEntityId: options.relatedEntityId || null,
      priority: options.priority || 3,
      metadata: options.metadata || null
    });

    return emailId;

  } catch (error) {
    logger.error('Failed to send templated email', error);
    return null;
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  addToQueue,
  processSingleEmail,
  processPendingEmails,
  retryEmail,
  getQueueStats,
  getTemplate,
  renderTemplate,
  sendTemplatedEmail,
  createTransporter
};