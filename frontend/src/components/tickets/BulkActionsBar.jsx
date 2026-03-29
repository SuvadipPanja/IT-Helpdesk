// ============================================================
// BULK ACTIONS BAR
// Shown when IT staff selects one or more tickets.
// Allows: assign, close, change priority, change status.
// ============================================================

import { useState } from 'react';
import { X, UserCheck, XCircle, TrendingUp, RefreshCw, Loader } from 'lucide-react';
import api from '../../services/api';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '10px 16px',
    background: '#1e40af',
    borderRadius: '8px',
    marginBottom: '12px',
    boxShadow: '0 2px 8px rgba(30,64,175,0.25)',
  },
  count: {
    color: '#bfdbfe',
    fontSize: '13px',
    fontWeight: 600,
    marginRight: '4px',
    whiteSpace: 'nowrap',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
  selectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  select: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '12px',
    background: '#dbeafe',
    color: '#1e3a8a',
    cursor: 'pointer',
  },
  clearBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#93c5fd',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: '4px',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: '#3b82f6',
    margin: '0 4px',
  },
};

export default function BulkActionsBar({
  selectedIds,
  onClear,
  onSuccess,
  statuses = [],
  priorities = [],
  engineers = [],
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const count = selectedIds.length;

  const execute = async (payload) => {
    if (count === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/tickets/bulk', {
        ticket_ids: selectedIds,
        ...payload,
      });
      if (res.data.success) {
        onSuccess?.(res.data.message || 'Done');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.bar} role="toolbar" aria-label="Bulk ticket actions">
      <span style={styles.count}>{count} selected</span>

      <div style={styles.divider} />

      {/* Assign */}
      {engineers.length > 0 && (
        <div style={styles.selectWrap}>
          <UserCheck size={14} color="#93c5fd" />
          <select
            style={styles.select}
            defaultValue=""
            disabled={loading}
            onChange={(e) => {
              if (e.target.value) {
                execute({ action: 'assign', assignee_id: e.target.value });
                e.target.value = '';
              }
            }}
            aria-label="Bulk assign to engineer"
          >
            <option value="">Assign to...</option>
            {engineers.map((eng) => (
              <option key={eng.user_id} value={eng.user_id}>
                {eng.full_name || eng.username}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Change Status */}
      {statuses.length > 0 && (
        <div style={styles.selectWrap}>
          <RefreshCw size={14} color="#93c5fd" />
          <select
            style={styles.select}
            defaultValue=""
            disabled={loading}
            onChange={(e) => {
              if (e.target.value) {
                execute({ action: 'change_status', status_id: e.target.value });
                e.target.value = '';
              }
            }}
            aria-label="Bulk change status"
          >
            <option value="">Set status...</option>
            {statuses.map((s) => (
              <option key={s.status_id} value={s.status_id}>
                {s.status_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Change Priority */}
      {priorities.length > 0 && (
        <div style={styles.selectWrap}>
          <TrendingUp size={14} color="#93c5fd" />
          <select
            style={styles.select}
            defaultValue=""
            disabled={loading}
            onChange={(e) => {
              if (e.target.value) {
                execute({ action: 'change_priority', priority_id: e.target.value });
                e.target.value = '';
              }
            }}
            aria-label="Bulk change priority"
          >
            <option value="">Set priority...</option>
            {priorities.map((p) => (
              <option key={p.priority_id} value={p.priority_id}>
                {p.priority_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Close tickets */}
      <button
        type="button"
        style={{ ...styles.btn, background: '#dc2626', color: '#fff' }}
        onClick={() => execute({ action: 'close' })}
        disabled={loading}
        aria-label={`Close ${count} selected tickets`}
      >
        {loading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
        Close {count > 1 ? `${count} tickets` : 'ticket'}
      </button>

      {/* Error message */}
      {error && (
        <span style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 500 }}>{error}</span>
      )}

      {/* Clear selection */}
      <button
        type="button"
        style={styles.clearBtn}
        onClick={onClear}
        title="Clear selection"
        aria-label="Clear ticket selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
