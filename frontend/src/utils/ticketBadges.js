const STATUS_BADGE_VARIANTS = Object.freeze({
  OPEN: 'nx-badge--status-open',
  IN_PROGRESS: 'nx-badge--status-progress',
  PENDING: 'nx-badge--status-pending',
  PENDING_INFO: 'nx-badge--status-pending',
  ON_HOLD: 'nx-badge--status-on-hold',
  RESOLVED: 'nx-badge--status-closed',
  CLOSED: 'nx-badge--status-closed',
  ESCALATED: 'nx-badge--status-escalated',
  CANCELLED: 'nx-badge--status-cancelled',
  REOPENED: 'nx-badge--status-reopened',
});

const PRIORITY_BADGE_VARIANTS = Object.freeze({
  CRITICAL: 'nx-badge--priority-critical',
  HIGH: 'nx-badge--priority-high',
  MEDIUM: 'nx-badge--priority-medium',
  LOW: 'nx-badge--priority-low',
  PLANNING: 'nx-badge--priority-planning',
});

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function getTicketStatusBadgeClassName(code) {
  const normalizedCode = normalizeCode(code);
  return `nx-badge ${STATUS_BADGE_VARIANTS[normalizedCode] || 'nx-badge--status-default'}`;
}

export function getTicketPriorityBadgeClassName(code) {
  const normalizedCode = normalizeCode(code);
  return `nx-badge ${PRIORITY_BADGE_VARIANTS[normalizedCode] || 'nx-badge--priority-default'}`;
}