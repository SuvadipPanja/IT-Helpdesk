// ============================================
// CR (Change Request) API Service
// ============================================

import api from './api';

const crService = {
  // Lookups (types, categories, statuses)
  getLookups: () => api.get('/cr/lookups'),

  // Stats
  getStats: () => api.get('/cr/stats'),

  // CRUD
  list: (params) => api.get('/cr', { params }),
  getById: (id) => api.get(`/cr/${id}`),
  create: (data) => api.post('/cr', data),
  update: (id, data) => api.put(`/cr/${id}`, data),
  delete: (id) => api.delete(`/cr/${id}`),

  // Workflow transitions
  submit: (id, data) => api.patch(`/cr/${id}/submit`, data || {}),
  startReview: (id) => api.patch(`/cr/${id}/start-review`),
  requestInfo: (id, data) => api.patch(`/cr/${id}/request-info`, data),
  provideInfo: (id, data) => api.patch(`/cr/${id}/provide-info`, data),
  approve: (id, data) => api.patch(`/cr/${id}/approve`, data),
  reject: (id, data) => api.patch(`/cr/${id}/reject`, data),
  schedule: (id, data) => api.patch(`/cr/${id}/schedule`, data),
  start: (id, data) => api.patch(`/cr/${id}/start`, data || {}),
  complete: (id, data) => api.patch(`/cr/${id}/complete`, data),
  rollback: (id, data) => api.patch(`/cr/${id}/rollback`, data),
  cancel: (id, data) => api.patch(`/cr/${id}/cancel`, data),
  resubmit: (id) => api.patch(`/cr/${id}/resubmit`),
  close: (id, data) => api.patch(`/cr/${id}/close`, data),
  reschedule: (id, data) => api.patch(`/cr/${id}/reschedule`, data),
  sendToApproval: (id) => api.patch(`/cr/${id}/send-to-approval`),
  raiseIssue: (id, data) => api.patch(`/cr/${id}/raise-issue`, data),
  notBelongsToMe: (id, data) => api.patch(`/cr/${id}/not-belongs-to-me`, data),

  // Comments & Assignment
  addComment: (id, data) => api.post(`/cr/${id}/comments`, data),
  assign: (id, data) => api.patch(`/cr/${id}/assign`, data),

  // Approvals
  getPendingApprovals: () => api.get('/cr/pending-approvals'),
  getApprovalStats: () => api.get('/cr/approval-stats'),
  decideApproval: (id, data) => api.patch(`/cr/${id}/approvals/decide`, data),
  getMyCRApprovals: (queryString) => api.get(`/cr/my-cr-approvals?${queryString || ''}`),

  // Calendar & Blackouts
  getCalendar: (params) => api.get('/cr/calendar', { params }),
  getBlackouts: () => api.get('/cr/blackouts'),
  createBlackout: (data) => api.post('/cr/blackouts', data),
  deleteBlackout: (id) => api.delete(`/cr/blackouts/${id}`),

  // Approvers & Settings
  getApprovers: () => api.get('/cr/approvers'),
  getCRSettings: () => api.get('/cr/cr-settings'),

  // Team Bucket
  getTeamBucketStats: () => api.get('/cr-team-bucket/stats'),
  getTeamBucketItems: (params) => api.get('/cr-team-bucket', { params }),
  teamBucketSelfAssign: (id) => api.post(`/cr-team-bucket/${id}/self-assign`),
  teamBucketRoute: (id, targetTeamId) => api.post(`/cr-team-bucket/${id}/route`, { target_team_id: targetTeamId }),
};

export default crService;
