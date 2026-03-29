// ============================================
// EMAIL QUEUE SERVICE
// API calls for email queue management
// FILE: frontend/src/services/emailQueue.service.js
// ============================================

import api from './api';

class EmailQueueService {
  
  // ============================================
  // GET EMAIL QUEUE WITH FILTERS
  // ============================================
  async getEmailQueue(params = {}) {
    try {
      const response = await api.get('/email-queue', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // GET EMAIL QUEUE STATISTICS
  // ============================================
  async getEmailQueueStats() {
    try {
      const response = await api.get('/email-queue/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // GET SINGLE EMAIL DETAILS
  // ============================================
  async getEmailById(emailId) {
    try {
      const response = await api.get(`/email-queue/${emailId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // RETRY SINGLE EMAIL
  // ============================================
  async retryEmail(emailId) {
    try {
      const response = await api.post(`/email-queue/${emailId}/retry`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // RETRY ALL FAILED EMAILS
  // ============================================
  async retryAllFailed() {
    try {
      const response = await api.post('/email-queue/retry-all-failed');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // DELETE SINGLE EMAIL
  // ============================================
  async deleteEmail(emailId) {
    try {
      const response = await api.delete(`/email-queue/${emailId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // CLEAR OLD EMAILS
  // ============================================
  async clearOldEmails(days = 30) {
    try {
      const response = await api.delete('/email-queue/clear-old', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default new EmailQueueService();