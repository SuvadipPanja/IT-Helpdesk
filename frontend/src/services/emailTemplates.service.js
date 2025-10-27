// ============================================
// EMAIL TEMPLATES SERVICE
// API calls for email template management
// FILE: frontend/src/services/emailTemplates.service.js
// ============================================

import api from './api';

class EmailTemplatesService {
  
  // ============================================
  // GET ALL EMAIL TEMPLATES
  // ============================================
  async getAllTemplates(params = {}) {
    try {
      const response = await api.get('/email-templates', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Get all templates failed:', error);
      throw error;
    }
  }

  // ============================================
  // GET SINGLE EMAIL TEMPLATE
  // ============================================
  async getTemplateById(templateId) {
    try {
      const response = await api.get(`/email-templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Get template by ID failed:', error);
      throw error;
    }
  }

  // ============================================
  // CREATE EMAIL TEMPLATE
  // ============================================
  async createTemplate(templateData) {
    try {
      const response = await api.post('/email-templates', templateData);
      return response.data;
    } catch (error) {
      console.error('❌ Create template failed:', error);
      throw error;
    }
  }

  // ============================================
  // UPDATE EMAIL TEMPLATE
  // ============================================
  async updateTemplate(templateId, templateData) {
    try {
      const response = await api.put(`/email-templates/${templateId}`, templateData);
      return response.data;
    } catch (error) {
      console.error('❌ Update template failed:', error);
      throw error;
    }
  }

  // ============================================
  // DELETE EMAIL TEMPLATE
  // ============================================
  async deleteTemplate(templateId) {
    try {
      const response = await api.delete(`/email-templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Delete template failed:', error);
      throw error;
    }
  }

  // ============================================
  // PREVIEW EMAIL TEMPLATE
  // ============================================
  async previewTemplate(templateId, sampleData = null) {
    try {
      const response = await api.post(`/email-templates/${templateId}/preview`, {
        sampleData
      });
      return response.data;
    } catch (error) {
      console.error('❌ Preview template failed:', error);
      throw error;
    }
  }

  // ============================================
  // TOGGLE TEMPLATE STATUS
  // ============================================
  async toggleTemplateStatus(templateId) {
    try {
      const response = await api.patch(`/email-templates/${templateId}/toggle`);
      return response.data;
    } catch (error) {
      console.error('❌ Toggle template status failed:', error);
      throw error;
    }
  }
}

export default new EmailTemplatesService();