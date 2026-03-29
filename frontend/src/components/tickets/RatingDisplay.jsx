// ============================================
// RATING DISPLAY COMPONENT
// Read-only multi-criteria rating card
// Developer: Suvadip Panja
// Created: March 2026
// ============================================

import { Star, Award } from 'lucide-react';
import { RATING_LABELS } from './RatingModal';
import { formatDate } from '../../utils/dateUtils';
import '../../styles/TicketRating.css';

// ============================================
// Star Display (read-only)
// ============================================
const StarDisplay = ({ value, size = 18 }) => (
  <div className="td-rating-stars-lg">
    {[1, 2, 3, 4, 5].map(s => (
      <Star
        key={s}
        size={size}
        fill={s <= Math.round(value) ? '#f59e0b' : 'none'}
        color={s <= Math.round(value) ? '#f59e0b' : '#d1d5db'}
      />
    ))}
  </div>
);

// ============================================
// Main Rating Display Card
// ============================================
const RatingDisplay = ({ rating }) => {
  if (!rating) return null;

  const criteria = [
    { name: 'Resolution Quality', value: rating.resolution_quality },
    { name: 'Timeliness', value: rating.timeliness },
    { name: 'Satisfaction', value: rating.satisfaction },
    { name: 'Professionalism', value: rating.professionalism }
  ];

  const overallRating = parseFloat(rating.overall_rating);
  const ratedDate = rating.created_at
    ? formatDate(rating.created_at)
    : '';

  return (
    <div className="td-rating-card">
      <div className="td-rating-header">
        <Award size={18} />
        <h3>Service Rating</h3>
      </div>
      <div className="td-rating-content">
        {/* Overall */}
        <div className="td-rating-overall">
          <div className="td-rating-score-lg">{overallRating.toFixed(1)}</div>
          <div>
            <StarDisplay value={overallRating} size={20} />
            <div className="td-rating-meta">
              {RATING_LABELS[Math.round(overallRating)] || ''}
            </div>
          </div>
        </div>

        {/* Criteria breakdown */}
        <div className="td-rating-criteria-grid">
          {criteria.map(c => (
            <div key={c.name} className="td-rating-criteria-item">
              <span className="td-rating-criteria-name">{c.name}</span>
              <div className="td-rating-criteria-stars">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    size={14}
                    fill={s <= c.value ? '#f59e0b' : 'none'}
                    color={s <= c.value ? '#f59e0b' : '#d1d5db'}
                  />
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginLeft: '4px' }}>
                  {c.value}/5
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Feedback */}
        {rating.feedback_text && (
          <div className="td-rating-feedback">
            <div className="td-rating-feedback-label">Feedback</div>
            <p className="td-rating-feedback-text">"{rating.feedback_text}"</p>
          </div>
        )}

        {/* Footer */}
        <div className="td-rating-footer">
          {ratedDate && <span>Rated on {ratedDate}</span>}
          {rating.rated_by_name && <span>by {rating.rated_by_name}</span>}
        </div>
      </div>
    </div>
  );
};

export default RatingDisplay;
export { StarDisplay };
