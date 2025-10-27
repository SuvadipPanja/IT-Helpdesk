// ============================================
// EMAIL QUEUE PAGE
// Main page for email queue management
// FILE: frontend/src/pages/email/EmailQueue.jsx
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Trash2, RotateCw } from 'lucide-react';
import EmailQueueStats from '../../components/email/EmailQueueStats';
import EmailQueueTable from '../../components/email/EmailQueueTable';
import EmailDetailModal from '../../components/email/EmailDetailModal';
import emailQueueService from '../../services/emailQueue.service';
import '../../styles/EmailQueue.css'; // ← IMPORT CSS

const EmailQueue = () => {
  // State
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 20,
    totalRecords: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    email_type: '',
    search: '',
    start_date: '',
    end_date: '',
  });

  // Auto-refresh interval (30 seconds)
  const AUTO_REFRESH_INTERVAL = 30000;

  // ============================================
  // FETCH EMAIL QUEUE
  // ============================================
  const fetchEmailQueue = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: pagination.limit,
        ...filters,
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await emailQueueService.getEmailQueue(params);

      if (response.success) {
        setEmails(response.data.emails);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch email queue:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, filters]);

  // ============================================
  // FETCH STATISTICS
  // ============================================
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await emailQueueService.getEmailQueueStats();
      if (response.success) {
        setStats(response.data.overview);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    fetchEmailQueue();
    fetchStats();
  }, [fetchEmailQueue, fetchStats]);

  // ============================================
  // AUTO REFRESH
  // ============================================
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmailQueue();
      fetchStats();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchEmailQueue, fetchStats]);

  // ============================================
  // HANDLE MANUAL REFRESH
  // ============================================
  const handleRefresh = () => {
    fetchEmailQueue();
    fetchStats();
  };

  // ============================================
  // HANDLE PAGE CHANGE
  // ============================================
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  // ============================================
  // HANDLE FILTER CHANGE
  // ============================================
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
  };

  // ============================================
  // HANDLE SEARCH
  // ============================================
  const handleSearch = (e) => {
    e.preventDefault();
    fetchEmailQueue();
  };

  // ============================================
  // HANDLE VIEW EMAIL
  // ============================================
  const handleViewEmail = async (email) => {
    try {
      const response = await emailQueueService.getEmailById(email.email_id);
      if (response.success) {
        setSelectedEmail(response.data);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch email details:', error);
      alert('Failed to load email details');
    }
  };

  // ============================================
  // HANDLE RETRY EMAIL
  // ============================================
  const handleRetryEmail = async (emailId) => {
    try {
      const response = await emailQueueService.retryEmail(emailId);
      if (response.success) {
        alert('Email retry initiated successfully');
        fetchEmailQueue();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to retry email:', error);
      alert('Failed to retry email');
    }
  };

  // ============================================
  // HANDLE DELETE EMAIL
  // ============================================
  const handleDeleteEmail = async (emailId) => {
    try {
      const response = await emailQueueService.deleteEmail(emailId);
      if (response.success) {
        alert('Email deleted successfully');
        fetchEmailQueue();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to delete email:', error);
      alert('Failed to delete email');
    }
  };

  // ============================================
  // HANDLE RETRY ALL FAILED
  // ============================================
  const handleRetryAllFailed = async () => {
    if (!window.confirm('Are you sure you want to retry all failed emails?')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await emailQueueService.retryAllFailed();
      if (response.success) {
        alert(`Successfully retried ${response.data.retried} email(s)`);
        fetchEmailQueue();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to retry all failed:', error);
      alert('Failed to retry failed emails');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // HANDLE CLEAR OLD EMAILS
  // ============================================
  const handleClearOldEmails = async () => {
    const days = prompt('Delete emails older than how many days?', '30');
    if (!days) return;

    if (!window.confirm(`Are you sure you want to delete emails older than ${days} days?`)) {
      return;
    }

    try {
      setProcessing(true);
      const response = await emailQueueService.clearOldEmails(parseInt(days));
      if (response.success) {
        alert(`Successfully deleted ${response.data.deletedCount} email(s)`);
        fetchEmailQueue();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to clear old emails:', error);
      alert('Failed to clear old emails');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="email-queue-page">
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Email Queue Management</h1>
          <p className="page-description">Monitor and manage email notifications</p>
        </div>

        {/* Statistics */}
        <EmailQueueStats stats={stats} loading={statsLoading} />

        {/* Filters and Actions */}
        <div className="filters-section">
          <div className="filters-row">
            {/* Search */}
            <form onSubmit={handleSearch} className="search-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search by email or subject..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
            </form>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="SENT">Sent</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Email Type Filter */}
            <select
              value={filters.email_type}
              onChange={(e) => handleFilterChange('email_type', e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="TICKET_CREATED">Ticket Created</option>
              <option value="TICKET_ASSIGNED">Ticket Assigned</option>
              <option value="TICKET_STATUS_CHANGED">Status Changed</option>
              <option value="TICKET_COMMENT_ADDED">Comment Added</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="refresh-btn"
            >
              <RefreshCw className={loading ? 'icon-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Bulk Actions */}
          <div className="bulk-actions">
            <button
              onClick={handleRetryAllFailed}
              disabled={processing || stats?.failed_count === 0}
              className="bulk-action-btn retry-all"
            >
              <RotateCw className={processing ? 'icon-spin' : ''} />
              Retry All Failed ({stats?.failed_count || 0})
            </button>

            <button
              onClick={handleClearOldEmails}
              disabled={processing}
              className="bulk-action-btn clear-old"
            >
              <Trash2 />
              Clear Old Emails
            </button>
          </div>
        </div>

        {/* Email Table */}
        <EmailQueueTable
          emails={emails}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onViewEmail={handleViewEmail}
          onRetryEmail={handleRetryEmail}
          onDeleteEmail={handleDeleteEmail}
        />

        {/* Email Detail Modal */}
        <EmailDetailModal
          email={selectedEmail}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmail(null);
          }}
        />
      </div>
    </div>
  );
};

export default EmailQueue;