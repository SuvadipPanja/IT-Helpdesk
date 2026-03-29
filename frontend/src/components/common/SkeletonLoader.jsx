/**
 * Skeleton Loader - Production performance optimization
 * Shows shimmer placeholders while data loads for better perceived performance
 */
import React from 'react';
import '../../styles/SkeletonLoader.css';

export const SkeletonLine = ({ width = '100%', height = '14px', className = '' }) => (
  <div className={`skeleton-line ${className}`} style={{ width, height }} />
);

export const SkeletonAvatar = ({ size = 40 }) => (
  <div className="skeleton-avatar" style={{ width: size, height: size, borderRadius: '50%' }} />
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="skeleton-card">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLine key={i} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} />
    ))}
  </div>
);

/**
 * Table row skeleton for list pages
 */
export const SkeletonTableRow = ({ columns = 6 }) => (
  <tr className="skeleton-row">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i}>
        <SkeletonLine height="12px" width={i === 0 ? '80%' : '60%'} />
      </td>
    ))}
  </tr>
);

/**
 * Full table skeleton for Tickets/Users list
 */
const SkeletonTable = ({ rows = 10, columns = 6 }) => (
  <div className="skeleton-table-wrapper">
    <table className="skeleton-table">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}><SkeletonLine height="10px" width="70%" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <SkeletonTableRow key={rowIdx} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
);

export default SkeletonTable;
