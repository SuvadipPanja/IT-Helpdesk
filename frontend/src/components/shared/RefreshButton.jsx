import { RefreshCw } from 'lucide-react';
import './RefreshButton.css';

/**
 * Unified refresh button — used across all pages for consistency.
 *
 * @param {object}  props
 * @param {function} props.onClick   - Callback when clicked
 * @param {boolean}  [props.loading] - Whether a refresh is in progress
 * @param {string}   [props.label]   - Optional visible text label
 * @param {string}   [props.title]   - Tooltip text  (default: "Refresh")
 * @param {number}   [props.size]    - Icon size     (default: 16)
 * @param {'default'|'compact'|'ghost'} [props.variant] - Visual variant
 * @param {string}   [props.className] - Extra className
 */
const RefreshButton = ({
  onClick,
  loading = false,
  label,
  title = 'Refresh',
  size = 16,
  variant = 'default',
  className = '',
}) => (
  <button
    type="button"
    className={`nx-refresh-btn nx-refresh-btn--${variant} ${loading ? 'nx-refresh-btn--loading' : ''} ${className}`}
    onClick={onClick}
    disabled={loading}
    title={title}
    aria-label={title}
  >
    <RefreshCw size={size} className="nx-refresh-icon" />
    {label && <span className="nx-refresh-label">{label}</span>}
  </button>
);

export default RefreshButton;
