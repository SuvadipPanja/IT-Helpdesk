// ============================================
// 404 NOT FOUND PAGE - MODERN DESIGN
// Consistent dark glass theme with Login pages
// File: frontend/src/pages/NotFound.jsx
// ============================================

import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import '../styles/NotFound.css';

const NotFound = () => {
  return (
    <div className="nf-page">
      <div className="nf-content">
        {/* Animated icon */}
        <div className="nf-icon-wrap">
          <div className="nf-icon-circle">
            <Search size={48} />
          </div>
        </div>

        {/* 404 code */}
        <div className="nf-code">
          <span className="nf-digit nf-d1">4</span>
          <span className="nf-digit nf-d2">0</span>
          <span className="nf-digit nf-d3">4</span>
        </div>

        {/* Message */}
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-desc">
          The page you're looking for doesn't exist or has been moved.
          <br />
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="nf-actions">
          <Link to="/" className="nf-btn nf-btn-primary">
            <Home size={18} />
            Go to Dashboard
          </Link>
          <button onClick={() => window.history.back()} className="nf-btn nf-btn-ghost">
            <ArrowLeft size={18} />
            Go Back
          </button>
        </div>
      </div>

      {/* Background decorations */}
      <div className="nf-bg-circle nf-bg-1" />
      <div className="nf-bg-circle nf-bg-2" />
      <div className="nf-bg-circle nf-bg-3" />
    </div>
  );
};

export default NotFound;