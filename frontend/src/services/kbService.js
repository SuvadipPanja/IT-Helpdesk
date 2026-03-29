// ============================================================
// KB Service — Knowledge Base API client
// ============================================================
import api from './api';

export const kbService = {
  getCategories:      ()           => api.get('/kb/categories'),
  getArticles:        (params)     => api.get('/kb/articles', { params }),
  getArticleBySlug:   (slug)       => api.get(`/kb/articles/by-slug/${slug}`),
  submitFeedback:     (id, data)   => api.post(`/kb/articles/${id}/feedback`, data),
  getFaqs:            (params)     => api.get('/kb/faqs', { params }),
  search:             (q)          => api.get('/kb/search', { params: { q } }),
  getPopular:         ()           => api.get('/kb/popular'),
  getPopularSearches: ()           => api.get('/kb/popular-searches'),
  getAnnouncements:   ()           => api.get('/kb/announcements'),

  // Admin
  getAdminArticles:   (params)     => api.get('/kb/admin/articles', { params }),
  createArticle:      (data)       => api.post('/kb/admin/articles', data),
  updateArticle:      (id, data)   => api.put(`/kb/admin/articles/${id}`, data),
  archiveArticle:     (id)         => api.delete(`/kb/admin/articles/${id}`),
  publishArticle:     (id)         => api.post(`/kb/admin/articles/${id}/publish`),

  createCategory:     (data)       => api.post('/kb/admin/categories', data),
  updateCategory:     (id, data)   => api.put(`/kb/admin/categories/${id}`, data),

  createFaq:          (data)       => api.post('/kb/admin/faqs', data),
  updateFaq:          (id, data)   => api.put(`/kb/admin/faqs/${id}`, data),
  deleteFaq:          (id)         => api.delete(`/kb/admin/faqs/${id}`),

  getAnalytics:       ()           => api.get('/kb/admin/analytics'),

  createAnnouncement:     (data)       => api.post('/kb/admin/announcements', data),
  updateAnnouncement:     (id, data)   => api.put(`/kb/admin/announcements/${id}`, data),
  deleteAnnouncement:     (id)         => api.delete(`/kb/admin/announcements/${id}`),
  getAdminAnnouncements:  ()           => api.get('/kb/admin/announcements'),
};
