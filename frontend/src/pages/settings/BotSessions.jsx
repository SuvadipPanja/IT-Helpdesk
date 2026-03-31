// ============================================
// BOT SESSIONS PAGE
// View, search, download and analyze bot chat sessions
// Real-time data from bot_chat_sessions & bot_chat_messages
// Created: March 2026
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Download,
  Eye,
  RefreshCw,
  X,
  User,
  Bot,
  Clock,
  Zap,
  TrendingUp,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileText,
  Loader,
  MessageCircle,
  Trash2
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/BotSessions.css';

const BotSessions = ({ embedded = false }) => {
  // State
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    dateFrom: '',
    dateTo: '',
  });

  // ============================================
  // FETCH SESSIONS
  // ============================================
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.search) params.search = filters.search;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await api.get('/bot/sessions', { params });
      if (response.data.success) {
        setSessions(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // ============================================
  // FETCH DASHBOARD STATS
  // ============================================
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await api.get('/bot/sessions/stats/dashboard');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============================================
  // FETCH SESSION DETAIL
  // ============================================
  const openSessionDetail = async (sessionId) => {
    try {
      setDetailLoading(true);
      setSelectedSession(sessionId);
      const response = await api.get(`/bot/sessions/${sessionId}`);
      if (response.data.success) {
        setSessionDetail(response.data.data);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch session detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedSession(null);
    setSessionDetail(null);
  };

  // ============================================
  // DOWNLOAD SESSION
  // ============================================
  const downloadSession = async (sessionId, format = 'json') => {
    try {
      const response = await api.get(`/bot/sessions/${sessionId}/download`, {
        params: { format },
        responseType: format === 'csv' ? 'text' : 'json',
      });

      const blob = new Blob(
        [format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
        { type: format === 'csv' ? 'text/csv' : 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bot-session-${sessionId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to download session:', error);
    }
  };

  // ============================================
  // CLEANUP SESSIONS
  // ============================================
  const handleCleanup = async () => {
    if (!window.confirm('Close inactive sessions (idle > 2 hours)?')) return;
    try {
      await api.post('/bot/sessions/cleanup', { hoursThreshold: 2 });
      fetchSessions();
      fetchStats();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Cleanup failed:', error);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ============================================
  // HELPERS
  // ============================================
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`bot-sessions-page ${embedded ? 'bot-sessions-embedded' : ''}`}>
      {/* Page Header - hidden when embedded in Analytics */}
      {!embedded && (
      <div className="page-header">
        <h1>
          <MessageSquare size={28} />
          Bot Chat Sessions
        </h1>
        <div className="header-actions">
          <button onClick={handleCleanup} title="Cleanup inactive sessions">
            <Trash2 size={16} /> Cleanup
          </button>
          <button onClick={() => { fetchSessions(); fetchStats(); }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="stats-overview">
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#10b981' }}>
              <Activity size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.active_sessions || 0}</div>
              <div className="stat-text">Active Sessions</div>
            </div>
          </div>
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#6366f1' }}>
              <MessageCircle size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.total_messages || 0}</div>
              <div className="stat-text">Total Messages</div>
            </div>
          </div>
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#3b82f6' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.total_sessions || 0}</div>
              <div className="stat-text">Total Sessions</div>
            </div>
          </div>
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#f59e0b' }}>
              <Users size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.unique_users || 0}</div>
              <div className="stat-text">Unique Users</div>
            </div>
          </div>
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#8b5cf6' }}>
              <Zap size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.sessions_today || 0}</div>
              <div className="stat-text">Sessions Today</div>
            </div>
          </div>
          <div className="overview-stat-card">
            <div className="stat-icon-wrap" style={{ background: '#ef4444' }}>
              <Zap size={24} />
            </div>
            <div>
              <div className="stat-number">{stats.ai_enhanced_responses || 0}</div>
              <div className="stat-text">AI Enhanced</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by user, session ID, or summary..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
        <select
          value={filters.isActive}
          onChange={(e) => handleFilterChange('isActive', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Ended</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          title="From date"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          title="To date"
        />
      </div>

      {/* Sessions Table */}
      <div className="sessions-table-wrap">
        {loading ? (
          <div className="loading-state">
            <Loader size={32} />
            <span>Loading sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <h3>No Sessions Found</h3>
            <p>Bot chat sessions will appear here once users start chatting with the AI assistant.</p>
          </div>
        ) : (
          <>
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Messages</th>
                  <th>Confidence</th>
                  <th>AI Enhanced</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.session_id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {getInitials(session.user_name)}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{session.user_name}</div>
                          <div className="user-role">{session.user_role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${session.is_active ? 'active' : 'ended'}`}>
                        {session.is_active ? '● Active' : '○ Ended'}
                      </span>
                    </td>
                    <td>{formatDate(session.started_at)}</td>
                    <td>{formatDuration(session.duration)}</td>
                    <td>
                      <div className="msg-count">
                        <MessageCircle size={14} />
                        {session.total_messages || 0}
                      </div>
                    </td>
                    <td>
                      {session.avg_confidence 
                        ? `${(session.avg_confidence * 100).toFixed(0)}%` 
                        : '-'}
                    </td>
                    <td>{session.ai_enhanced_count || 0}</td>
                    <td>
                      <div className="action-btns">
                        <button
                          onClick={() => openSessionDetail(session.session_id)}
                          title="View session transcript"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => downloadSession(session.session_id, 'json')}
                          title="Download as JSON"
                        >
                          <FileJson size={16} />
                        </button>
                        <button
                          onClick={() => downloadSession(session.session_id, 'csv')}
                          title="Download as CSV"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="pagination-bar">
              <div className="page-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} sessions
              </div>
              <div className="page-btns">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={pagination.page === pageNum ? 'active' : ''}
                      onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="session-detail-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) closeDetail();
        }}>
          <div className="session-detail-modal">
            <div className="modal-header">
              <h2>
                <MessageSquare size={20} />
                Session Transcript
              </h2>
              <div className="modal-actions">
                <button onClick={() => downloadSession(selectedSession, 'json')}>
                  <FileJson size={14} /> JSON
                </button>
                <button onClick={() => downloadSession(selectedSession, 'csv')}>
                  <FileText size={14} /> CSV
                </button>
                <button className="close-btn" onClick={closeDetail}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="loading-state" style={{ padding: '60px' }}>
                <Loader size={32} />
                <span>Loading transcript...</span>
              </div>
            ) : sessionDetail ? (
              <>
                {/* Session Info Bar */}
                <div className="session-info-bar">
                  <div className="info-item">
                    <div className="info-label">User</div>
                    <div className="info-value">{sessionDetail.session.user_name}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Role</div>
                    <div className="info-value">{sessionDetail.session.user_role}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Messages</div>
                    <div className="info-value">{sessionDetail.messageCount}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Duration</div>
                    <div className="info-value">{formatDuration(sessionDetail.session.duration)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Status</div>
                    <div className="info-value">
                      {sessionDetail.session.is_active ? 'Active' : 'Ended'}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Started</div>
                    <div className="info-value" style={{ fontSize: '12px' }}>
                      {formatDate(sessionDetail.session.started_at)}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {sessionDetail.session.summary && (
                  <div className="session-summary">
                    <h4>Session Summary</h4>
                    <p>{sessionDetail.session.summary}</p>
                  </div>
                )}

                {/* Chat Messages */}
                <div className="chat-transcript">
                  {sessionDetail.messages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.message_type === 'user' ? 'user-msg' : 'bot-msg'}`}>
                      <div className="msg-avatar">
                        {msg.message_type === 'user' ? <User size={18} /> : <Bot size={18} />}
                      </div>
                      <div className="msg-body">
                        <div className="msg-header">
                          <span className="msg-sender">
                            {msg.message_type === 'user' ? sessionDetail.session.user_name : 'AI Assistant'}
                          </span>
                          <span className="msg-time">{formatDate(msg.created_at)}</span>
                        </div>
                        {msg.message_type === 'bot' && (
                          <div className="msg-meta-badges">
                            {msg.intent_matched && (
                              <span className="meta-badge intent">
                                Intent: {msg.intent_matched}
                              </span>
                            )}
                            {msg.category && (
                              <span className="meta-badge category">
                                {msg.category}
                              </span>
                            )}
                            {msg.confidence != null && (
                              <span className="meta-badge confidence">
                                {(msg.confidence * 100).toFixed(0)}% confidence
                              </span>
                            )}
                            {msg.ai_enhanced && (
                              <span className="meta-badge ai-enhanced">
                                AI: {msg.ai_provider || 'Enhanced'}
                              </span>
                            )}
                            {msg.action_type && (
                              <span className="meta-badge action">
                                Action: {msg.action_type}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="msg-content">{msg.message_content}</div>
                      </div>
                    </div>
                  ))}

                  {sessionDetail.messages.length === 0 && (
                    <div className="empty-state">
                      <MessageSquare size={32} />
                      <h3>No Messages</h3>
                      <p>This session has no recorded messages yet.</p>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default BotSessions;
