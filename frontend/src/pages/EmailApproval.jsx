/**
 * Public landing page for ticket approval links from email.
 * Reads token + intended action from URL; user confirms; POST applies decision (no GET side effects).
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import '../styles/EmailApproval.css';

const publicClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export default function EmailApproval() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('t') || searchParams.get('token') || '').trim();
  const urlAction = (searchParams.get('a') || searchParams.get('action') || '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [action, setAction] = useState(urlAction === 'reject' ? 'reject' : 'approve');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const loadContext = useCallback(async () => {
    if (!token) {
      setError('This link is missing required parameters. Open the latest approval email from your inbox.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await publicClient.get('/public/email-approval/context', {
        params: { token },
      });
      if (data?.success && data?.data) {
        setContext(data.data);
      } else {
        setError(data?.message || 'Could not load this approval.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Could not load this approval.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (urlAction === 'reject') setAction('reject');
    else if (urlAction === 'approve') setAction('approve');
  }, [urlAction]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await publicClient.post('/public/email-approval/decision', {
        token,
        action: action === 'reject' ? 'reject' : 'approve',
        decision_note: note.trim() || undefined,
      });
      if (data?.success) {
        setDone(data.message || 'Your decision has been recorded.');
      } else {
        setError(data?.message || 'Request failed.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="email-approval-page">
        <div className="email-approval-card">
          <p className="email-approval-muted">Loading approval…</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="email-approval-page">
        <div className="email-approval-card email-approval-success">
          <h1>Thank you</h1>
          <p>{done}</p>
          <p className="email-approval-muted">You can close this window.</p>
        </div>
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="email-approval-page">
        <div className="email-approval-card email-approval-error">
          <h1>Link not valid</h1>
          <p>{error || 'Missing token.'}</p>
          <Link to="/login" className="email-approval-link">
            Sign in to the helpdesk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="email-approval-page">
      <div className="email-approval-card">
        <h1>Ticket approval</h1>
        {context && (
          <>
            <p className="email-approval-lead">
              Hello <strong>{context.approver_name}</strong>, confirm your decision for this approval request.
            </p>
            <div className="email-approval-meta">
              <div>
                <span className="email-approval-label">Ticket</span>
                <span className="email-approval-value">#{context.ticket_number}</span>
              </div>
              <div>
                <span className="email-approval-label">Subject</span>
                <span className="email-approval-value">{context.subject}</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={submit} className="email-approval-form">
          <fieldset className="email-approval-actions">
            <legend className="sr-only">Decision</legend>
            <label className={`email-approval-choice ${action === 'approve' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="decision"
                checked={action === 'approve'}
                onChange={() => setAction('approve')}
              />
              Approve
            </label>
            <label className={`email-approval-choice ${action === 'reject' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="decision"
                checked={action === 'reject'}
                onChange={() => setAction('reject')}
              />
              Reject
            </label>
          </fieldset>

          <label className="email-approval-note-label">
            Note (optional)
            <textarea
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              rows={3}
              placeholder="Add a short note for the engineer (optional)"
              className="email-approval-textarea"
            />
          </label>

          {error && <p className="email-approval-inline-error">{error}</p>}

          <button type="submit" className="email-approval-submit" disabled={submitting}>
            {submitting ? 'Submitting…' : action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
          </button>
        </form>
      </div>
    </div>
  );
}
