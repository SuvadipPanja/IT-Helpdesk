import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Shield,
  ExternalLink,
  Clock,
  User,
  AlertTriangle,
  Loader,
} from 'lucide-react';
import crService from '../../services/crService';
import '../../styles/CRCalendar.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RISK_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#991b1b',
};

const STATUS_FALLBACK_COLOR = '#6366f1';

const formatDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const CRCalendar = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [allBlackouts, setAllBlackouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBlackoutPanel, setShowBlackoutPanel] = useState(false);
  const [addingBlackout, setAddingBlackout] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState({ title: '', description: '', start_date: '', end_date: '' });

  const canManageBlackouts = user?.permissions?.can_manage_cr_settings;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(year, month, 1);
      // Extend range to cover visible cells (prev/next month days)
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59);

      const res = await crService.getCalendar({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (res.data?.success) {
        setEvents(res.data.data.events || []);
        setBlackouts(res.data.data.blackouts || []);
      }
    } catch {
      // silent — calendar is non-critical
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchAllBlackouts = useCallback(async () => {
    try {
      const res = await crService.getBlackouts();
      if (res.data?.success) {
        setAllBlackouts(res.data.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  useEffect(() => {
    if (showBlackoutPanel) fetchAllBlackouts();
  }, [showBlackoutPanel, fetchAllBlackouts]);

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Build calendar grid cells
  const buildCalendarCells = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const cells = [];

    // Previous month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthLast - i), otherMonth: true });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ date: new Date(year, month, d), otherMonth: false });
    }

    // Next month padding
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ date: new Date(year, month + 1, d), otherMonth: true });
      }
    }

    return cells;
  };

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isToday = (d) => isSameDay(d, new Date());

  const isInBlackout = (date) => {
    const d = date.getTime();
    return blackouts.some(b => {
      const s = new Date(b.start_date).getTime();
      const e = new Date(b.end_date).getTime();
      return d >= s && d <= e;
    });
  };

  const getEventsForDay = (date) => {
    return events.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      return evStart <= dayEnd && evEnd >= dayStart;
    });
  };

  const getBlackoutsForDay = (date) => {
    return blackouts.filter(b => {
      const s = new Date(b.start_date);
      const e = new Date(b.end_date);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      return s <= dayEnd && e >= dayStart;
    });
  };

  const handleAddBlackout = async () => {
    if (!blackoutForm.title || !blackoutForm.start_date || !blackoutForm.end_date) {
      toastError('Title, start date, and end date are required');
      return;
    }
    try {
      setAddingBlackout(true);
      await crService.createBlackout(blackoutForm);
      toastSuccess('Blackout period created');
      setBlackoutForm({ title: '', description: '', start_date: '', end_date: '' });
      fetchAllBlackouts();
      fetchCalendarData();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create blackout');
    } finally {
      setAddingBlackout(false);
    }
  };

  const handleDeleteBlackout = async (id) => {
    try {
      await crService.deleteBlackout(id);
      toastSuccess('Blackout period removed');
      fetchAllBlackouts();
      fetchCalendarData();
    } catch {
      toastError('Failed to delete blackout');
    }
  };

  const cells = buildCalendarCells();
  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const MAX_EVENTS_PER_CELL = 3;

  return (
    <div className="cr-calendar-page">
      {/* Header */}
      <div className="cr-calendar-header">
        <div className="cr-calendar-header-left">
          <Calendar size={24} className="cr-calendar-icon" />
          <h1>Change Calendar</h1>
        </div>
        <div className="cr-calendar-header-right">
          {canManageBlackouts && (
            <button
              className={`cr-cal-btn ${showBlackoutPanel ? 'cr-cal-btn-primary' : 'cr-cal-btn-outline'}`}
              onClick={() => setShowBlackoutPanel(!showBlackoutPanel)}
            >
              <Shield size={14} />
              Blackout Periods
            </button>
          )}
        </div>
      </div>

      {/* Month Navigation */}
      <div className="cr-cal-nav">
        <button className="cr-cal-nav-btn" onClick={goToPrevMonth}><ChevronLeft size={16} /></button>
        <span className="cr-cal-month-label">{monthLabel}</span>
        <button className="cr-cal-nav-btn" onClick={goToNextMonth}><ChevronRight size={16} /></button>
        <button className="cr-cal-today-btn" onClick={goToToday}>Today</button>
      </div>

      {/* Legend */}
      <div className="cr-cal-legend">
        <div className="cr-cal-legend-item">
          <span className="cr-cal-legend-dot" style={{ background: '#6366f1' }} />
          Scheduled
        </div>
        <div className="cr-cal-legend-item">
          <span className="cr-cal-legend-dot proposed" style={{ background: '#6366f1' }} />
          Proposed
        </div>
        <div className="cr-cal-legend-item">
          <span className="cr-cal-legend-dot" style={{ background: '#ef4444' }} />
          Blackout
        </div>
        {Object.entries(RISK_COLORS).map(([level, color]) => (
          <div key={level} className="cr-cal-legend-item">
            <span className="cr-cal-legend-dot" style={{ background: color }} />
            {level}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader size={32} className="spinner" style={{ color: '#6366f1' }} />
        </div>
      ) : (
        <div className="cr-cal-grid">
          {/* Day headers */}
          {DAY_NAMES.map(d => (
            <div key={d} className="cr-cal-day-header">{d}</div>
          ))}

          {/* Day cells */}
          {cells.map((cell, idx) => {
            const dayEvents = getEventsForDay(cell.date);
            const dayBlackouts = getBlackoutsForDay(cell.date);
            const inBlackout = isInBlackout(cell.date);

            const classNames = [
              'cr-cal-cell',
              cell.otherMonth && 'other-month',
              isToday(cell.date) && 'today',
              inBlackout && 'blackout',
            ].filter(Boolean).join(' ');

            return (
              <div key={idx} className={classNames}>
                <div className="cr-cal-day-num">{cell.date.getDate()}</div>

                {/* Blackout bars */}
                {dayBlackouts.map(b => (
                  <div key={`b-${b.blackout_id}`} className="cr-cal-blackout-bar" title={b.title}>
                    🚫 {b.title}
                  </div>
                ))}

                {/* Event chips */}
                {dayEvents.slice(0, MAX_EVENTS_PER_CELL).map(ev => (
                  <div
                    key={ev.id}
                    className={`cr-cal-event ${!ev.is_scheduled ? 'proposed' : ''}`}
                    style={{ background: RISK_COLORS[ev.risk_level] || ev.color || STATUS_FALLBACK_COLOR }}
                    title={`${ev.cr_number}: ${ev.title}`}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    {ev.cr_number}
                  </div>
                ))}

                {dayEvents.length > MAX_EVENTS_PER_CELL && (
                  <div className="cr-cal-more">+{dayEvents.length - MAX_EVENTS_PER_CELL} more</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Blackout Management Panel */}
      {showBlackoutPanel && canManageBlackouts && (
        <div className="cr-cal-blackout-panel">
          <div className="cr-cal-blackout-panel-header">
            <h3><Shield size={16} /> Blackout Periods</h3>
          </div>

          {allBlackouts.length === 0 ? (
            <div className="cr-cal-blackout-empty">No blackout periods defined</div>
          ) : (
            <ul className="cr-cal-blackout-list">
              {allBlackouts.map(b => (
                <li key={b.blackout_id} className="cr-cal-blackout-item">
                  <div className="cr-cal-blackout-info">
                    <h4>{b.title}</h4>
                    <p>
                      {formatDate(b.start_date)} — {formatDate(b.end_date)}
                      {b.description && ` · ${b.description}`}
                      {b.created_by_name && ` · Created by ${b.created_by_name}`}
                    </p>
                  </div>
                  {b.is_active && (
                    <button
                      className="cr-cal-btn cr-cal-btn-danger"
                      onClick={() => handleDeleteBlackout(b.blackout_id)}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add Blackout Form */}
          <div className="cr-cal-blackout-form">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Year-end freeze"
                value={blackoutForm.title}
                onChange={e => setBlackoutForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                placeholder="Optional"
                value={blackoutForm.description}
                onChange={e => setBlackoutForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                value={blackoutForm.start_date}
                onChange={e => setBlackoutForm(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="datetime-local"
                value={blackoutForm.end_date}
                onChange={e => setBlackoutForm(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <button
              className="cr-cal-btn cr-cal-btn-primary"
              onClick={handleAddBlackout}
              disabled={addingBlackout}
            >
              {addingBlackout ? <Loader size={14} className="spinner" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Event Detail Popup */}
      {selectedEvent && (
        <div className="cr-cal-event-popup" onClick={() => setSelectedEvent(null)}>
          <div className="cr-cal-event-card" onClick={e => e.stopPropagation()}>
            <div className="cr-cal-event-card-header">
              <h3>{selectedEvent.cr_number}</h3>
              <button className="cr-cal-nav-btn" onClick={() => setSelectedEvent(null)}><X size={14} /></button>
            </div>
            <div className="cr-cal-event-card-body">
              <div className="cr-cal-event-detail">
                <span className="cr-cal-event-detail-label">Title</span>
                {selectedEvent.title}
              </div>
              <div className="cr-cal-event-detail">
                <span className="cr-cal-event-detail-label">Status</span>
                <span style={{ color: selectedEvent.color || STATUS_FALLBACK_COLOR, fontWeight: 600 }}>
                  {selectedEvent.status_name}
                </span>
              </div>
              <div className="cr-cal-event-detail">
                <span className="cr-cal-event-detail-label">Type</span>
                {selectedEvent.type_name}
              </div>
              <div className="cr-cal-event-detail">
                <span className="cr-cal-event-detail-label">Risk</span>
                <span style={{ color: RISK_COLORS[selectedEvent.risk_level], fontWeight: 600 }}>
                  {selectedEvent.risk_level}
                </span>
              </div>
              <div className="cr-cal-event-detail">
                <span className="cr-cal-event-detail-label"><Clock size={14} /></span>
                {formatDateTime(selectedEvent.start)} — {formatDateTime(selectedEvent.end)}
                {!selectedEvent.is_scheduled && <em style={{ color: '#f59e0b', marginLeft: 6, fontSize: '0.75rem' }}>(proposed)</em>}
              </div>
              {selectedEvent.requester_name && (
                <div className="cr-cal-event-detail">
                  <span className="cr-cal-event-detail-label"><User size={14} /></span>
                  {selectedEvent.requester_name}
                </div>
              )}
              {selectedEvent.assigned_name && (
                <div className="cr-cal-event-detail">
                  <span className="cr-cal-event-detail-label">Assigned</span>
                  {selectedEvent.assigned_name}
                </div>
              )}
            </div>
            <div className="cr-cal-event-card-footer">
              <button
                className="cr-cal-btn cr-cal-btn-primary"
                onClick={() => { setSelectedEvent(null); navigate(`/cr/${selectedEvent.id}`); }}
              >
                <ExternalLink size={14} /> View Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRCalendar;
