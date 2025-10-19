// ============================================
// EMAIL SERVICE (FIXED)
// Handles SMTP configuration and email sending
// FIXED: Boolean type checking for smtp_enabled
// ============================================

const nodemailer = require('nodemailer');
const { getSettingsByCategory } = require('./settings.service');

class EmailService {
  
  // ============================================
  // HELPER: Check if value is truthy
  // Handles both boolean and string values
  // ============================================
  isTruthy(value) {
    return value === true || 
           value === 'true' || 
           value === '1' || 
           value === 1;
  }

  // ============================================
  // GET TRANSPORTER
  // Creates nodemailer transporter with SMTP settings
  // ============================================
  async getTransporter() {
    try {
      const emailSettings = await getSettingsByCategory('email');
      
      const config = {
        host: emailSettings.smtp_host || 'smtp.gmail.com',
        port: parseInt(emailSettings.smtp_port) || 587,
        secure: emailSettings.smtp_encryption === 'ssl',
        auth: {
          user: emailSettings.smtp_username || '',
          pass: emailSettings.smtp_password || ''
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      return nodemailer.createTransport(config);
    } catch (error) {
      console.error('❌ Error creating email transporter:', error);
      throw error;
    }
  }

  // ============================================
  // TEST SMTP CONNECTION
  // FIXED: Handles both boolean and string values
  // ============================================
  async testConnection() {
    try {
      const emailSettings = await getSettingsByCategory('email');
      
      console.log('📧 Testing SMTP connection with settings:', {
        smtp_enabled: emailSettings.smtp_enabled,
        smtp_host: emailSettings.smtp_host,
        smtp_port: emailSettings.smtp_port,
        smtp_username: emailSettings.smtp_username,
        smtp_encryption: emailSettings.smtp_encryption
      });

      // FIXED: Check if SMTP is enabled (handle both boolean and string)
      if (!this.isTruthy(emailSettings.smtp_enabled)) {
        console.log('⚠️ SMTP is not enabled');
        return {
          success: false,
          message: 'SMTP is not enabled. Please enable it in settings.'
        };
      }

      // Check required fields
      if (!emailSettings.smtp_host || !emailSettings.smtp_username || !emailSettings.smtp_password) {
        console.log('⚠️ SMTP configuration incomplete');
        return {
          success: false,
          message: 'SMTP configuration incomplete. Please fill in all required fields.'
        };
      }

      console.log('🔄 Creating transporter and verifying connection...');
      const transporter = await this.getTransporter();
      
      // Verify connection
      await transporter.verify();
      
      console.log('✅ SMTP connection successful!');
      return {
        success: true,
        message: 'SMTP connection successful! Server is responding correctly.'
      };
      
    } catch (error) {
      console.error('❌ SMTP test failed:', error);
      
      let errorMessage = 'SMTP connection failed. ';
      
      if (error.code === 'EAUTH') {
        errorMessage += 'Authentication failed. Check username and password.';
      } else if (error.code === 'ESOCKET') {
        errorMessage += 'Cannot reach SMTP server. Check host and port.';
      } else if (error.code === 'ECONNECTION') {
        errorMessage += 'Connection refused. Check host and port.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += 'Connection timeout. Check host and port.';
      } else {
        errorMessage += error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  // ============================================
  // SEND TEST EMAIL
  // ============================================
  async sendTestEmail(toEmail) {
    try {
      const emailSettings = await getSettingsByCategory('email');
      
      // Check if SMTP is enabled
      if (!this.isTruthy(emailSettings.smtp_enabled)) {
        return {
          success: false,
          message: 'SMTP is not enabled. Please enable it in settings.'
        };
      }

      const transporter = await this.getTransporter();
      
      const mailOptions = {
        from: `"${emailSettings.email_from_name}" <${emailSettings.email_from_address}>`,
        to: toEmail,
        subject: 'Test Email from Nexus Support',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">📧 SMTP Test Email</h1>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #6366f1; margin-top: 0;">Connection Successful! ✅</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #334155;">
                This is a test email from your <strong>Nexus Support</strong> system.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #334155;">
                If you received this email, your SMTP configuration is working correctly!
              </p>
              
              <div style="background: white; padding: 20px; border-left: 4px solid #6366f1; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #6366f1;">✨ Your Email Settings:</h3>
                <ul style="color: #64748b; line-height: 1.8;">
                  <li><strong>SMTP Host:</strong> ${emailSettings.smtp_host}</li>
                  <li><strong>SMTP Port:</strong> ${emailSettings.smtp_port}</li>
                  <li><strong>Encryption:</strong> ${emailSettings.smtp_encryption?.toUpperCase()}</li>
                  <li><strong>From:</strong> ${emailSettings.email_from_name} &lt;${emailSettings.email_from_address}&gt;</li>
                </ul>
              </div>
              
              <p style="font-size: 14px; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <strong>Sent from:</strong> Nexus Support - IT Service Management Platform<br>
                <strong>Sent at:</strong> ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        `
      };
      
      console.log('📤 Sending test email to:', toEmail);
      await transporter.sendMail(mailOptions);
      console.log('✅ Test email sent successfully');
      
      return {
        success: true,
        message: `Test email sent successfully to ${toEmail}`
      };
      
    } catch (error) {
      console.error('❌ Send test email failed:', error);
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`
      };
    }
  }

  // ============================================
  // SEND TICKET NOTIFICATION EMAIL
  // FIXED: Boolean type checking
  // ============================================
  async sendTicketNotification(type, ticketData, recipientEmail) {
    try {
      const emailSettings = await getSettingsByCategory('email');
      
      // Check if SMTP is enabled
      if (!this.isTruthy(emailSettings.smtp_enabled)) {
        return { success: false, message: 'SMTP is not enabled' };
      }

      // Check if email notifications are enabled
      if (!this.isTruthy(emailSettings.email_notifications_enabled)) {
        return { success: false, message: 'Email notifications are disabled' };
      }

      // Check if this specific notification type is enabled
      const notificationKey = `notify_on_ticket_${type}`;
      if (!this.isTruthy(emailSettings[notificationKey])) {
        return { success: false, message: `Notification type '${type}' is disabled` };
      }

      const transporter = await this.getTransporter();
      
      // Email templates based on notification type
      const templates = {
        created: {
          subject: `New Ticket Created: #${ticketData.ticket_number}`,
          html: this.getTicketCreatedTemplate(ticketData)
        },
        assigned: {
          subject: `Ticket Assigned to You: #${ticketData.ticket_number}`,
          html: this.getTicketAssignedTemplate(ticketData)
        },
        updated: {
          subject: `Ticket Updated: #${ticketData.ticket_number}`,
          html: this.getTicketUpdatedTemplate(ticketData)
        },
        commented: {
          subject: `New Comment on Ticket: #${ticketData.ticket_number}`,
          html: this.getTicketCommentedTemplate(ticketData)
        }
      };

      const template = templates[type];
      
      if (!template) {
        return { success: false, message: 'Invalid notification type' };
      }

      const mailOptions = {
        from: `"${emailSettings.email_from_name}" <${emailSettings.email_from_address}>`,
        to: recipientEmail,
        subject: template.subject,
        html: template.html
      };
      
      await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        message: `Email sent to ${recipientEmail}`
      };
      
    } catch (error) {
      console.error('❌ Send notification failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================
  
  getTicketCreatedTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎫 New Ticket Created</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Ticket #:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Title:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Priority:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.priority_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Category:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.category_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Requester:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.requester_name}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets/${ticket.ticket_id}" 
               style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Ticket
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Sent from Nexus Support - IT Service Management Platform
          </p>
        </div>
      </div>
    `;
  }

  getTicketAssignedTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Ticket Assigned to You</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
            A new ticket has been assigned to you. Please review and work on it.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Ticket #:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Title:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Priority:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.priority_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Category:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.category_name}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets/${ticket.ticket_id}" 
               style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Ticket
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Sent from Nexus Support - IT Service Management Platform
          </p>
        </div>
      </div>
    `;
  }

  getTicketUpdatedTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔄 Ticket Updated</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Ticket #:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Title:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Status:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.status_name}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets/${ticket.ticket_id}" 
               style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Changes
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Sent from Nexus Support - IT Service Management Platform
          </p>
        </div>
      </div>
    `;
  }

  getTicketCommentedTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">💬 New Comment Added</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Ticket #:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Title:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;"><strong>Comment by:</strong></td>
                <td style="padding: 10px 0; color: #1e293b;">${ticket.comment_author}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets/${ticket.ticket_id}" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Comment
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Sent from Nexus Support - IT Service Management Platform
          </p>
        </div>
      </div>
    `;
  }
}

module.exports = new EmailService();