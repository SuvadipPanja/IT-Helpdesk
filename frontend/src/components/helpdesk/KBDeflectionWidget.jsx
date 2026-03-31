// ============================================================
// KB DEFLECTION WIDGET
// Shows relevant KB articles when user is typing a ticket subject.
// Helps deflect tickets that can be self-served.
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, X, Lightbulb, ExternalLink } from 'lucide-react';
import { kbService } from '../../services/kbService';

const KBDeflectionWidget = ({ subject = '', onDismiss }) => {
  const navigate = useNavigate();
  const [results, setResults]   = useState([]);
  const [visible, setVisible]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef(null);
  const lastQuery = useRef('');
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const isOpen = visible || loading;

  // Measure content height when it changes
  useEffect(() => {
    if (contentRef.current && isOpen) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [isOpen, results, loading]);

  useEffect(() => {
    if (dismissed) return;
    const q = subject.trim();

    if (q.length < 5) {
      setVisible(false);
      return;
    }

    if (q === lastQuery.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      lastQuery.current = q;
      setLoading(true);
      try {
        const r = await kbService.search(q);
        const arts = (r.data?.data?.articles || []).slice(0, 3);
        setResults(arts);
        setVisible(arts.length > 0);
      } catch (_) {
        setVisible(false);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [subject, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onDismiss?.();
  };

  const openArticle = (article) => {
    const slug = article.slug || String(article.article_id || article.id);
    navigate(`/help?article=${slug}`);
  };

  if (!visible && !loading) return (
    <div style={{ height: 0, overflow: 'hidden', transition: 'height 0.25s ease', margin: 0 }} />
  );

  return (
    <div
      style={{
        height: contentHeight ? contentHeight + 'px' : 'auto',
        overflow: 'hidden',
        transition: 'height 0.25s ease',
      }}
    >
      <div ref={contentRef} className="kb-deflect">
      <div className="kb-deflect-header">
        <Lightbulb size={16} className="kb-deflect-bulb" />
        <span>Before you submit — these guides might help:</span>
        <button className="kb-deflect-close" onClick={handleDismiss} title="Dismiss suggestions">
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="kb-deflect-loading">Searching knowledge base…</div>
      ) : (
        <div className="kb-deflect-list">
          {results.map((art) => (
            <button
              key={art.article_id || art.id}
              className="kb-deflect-item"
              onClick={() => openArticle(art)}
            >
              <span className="kb-deflect-icon">{art.icon || '📄'}</span>
              <div className="kb-deflect-body">
                <strong>{art.title}</strong>
                {art.description && <span>{art.description}</span>}
              </div>
              <div className="kb-deflect-actions">
                <ExternalLink size={14} />
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="kb-deflect-footer">
        <button className="kb-deflect-none" onClick={handleDismiss}>
          <ChevronRight size={14} /> None of these helped, continue creating ticket
        </button>
        <button className="kb-deflect-browse" onClick={() => navigate('/help')}>
          <BookOpen size={14} /> Browse all guides
        </button>
      </div>
      </div>
    </div>
  );
};

export default KBDeflectionWidget;
