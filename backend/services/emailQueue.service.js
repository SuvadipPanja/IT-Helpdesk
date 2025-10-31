// ============================================
// EMAIL QUEUE SERVICE - ENHANCED
// Manages email queue, sending, and retries
// Creator: Suvadip Panja
// Project: Enterprise IT Helpdesk & Ticket Management System
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
    const emailSettings = await settingsService.getByCategory('email');

    logger.info('📧 Email settings loaded:', {
      smtp_enabled: emailSettings.smtp_enabled,
      smtp_host: emailSettings.smtp_host,
      smtp_port: emailSettings.smtp_port,
      smtp_username: emailSettings.smtp_username,
      smtp_encryption: emailSettings.smtp_encryption,
      has_password: !!emailSettings.smtp_password
    });

    // Convert smtp_enabled to boolean (handles string/number/boolean)
    const smtpEnabled = emailSettings.smtp_enabled === true || 
                        emailSettings.smtp_enabled === 'true' || 
                        emailSettings.smtp_enabled === 1 || 
                        emailSettings.smtp_enabled === '1';

    if (!smtpEnabled) {
      logger.warn('⚠️ SMTP is disabled in settings');
      return null;
    }

    if (!emailSettings.smtp_host || !emailSettings.smtp_username || !emailSettings.smtp_password) {
      logger.error('❌ SMTP settings incomplete', {
        has_host: !!emailSettings.smtp_host,
        has_username: !!emailSettings.smtp_username,
        has_password: !!emailSettings.smtp_password
      });
      return null;
    }

    const isSecure = emailSettings.smtp_encryption === 'SSL' || 
                     emailSettings.smtp_encryption === 'ssl';

    const transportConfig = {
      host: emailSettings.smtp_host,
      port: parseInt(emailSettings.smtp_port) || 587,
      secure: isSecure,
      auth: {
        user: emailSettings.smtp_username,
        pass: emailSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false // For Gmail with app passwords
      }
    };

    logger.info('📧 Creating transporter with config:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      user: transportConfig.auth.user
    });

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify transporter
    await transporter.verify();
    logger.success('✅ SMTP transporter created and verified successfully');

    return transporter;
  } catch (error) {
    logger.error('❌ Failed to create email transporter', error);
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

    const emailSettings = await settingsService.getByCategory('email');

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
      fromEmail: emailSettings.email_from_address || emailSettings.smtp_username,
      fromName: emailSettings.email_from_name || 'IT Helpdesk',
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

    // Send email with proper HTML content type
    const mailOptions = {
      from: `"${email.from_name}" <${email.from_email}>`,
      to: email.recipient_email,
      subject: email.subject,
      html: email.body,
      // ✅ FIXED: Add proper headers for HTML email
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'X-Priority': email.priority <= 2 ? '1' : '3'
      }
    };

    logger.try('Sending email via SMTP', { 
      emailId, 
      to: email.recipient_email,
      subject: email.subject
    });

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

    // Reset status to pending
    await executeQuery(`
      UPDATE email_queue
      SET 
        status = 'PENDING',
        error_message = NULL,
        last_error_at = NULL,
        next_retry_at = GETDATE()
      WHERE email_id = @emailId
    `, { emailId });

    // Process immediately
    const success = await processSingleEmail(emailId);

    logger.success('Email retry completed', { emailId, success });
    return success;

  } catch (error) {
    logger.error('Failed to retry email', { emailId, error });
    throw error;
  }
};

// ============================================
// GET QUEUE STATISTICS
// ============================================
const getQueueStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM email_queue
    `;

    const result = await executeQuery(query);
    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get queue stats', error);
    throw error;
  }
};

// ============================================
// GET TEMPLATE BY KEY
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
      logger.warn('Template not found', { templateKey });
      return null;
    }

    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get template', { templateKey, error });
    return null;
  }
};

// ============================================
// RENDER TEMPLATE WITH VARIABLES - ENHANCED
// ============================================
const renderTemplate = (template, variables) => {
  let subject = template.subject_template;
  let body = template.body_template;

  // Log variables being used
  logger.info('📝 Rendering template with variables:', {
    templateKey: template.template_key,
    variablesProvided: Object.keys(variables),
    variableCount: Object.keys(variables).length
  });

  // Replace all {{variable}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    
    // Convert value to string, handle null/undefined
    let replacementValue = '';
    
    if (value === null || value === undefined) {
      replacementValue = '';
      logger.warn(`Variable '${key}' is null/undefined, replacing with empty string`);
    } else if (typeof value === 'object') {
      replacementValue = JSON.stringify(value);
    } else {
      replacementValue = String(value);
    }

    // Count replacements for logging
    const subjectMatches = (subject.match(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const bodyMatches = (body.match(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (subjectMatches > 0 || bodyMatches > 0) {
      logger.info(`✅ Replacing '${placeholder}' with '${replacementValue}' (${subjectMatches + bodyMatches} occurrences)`);
    }

    // Replace in subject and body (case-sensitive, global)
    subject = subject.split(placeholder).join(replacementValue);
    body = body.split(placeholder).join(replacementValue);
  }

  // Check for any remaining unreplaced variables
  const subjectUnreplaced = subject.match(/\{\{[^}]+\}\}/g) || [];
  const bodyUnreplaced = body.match(/\{\{[^}]+\}\}/g) || [];
  
  if (subjectUnreplaced.length > 0 || bodyUnreplaced.length > 0) {
    const allUnreplaced = [...new Set([...subjectUnreplaced, ...bodyUnreplaced])];
    logger.warn('⚠️ Unreplaced variables found:', allUnreplaced);
  }

  logger.success('Template rendered successfully');

  return { subject, body };
};

// ============================================
// SEND TEMPLATED EMAIL - ENHANCED
// ============================================
const sendTemplatedEmail = async (templateKey, recipientEmail, variables, options = {}) => {
  try {
    logger.try('Sending templated email', { 
      templateKey, 
      recipient: recipientEmail,
      variablesCount: Object.keys(variables).length 
    });

    // Get template
    const template = await getTemplate(templateKey);

    if (!template) {
      logger.error('Template not found', { templateKey });
      return null;
    }

    // ✅ ENHANCED: Merge recipient name into variables if provided
    const allVariables = {
      ...variables,
      // If recipientName provided in options, add as user_name variable
      ...(options.recipientName ? { user_name: options.recipientName } : {})
    };

    // Render template
    const { subject, body } = renderTemplate(template, allVariables);

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

    logger.success('Templated email queued', { emailId, templateKey });
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