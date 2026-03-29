// ============================================
// RATING MODAL COMPONENT
// Multi-criteria star rating with feedback
// Developer: Suvadip Panja
// Created: March 2026
// ============================================

import { useState, useCallback } from 'react';
import { Star, Send, X } from 'lucide-react';
import '../../styles/TicketRating.css';

// Star rating labels
const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
};

// Rating criteria configuration
const CRITERIA = [
  {
    key: 'resolution_quality',
    name: 'Resolution Quality',
    desc: 'Was the issue properly resolved as per your expectation?'
  },
  {
    key: 'timeliness',
    name: 'Timeliness',
    desc: 'Was the ticket resolved within a reasonable timeframe?'
  },
  {
    key: 'satisfaction',
    name: 'Satisfaction',
    desc: 'How satisfied are you with the solution provided?'
  },
  {
    key: 'professionalism',
    name: 'Professionalism',
    desc: 'How was the engineer\'s behavior and professionalism?'
  }
];

// ============================================
// Star Rating Input Component
// ============================================
const StarRatingInput = ({ value, onChange, size = 24 }) => {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="star-rating-input">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className={`star-rating-btn ${star <= value ? 'active' : ''} ${star <= hoverValue ? 'hovered' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          title={RATING_LABELS[star]}
        >
          <Star size={size} fill={star <= (hoverValue || value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
};

// ============================================
// Main Rating Modal Component
// ============================================
const RatingModal = ({ ticket, onSubmit, onClose, loading = false }) => {
  const [ratings, setRatings] = useState({
    resolution_quality: 0,
    timeliness: 0,
    satisfaction: 0,
    professionalism: 0
  });
  const [feedbackText, setFeedbackText] = useState('');

  const handleRatingChange = useCallback((key, value) => {
    setRatings(prev => ({ ...prev, [key]: value }));
  }, []);

  const allRated = Object.values(ratings).every(v => v > 0);

  const overallRating = allRated
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / 4).toFixed(1)
    : null;

  const handleSubmit = () => {
    if (!allRated) return;
    onSubmit({
      ...ratings,
      feedback_text: feedbackText.trim() || null
    });
  };

  const engineerName = ticket?.assigned_to_name || 'Engineer';
  const engineerInitial = engineerName[0]?.toUpperCase() || 'E';

  return (
    <div className="rating-modal-overlay" onClick={() => { if (!loading) onClose(); }}>
      <div className="rating-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rating-modal-header">
          <div className="rating-modal-icon">⭐</div>
          <h3>Rate Your Experience</h3>
          <p>
            How was the service on ticket <strong>#{ticket?.ticket_number}</strong>?
            <br />Your feedback helps us improve.
          </p>
          <div className="rating-modal-engineer">
            <div className="rating-modal-engineer-avatar">{engineerInitial}</div>
            <span>Handled by <strong>{engineerName}</strong></span>
          </div>
        </div>

        {/* Criteria */}
        <div className="rating-modal-body">
          <div className="rating-criteria-list">
            {CRITERIA.map(criterion => (
              <div key={criterion.key} className="rating-criteria-item">
                <div className="rating-criteria-label">
                  <div>
                    <div className="rating-criteria-name">{criterion.name}</div>
                    <div className="rating-criteria-desc">{criterion.desc}</div>
                  </div>
                  <div className="rating-criteria-value">
                    {ratings[criterion.key] > 0
                      ? RATING_LABELS[ratings[criterion.key]]
                      : ''}
                  </div>
                </div>
                <StarRatingInput
                  value={ratings[criterion.key]}
                  onChange={val => handleRatingChange(criterion.key, val)}
                />
              </div>
            ))}
          </div>

          {/* Feedback */}
          <div className="rating-feedback-section">
            <label className="rating-feedback-label">Additional Feedback (Optional)</label>
            <textarea
              className="rating-feedback-textarea"
              placeholder="Share your experience, suggestions, or any comments..."
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              maxLength={2000}
              disabled={loading}
            />
          </div>

          {/* Overall Preview */}
          {allRated && (
            <div className="rating-overall-preview">
              <div>
                <div className="rating-overall-score">{overallRating}</div>
                <div className="rating-overall-label">Overall</div>
              </div>
              <div className="rating-overall-stars">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    size={22}
                    fill={s <= Math.round(parseFloat(overallRating)) ? '#f59e0b' : 'none'}
                    color={s <= Math.round(parseFloat(overallRating)) ? '#f59e0b' : '#d1d5db'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="rating-modal-actions">
          <button
            className="rating-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            <X size={16} /> Cancel
          </button>
          <button
            className="rating-btn-submit"
            onClick={handleSubmit}
            disabled={!allRated || loading}
          >
            <Send size={16} />
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
export { StarRatingInput, RATING_LABELS };
