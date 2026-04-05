/**
 * ============================================
 * MY CHANGE REQUESTS PAGE
 * ============================================
 * Card-based view of user's own CRs.
 * Mirrors MyTickets pattern with status tabs.
 * ============================================
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  Plus,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
  Calendar,
  ArrowRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/CRList.css';

// Status color map
const STATUS_COLORS = {
  DRAFT: { bg: '#f1f5f9', text: '#64748b' },
  SUBMITTED: { bg: '#dbeafe', text: '#2563eb' },
  UNDER_REVIEW: { bg: '#fef3c7', text: '#d97706' },
  PENDING_APPROVAL: { bg: '#fef9c3', text: '#ca8a04' },
  PENDING_INFO: { bg: '#ffe4e6', text: '#e11d48' },
  APPROVED: { bg: '#d1fae5', text: '#059669' },
  REJECTED: { bg: '#fecdd3', text: '#dc2626' },
  SCHEDULED: { bg: '#e0e7ff', text: '#4f46e5' },
  IN_PROGRESS: { bg: '#ddd6fe', text: '#7c3aed' },
  IMPLEMENTED: { bg: '#ccfbf1', text: '#0d9488' },
  CLOSED: { bg: '#e2e8f0', text: '#475569' },
  CANCELLED: { bg: '#f3f4f6', text: '#9ca3af' },
};

const getStatusStyle = (code) => STATUS_COLORS[code] || STATUS_COLORS.DRAFT;

const RISK_COLORS = {
  LOW: { bg: '#d1fae5', text: '#059669' },
  MEDIUM: { bg: '#fef3c7', text: '#d97706' },
  HIGH: { bg: '#fee2e2', text: '#dc2626' },
  CRITICAL: { bg: '#fecdd3', text: '#991b1b' },
};
const getRiskStyle = (level) => RISK_COLORS[level] || RISK_COLORS.MEDIUM;

const TABS = [
  { key: 'all', label: 'All', icon: <Shield size={14} /> },
  { key: 'draft', label: 'Drafts', icon: <FileText size={14} /> },
  { key: 'active', label: 'Active', icon: <Clock size={14} /> },
  { key: 'pending', label: 'Pending', icon: <AlertCircle size={14} /> },
  { key: 'completed', label: 'Completed', icon: <CheckCircle size={14} /> },
];

const MyCRs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [crs, setCRs] = useState([]);
  const [filteredCRs, setFilteredCRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, draft: 0, active: 0, pending: 0, completed: 0 });

  useEffect(() => {
    fetchMyCRs();
  }, []);

  useEffect(() => {
    filterCRs();
  }, [activeTab, searchQuery, crs]);

  const fetchMyCRs = async () => {
    try {
      setLoading(true);
      const res = await crService.list({ requester_id: user.user_id, limit: 200 });
      if (res.data?.success) {
        const data = res.data.data.change_requests || res.data.data || [];
        setCRs(data);
        calculateStats(data);
      }
    } catch (err) {
      toast.error('Failed to load your change requests');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const draftCodes = ['DRAFT'];
    const activeCodes = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS'];
    const pendingCodes = ['PENDING_APPROVAL', 'PENDING_INFO'];
    const completedCodes = ['IMPLEMENTED', 'CLOSED', 'REJECTED', 'CANCELLED'];

    setStats({
      total: data.length,
      draft: data.filter(cr => draftCodes.includes(cr.status_code)).length,
      active: data.filter(cr => activeCodes.includes(cr.status_code)).length,
      pending: data.filter(cr => pendingCodes.includes(cr.status_code)).length,
      completed: data.filter(cr => completedCodes.includes(cr.status_code)).length,
    });
  };

  const filterCRs = () => {
    let result = [...crs];

    // Tab filter
    if (activeTab === 'draft') result = result.filter(cr => cr.status_code === 'DRAFT');
    else if (activeTab === 'active') result = result.filter(cr => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS'].includes(cr.status_code));
    else if (activeTab === 'pending') result = result.filter(cr => ['PENDING_APPROVAL', 'PENDING_INFO'].includes(cr.status_code));
    else if (activeTab === 'completed') result = result.filter(cr => ['IMPLEMENTED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(cr.status_code));

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(cr =>
        (cr.cr_number || '').toLowerCase().includes(q) ||
        (cr.title || '').toLowerCase().includes(q)
      );
    }

    setFilteredCRs(result);
  };

  return (
    <div className="cr-list-page">
      {/* Header */}
      <div className="cr-list-header">
        <div className="cr-list-header-left">
          <Shield size={24} className="cr-list-icon" />
          <div>
            <h1 className="cr-list-title">My Change Requests</h1>
            <p className="cr-list-subtitle">{stats.total} change requests</p>
          </div>
        </div>
        <div className="cr-list-header-actions">
          <button className="btn-cr-action" onClick={fetchMyCRs} title="Refresh">
            <RefreshCw size={16} />
          </button>
          {user?.permissions?.can_create_cr && (
            <button className="btn-cr-primary" onClick={() => navigate('/cr/create')}>
              <Plus size={16} />
              <span>New CR</span>
            </button>
          )}
        </div>
      </div>

      {/* Stat Tabs */}
      <div className="cr-stat-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`cr-stat-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span className="cr-stat-tab-label">{tab.label}</span>
            <span className="cr-stat-tab-count">{tab.key === 'all' ? stats.total : stats[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="cr-list-toolbar">
        <div className="cr-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by CR number, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="cr-cards-container">
        {loading ? (
          <div className="cr-loading">
            <Loader size={24} className="spinner" />
            <span>Loading your change requests...</span>
          </div>
        ) : filteredCRs.length === 0 ? (
          <div className="cr-empty">
            <Shield size={48} />
            <h3>No change requests found</h3>
            <p>{activeTab === 'all' ? 'Create your first change request' : 'No CRs in this category'}</p>
            {user?.permissions?.can_create_cr && (
              <button className="btn-cr-primary" onClick={() => navigate('/cr/create')}>
                <Plus size={16} /> New CR
              </button>
            )}
          </div>
        ) : (
          <div className="cr-card-grid">
            {filteredCRs.map(cr => {
              const statusStyle = getStatusStyle(cr.status_code);
              const riskStyle = getRiskStyle(cr.risk_level);
              return (
                <div key={cr.cr_id} className="cr-card" onClick={() => navigate(`/cr/${cr.cr_id}`)}>
                  <div className="cr-card-header">
                    <span className="cr-card-number">{cr.cr_number}</span>
                    <span className="cr-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                      {cr.status_name || cr.status_code}
                    </span>
                  </div>
                  <h3 className="cr-card-title">{cr.title}</h3>
                  <div className="cr-card-meta">
                    {cr.type_name && <span className="cr-card-type">{cr.type_name}</span>}
                    {cr.risk_level && (
                      <span className="cr-risk-badge" style={{ background: riskStyle.bg, color: riskStyle.text }}>
                        {cr.risk_level}
                      </span>
                    )}
                  </div>
                  <div className="cr-card-footer">
                    <span className="cr-card-date">
                      <Calendar size={12} />
                      {timeAgo(cr.created_at)}
                    </span>
                    <ArrowRight size={14} className="cr-card-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCRs;
