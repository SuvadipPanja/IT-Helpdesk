/**
 * ============================================
 * JOB MONITOR PANEL — PRODUCTION UI
 * Matches the project's Settings / UsersList design system
 * Developer: Suvadip Panja | Digitide
 * FILE: frontend/src/pages/settings/JobMonitorPanel.jsx
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import RefreshButton from '../../components/shared/RefreshButton';
import axios from 'axios';
import {
    Activity,
    Play,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Loader2,
    Pause,
    Calendar,
    Zap,
    Info,
    Server,
    CheckCircle,
    AlertCircle,
    Power,
} from 'lucide-react';
import '../../styles/JobMonitorPanel.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// ─── Helpers ────────────────────────────────────────────
const getAuthHeader = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
};

const formatDuration = (ms) => {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

// ─── Status Badge ────────────────────────────────────────
const StatusBadge = ({ job }) => {
    if (job.isRunning)
        return (
            <span className="jm-badge jm-badge--running">
                <Loader2 size={11} className="jm-spin" /> Running
            </span>
        );
    if (!job.isActive)
        return (
            <span className="jm-badge jm-badge--inactive">
                <Pause size={11} /> Inactive
            </span>
        );
    if (job.isEnabled === false)
        return (
            <span className="jm-badge jm-badge--disabled">
                <XCircle size={11} /> Disabled
            </span>
        );
    if (job.error)
        return (
            <span className="jm-badge jm-badge--error">
                <AlertTriangle size={11} /> Error
            </span>
        );
    return (
        <span className="jm-badge jm-badge--active">
            <CheckCircle2 size={11} /> Active
        </span>
    );
};

// ─── Exec Status Badge ────────────────────────────────────
const ExecBadge = ({ status }) => {
    if (!status) return <span className="jm-exec-none">No record</span>;
    const cls =
        status === 'success' ? 'jm-exec--success'
            : status === 'failed' ? 'jm-exec--failed'
                : status === 'running' ? 'jm-exec--running'
                    : 'jm-exec--partial';
    const Icon =
        status === 'success' ? CheckCircle2
            : status === 'failed' ? XCircle
                : status === 'running' ? Loader2
                    : AlertCircle;
    return (
        <span className={`jm-exec-badge ${cls}`}>
            <Icon size={10} /> {status}
        </span>
    );
};

// ─── Job Card ─────────────────────────────────────────────
const JobCard = ({ job, onRefresh }) => {
    const [triggering, setTriggering] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [actionMsg, setActionMsg] = useState(null);

    const handleTrigger = async () => {
        setTriggering(true);
        setActionMsg(null);
        try {
            const res = await axios.post(
                `${API_BASE}/jobs/${job.name}/run`,
                {},
                { headers: getAuthHeader() }
            );
            setActionMsg({ type: 'success', text: res.data.message || 'Job triggered — check status in a moment' });
            // Single refresh after 2s to pick up isRunning=true, then one more after 10s
            setTimeout(onRefresh, 2000);
            setTimeout(onRefresh, 10000);
            setTimeout(() => setActionMsg(null), 8000);
        } catch (err) {
            const text = err.response?.data?.message || 'Failed to trigger job';
            setActionMsg({ type: 'error', text });
            setTimeout(() => setActionMsg(null), 5000);
        } finally {
            setTriggering(false);
        }
    };

    const handleToggle = async () => {
        if (!job.canToggle) return;
        const action = job.isActive ? 'stop' : 'start';
        setToggling(true);
        setActionMsg(null);
        try {
            const res = await axios.patch(
                `${API_BASE}/jobs/${job.name}/toggle`,
                { action },
                { headers: getAuthHeader() }
            );
            setActionMsg({ type: 'success', text: res.data.message || `Job ${action}ed` });
            // Single refresh after 500ms — state is synchronous, should be instant
            setTimeout(onRefresh, 500);
            setTimeout(() => setActionMsg(null), 5000);
        } catch (err) {
            const text = err.response?.data?.message || `Failed to ${action} job`;
            setActionMsg({ type: 'error', text });
            setTimeout(() => setActionMsg(null), 5000);
        } finally {
            setToggling(false);
        }
    };

    const last = job.lastExecution;

    return (
        <div
            className={`jm-card${job.isRunning ? ' jm-card--running' : ''}${!job.isActive ? ' jm-card--inactive' : ''}`}
        >
            {/* Header */}
            <div className="jm-card-header">
                <div className="jm-card-title-row">
                    <span className="jm-job-emoji" role="img" aria-label={job.label}>
                        {job.icon}
                    </span>
                    <div>
                        <h3 className="jm-card-title">{job.label}</h3>
                        <p className="jm-card-desc">{job.description}</p>
                    </div>
                </div>
                <StatusBadge job={job} />
            </div>

            {/* Body */}
            <div className="jm-card-body">
                {/* Schedule */}
                <div className="jm-schedule-row">
                    <div className="jm-meta-item">
                        <Clock size={13} />
                        <span>{job.scheduleLabel || job.schedule || 'N/A'}</span>
                    </div>
                    {job.nextExecution && (
                        <div className="jm-meta-item">
                            <Calendar size={13} />
                            <span>Next: {job.nextExecution}</span>
                        </div>
                    )}
                </div>

                {/* Last Execution */}
                {last && (
                    <div className="jm-last-exec">
                        <div className="jm-last-exec-row">
                            <span className="jm-last-exec-label">Last run</span>
                            <ExecBadge status={last.status} />
                            <span className="jm-last-exec-time">
                                {formatDateTime(last.startedAt || last.started_at)}
                            </span>
                        </div>
                        {(last.durationMs != null || last.recordsProcessed != null) && (
                            <div className="jm-last-exec-detail">
                                {last.durationMs != null && (
                                    <span>
                                        <Zap size={11} /> {formatDuration(last.durationMs)}
                                    </span>
                                )}
                                {last.recordsProcessed != null && (
                                    <span>✅ {last.recordsProcessed} processed</span>
                                )}
                                {last.recordsFailed != null && last.recordsFailed > 0 && (
                                    <span className="jm-failed-count">
                                        ❌ {last.recordsFailed} failed
                                    </span>
                                )}
                            </div>
                        )}
                        {last.error && (
                            <div className="jm-last-exec-error">
                                <AlertTriangle size={11} /> {last.error}
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {job.error && (
                    <div className="jm-error-banner">
                        <AlertTriangle size={14} />
                        <span>{job.error}</span>
                    </div>
                )}

                {/* Action feedback */}
                {actionMsg && (
                    <div className={`jm-trigger-msg jm-trigger-msg--${actionMsg.type}`}>
                        {actionMsg.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {actionMsg.text}
                    </div>
                )}
            </div>

            {/* Footer — Run Now + Start/Stop */}
            <div className="jm-card-footer jm-card-footer--actions">
                {job.canToggle && (
                    <button
                        className={`jm-btn-toggle jm-btn-toggle--${job.isActive ? 'stop' : 'start'}`}
                        onClick={handleToggle}
                        disabled={toggling || job.isRunning}
                        title={job.isActive ? 'Stop scheduled runs' : 'Start scheduled runs'}
                    >
                        {toggling ? (
                            <Loader2 size={14} className="jm-spin" />
                        ) : job.isActive ? (
                            <>
                                <Pause size={14} /> Stop
                            </>
                        ) : (
                            <>
                                <Play size={14} /> Start
                            </>
                        )}
                    </button>
                )}
                <button
                    className="jm-btn-run"
                    onClick={handleTrigger}
                    disabled={triggering || job.isRunning}
                    title="Manually trigger this job right now"
                >
                    {triggering ? (
                        <>
                            <Loader2 size={14} className="jm-spin" /> Triggering…
                        </>
                    ) : (
                        <>
                            <Play size={14} /> Run Now
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────
const statConfig = [
    {
        key: 'total',
        label: 'Total Jobs',
        icon: Server,
        color: '#6366f1',
        bg: '#eef2ff',
    },
    {
        key: 'active',
        label: 'Active',
        icon: CheckCircle,
        color: '#10b981',
        bg: '#ecfdf5',
    },
    {
        key: 'running',
        label: 'Running Now',
        icon: Activity,
        color: '#3b82f6',
        bg: '#eff6ff',
    },
    {
        key: 'disabled',
        label: 'Disabled',
        icon: Power,
        color: '#f59e0b',
        bg: '#fffbeb',
    },
    {
        key: 'errors',
        label: 'Errors',
        icon: AlertCircle,
        color: '#ef4444',
        bg: '#fef2f2',
    },
];

// ─── Main Page ────────────────────────────────────────────
export default function JobMonitorPanel() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fetchedAt, setFetchedAt] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchJobs = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_BASE}/jobs`, {
                headers: getAuthHeader(),
            });
            setJobs(res.data.data || []);
            setFetchedAt(res.data.fetchedAt);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load job statuses');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchJobs(); }, [fetchJobs]);

    // Auto-refresh every 30s (lightweight background sync)
    useEffect(() => {
        const timer = setInterval(() => fetchJobs(true), 30000);
        return () => clearInterval(timer);
    }, [fetchJobs]);

    const stats = {
        total: jobs.length,
        active: jobs.filter((j) => j.isActive && j.isEnabled !== false && !j.error).length,
        running: jobs.filter((j) => j.isRunning).length,
        disabled: jobs.filter((j) => j.isEnabled === false).length,
        errors: jobs.filter((j) => !!j.error).length,
    };

    return (
        <div className="jm-page">
            {/* ── Hero Header ── */}
            <div className="jm-header">
                <div className="jm-header-left">
                    <div className="jm-header-icon">
                        <Activity size={22} />
                    </div>
                    <div>
                        <h1 className="jm-header-title">Job Monitor</h1>
                        <p className="jm-header-subtitle">
                            View, start, stop, and manually run background jobs
                        </p>
                    </div>
                </div>
                <div className="jm-header-right">
                    {fetchedAt && (
                        <span className="jm-header-updated">
                            <Info size={12} /> Updated {formatDateTime(fetchedAt)}
                        </span>
                    )}
                    <RefreshButton
                        onClick={() => fetchJobs(true)}
                        loading={refreshing}
                        label={refreshing ? 'Refreshing…' : 'Refresh'}
                    />
                </div>
            </div>

            {/* ── Content ── */}
            <div className="jm-content">
                {/* Stats */}
                <div className="jm-stats-row">
                    {statConfig.map((cfg) => {
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={cfg.key}
                                className="jm-stat-card"
                                style={{ '--stat-color': cfg.color, '--stat-bg': cfg.bg }}
                            >
                                <div className="jm-stat-icon">
                                    <Icon size={22} />
                                </div>
                                <div className="jm-stat-info">
                                    <span className="jm-stat-value">{stats[cfg.key]}</span>
                                    <span className="jm-stat-label">{cfg.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="jm-loading">
                        <Loader2 size={32} className="jm-spin" />
                        <p>Loading job statuses…</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="jm-error-state">
                        <XCircle size={40} />
                        <p>{error}</p>
                        <button className="jm-btn-refresh" style={{ background: '#6366f1', color: '#fff', border: 'none' }} onClick={() => fetchJobs()}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Job Grid */}
                {!loading && !error && (
                    <div className="jm-grid">
                        {jobs.map((job) => (
                            <JobCard
                                key={job.name}
                                job={job}
                                onRefresh={() => fetchJobs(true)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
