/**
 * Pending ticket closure approvals — managers / admins / central mgmt only.
 * Lists tickets in "Pending Closure" awaiting approve/reject.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Archive,
  Loader,
  ChevronRight,
  Clock,
} from 'lucide-react';
import RefreshButton from '../../components/shared/RefreshButton';
import api from '../../services/api';
import { formatDate as formatDateUtil } from '../../utils/dateUtils';
import '../../styles/MyApprovals.css';

const formatDate = (d) => (d ? formatDateUtil(d) : '—');

const REVIEWER_ROLES = ['ADMIN', 'MANAGER', 'CENTRAL_MGMT'];

const PendingClosures = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canAccess = REVIEWER_ROLES.includes(user?.role?.role_code || '');

  const fetchList = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ticket-approvals/pending-closures');
      const rows = res.data?.data?.tickets || res.data?.tickets || [];
      setTickets(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pending closures');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (!canAccess) {
    return (
      <div className="ma-page">
        <div className="ma-error" style={{ padding: 48, textAlign: 'center' }}>
          <h2>Access denied</h2>
          <p>Only managers and admins can view pending closure approvals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ma-page">
      <div className="ma-header">
        <div className="ma-header-left">
          <div className="ma-title-row">
            <Archive size={28} className="ma-title-icon" />
            <div>
              <h1 className="ma-title">Pending closure approvals</h1>
              <p className="ma-subtitle">
                Tickets waiting for you to approve or reject closure ({tickets.length}).
              </p>
            </div>
          </div>
        </div>
        <RefreshButton onClick={() => fetchList()} loading={loading} label="Refresh" />
      </div>

      {error && (
        <div className="ma-banner ma-banner-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="ma-loading">
          <Loader className="spinning" size={32} />
          <span>Loading…</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="ma-empty">
          <Archive size={48} />
          <p>No tickets are waiting for closure approval.</p>
        </div>
      ) : (
        <div className="ma-table-wrap">
          <table className="ma-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Subject</th>
                <th>Requested by</th>
                <th>Priority</th>
                <th>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.ticket_id}>
                  <td>
                    <strong>#{t.ticket_number}</strong>
                  </td>
                  <td className="ma-cell-subject">{t.subject}</td>
                  <td>{t.requester_name || '—'}</td>
                  <td>
                    <span className="ma-priority-pill" style={{ borderColor: t.priority_color || '#94a3b8' }}>
                      {t.priority_name || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="ma-time">
                      <Clock size={14} /> {formatDate(t.closure_requested_at)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ma-link-btn"
                      onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                    >
                      Open <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingClosures;
