// ============================================
// HELP CENTER — Production-Ready Interactive Page
// Smart search · Category browsing · FAQ · AI Assistant · Guides
// ============================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Book, MessageCircle, TrendingUp, Clock,
  ThumbsUp, ThumbsDown, ChevronRight, ChevronDown,
  Mail, Phone, ArrowRight, Sparkles, Zap, HelpCircle,
  FileText, Users, Settings, AlertCircle, CheckCircle2,
  X, Keyboard, Shield, Wifi, Printer, Monitor, Server,
  ChevronLeft, ExternalLink, Star, BookOpen, Headphones,
  ArrowLeft, Hash, Eye
} from 'lucide-react';
import helpContent from '../data/helpContent';
import AIAssistant from '../components/helpdesk/AIAssistant';
import '../styles/HelpCenter.css';

/* ── Icon Lookup ── */
const ICON_MAP = {
  'getting-started': Zap,
  tickets: FileText,
  sla: Clock,
  users: Users,
  admin: Settings,
  troubleshooting: AlertCircle,
  security: Shield,
  network: Wifi,
  hardware: Monitor,
  software: Server,
};

const HelpCenter = () => {
  const navigate = useNavigate();

  /* ── state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFAQs, setExpandedFAQs] = useState(new Set());
  const [faqFilter, setFaqFilter] = useState('all');
  const [feedback, setFeedback] = useState({});
  const [showContact, setShowContact] = useState(false);
  const searchRef = useRef(null);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSelectedArticle(null);
        setSelectedCategory(null);
        setShowContact(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── search ── */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    const scored = [];

    helpContent.articles.forEach(a => {
      let score = 0;
      words.forEach(w => {
        if (a.title.toLowerCase().includes(w)) score += 3;
        if (a.description.toLowerCase().includes(w)) score += 2;
        if (a.tags?.some(t => t.includes(w))) score += 2;
        if (a.content.toLowerCase().includes(w)) score += 1;
      });
      if (score > 0) scored.push({ ...a, type: 'article', score });
    });

    helpContent.faqs.forEach(f => {
      let score = 0;
      words.forEach(w => {
        if (f.question.toLowerCase().includes(w)) score += 3;
        if (f.answer.toLowerCase().includes(w)) score += 1;
      });
      if (score > 0) scored.push({ ...f, type: 'faq', score });
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [searchQuery]);

  /* ── highlight ── */
  const highlight = (text, query) => {
    if (!query || query.length < 2) return text;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  /* ── FAQ toggle ── */
  const toggleFaq = (id) => setExpandedFAQs(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  /* ── filtered FAQs ── */
  const filteredFaqs = useMemo(() => {
    if (faqFilter === 'all') return helpContent.faqs;
    return helpContent.faqs.filter(f => f.category === faqFilter);
  }, [faqFilter]);

  const faqCategories = useMemo(() => {
    const cats = [...new Set(helpContent.faqs.map(f => f.category))];
    return ['all', ...cats];
  }, []);

  /* ── article view ── */
  const openArticle = (article) => {
    setSelectedArticle(article);
    setSelectedCategory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── category articles ── */
  const categoryArticles = useMemo(() => {
    if (!selectedCategory) return [];
    return helpContent.articles.filter(a => a.category === selectedCategory);
  }, [selectedCategory]);

  /* ── trending articles ── */
  const trendingArticles = useMemo(() =>
    [...helpContent.articles].sort((a, b) => b.views - a.views).slice(0, 4)
  , []);

  /* ── article feedback ── */
  const handleFeedback = (articleId, isHelpful) => {
    setFeedback(prev => ({ ...prev, [articleId]: isHelpful }));
  };

  /* ── format article content ── */
  const formatContent = (text) => {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/✅/g, '<span class="hc-check">✅</span>')
      .replace(/❌/g, '<span class="hc-cross">❌</span>')
      .replace(/⚠️/g, '<span class="hc-warn">⚠️</span>');
  };

  /* ════════════════════════════════════════
     RENDER: ARTICLE DETAIL VIEW
     ════════════════════════════════════════ */
  if (selectedArticle) {
    const relatedArticles = (selectedArticle.relatedArticles || [])
      .map(id => helpContent.articles.find(a => a.id === id))
      .filter(Boolean);

    return (
      <div className="hc-page">
        {/* Breadcrumb */}
        <div className="hc-breadcrumb">
          <button onClick={() => setSelectedArticle(null)}>
            <ArrowLeft size={16} /> Help Center
          </button>
          <ChevronRight size={14} />
          <span>{helpContent.categories.find(c => c.id === selectedArticle.category)?.title}</span>
          <ChevronRight size={14} />
          <span className="hc-breadcrumb-current">{selectedArticle.title}</span>
        </div>

        <div className="hc-article-layout">
          {/* Article Body */}
          <article className="hc-article">
            <header className="hc-article-header">
              <span className="hc-article-icon">{selectedArticle.icon}</span>
              <h1>{selectedArticle.title}</h1>
              <p className="hc-article-desc">{selectedArticle.description}</p>
              <div className="hc-article-meta">
                <span className="hc-badge" data-level={selectedArticle.difficulty?.toLowerCase()}>
                  {selectedArticle.difficulty}
                </span>
                <span><Clock size={14} /> {selectedArticle.readTime}</span>
                <span><Eye size={14} /> {selectedArticle.views?.toLocaleString()} views</span>
                <span><ThumbsUp size={14} /> {selectedArticle.helpful}% helpful</span>
              </div>
            </header>

            <div className="hc-article-body" dangerouslySetInnerHTML={{ __html: formatContent(selectedArticle.content) }} />

            {/* Feedback */}
            <div className="hc-feedback">
              <h4>Was this article helpful?</h4>
              {feedback[selectedArticle.id] != null ? (
                <p className="hc-feedback-thanks">
                  <CheckCircle2 size={18} /> Thanks for your feedback!
                </p>
              ) : (
                <div className="hc-feedback-btns">
                  <button onClick={() => handleFeedback(selectedArticle.id, true)} className="hc-feedback-btn yes">
                    <ThumbsUp size={18} /> Yes, helpful
                  </button>
                  <button onClick={() => handleFeedback(selectedArticle.id, false)} className="hc-feedback-btn no">
                    <ThumbsDown size={18} /> Not helpful
                  </button>
                </div>
              )}
            </div>

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="hc-related">
                <h3>📚 Related Articles</h3>
                <div className="hc-related-grid">
                  {relatedArticles.map(a => (
                    <button key={a.id} className="hc-related-card" onClick={() => openArticle(a)}>
                      <span className="hc-related-icon">{a.icon}</span>
                      <div>
                        <h4>{a.title}</h4>
                        <p>{a.description}</p>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hc-article-sidebar">
            <div className="hc-sidebar-card">
              <h4><Headphones size={16} /> Need more help?</h4>
              <p>Can't find your answer? Our support team is ready to assist.</p>
              <button className="hc-btn hc-btn-primary" onClick={() => navigate('/tickets/new')}>
                <FileText size={16} /> Create Ticket
              </button>
              <button className="hc-btn hc-btn-ghost" onClick={() => setShowContact(true)}>
                <MessageCircle size={16} /> Contact Support
              </button>
            </div>

            <div className="hc-sidebar-card">
              <h4><TrendingUp size={16} /> Trending Articles</h4>
              {trendingArticles.map(a => (
                <button key={a.id} className="hc-sidebar-link" onClick={() => openArticle(a)}>
                  <span>{a.icon}</span> {a.title}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <AIAssistant />
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      </div>
    );
  }

  /* ════════════════════════════════════════
     RENDER: CATEGORY VIEW
     ════════════════════════════════════════ */
  if (selectedCategory) {
    const cat = helpContent.categories.find(c => c.id === selectedCategory);
    return (
      <div className="hc-page">
        <div className="hc-breadcrumb">
          <button onClick={() => setSelectedCategory(null)}>
            <ArrowLeft size={16} /> Help Center
          </button>
          <ChevronRight size={14} />
          <span className="hc-breadcrumb-current">{cat?.title}</span>
        </div>

        <div className="hc-category-header">
          <span className="hc-cat-icon-lg" style={{ background: `${cat?.color}1a`, color: cat?.color }}>
            {cat?.icon}
          </span>
          <div>
            <h1>{cat?.title}</h1>
            <p>{cat?.description} · {categoryArticles.length} articles</p>
          </div>
        </div>

        <div className="hc-articles-list">
          {categoryArticles.length === 0 ? (
            <div className="hc-empty">
              <BookOpen size={40} />
              <p>No articles in this category yet.</p>
            </div>
          ) : (
            categoryArticles.map(article => (
              <button key={article.id} className="hc-list-card" onClick={() => openArticle(article)}>
                <span className="hc-list-icon">{article.icon}</span>
                <div className="hc-list-body">
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                  <div className="hc-list-meta">
                    <span className="hc-badge" data-level={article.difficulty?.toLowerCase()}>{article.difficulty}</span>
                    <span><Clock size={12} /> {article.readTime}</span>
                    <span><Eye size={12} /> {article.views?.toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight size={18} />
              </button>
            ))
          )}
        </div>

        <AIAssistant />
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      </div>
    );
  }

  /* ════════════════════════════════════════
     RENDER: MAIN HELP CENTER
     ════════════════════════════════════════ */
  return (
    <div className="hc-page">

      {/* ── Hero ── */}
      <section className="hc-hero">
        <div className="hc-hero-inner">
          <div className="hc-hero-badge"><Sparkles size={14} /> Help Center</div>
          <h1>How can we help you?</h1>
          <p>Search our knowledge base, browse guides, or ask our AI assistant</p>

          {/* Search */}
          <div className={`hc-search-box ${searchFocused ? 'focused' : ''}`}>
            <Search size={20} className="hc-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search for help articles, FAQs, solutions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
            {searchQuery && (
              <button className="hc-search-clear" onClick={() => setSearchQuery('')}><X size={16} /></button>
            )}
            <kbd className="hc-kbd">Ctrl+K</kbd>
          </div>

          {/* Search Results Dropdown */}
          {searchFocused && searchResults.length > 0 && (
            <div className="hc-search-results">
              <div className="hc-sr-header">{searchResults.length} result{searchResults.length > 1 ? 's' : ''} found</div>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  className="hc-sr-item"
                  onMouseDown={() => {
                    if (r.type === 'article') openArticle(r);
                    else { toggleFaq(r.id); setSearchQuery(''); }
                  }}
                >
                  <span className="hc-sr-type">{r.type === 'article' ? '📄' : '❓'}</span>
                  <div className="hc-sr-body">
                    <h4 dangerouslySetInnerHTML={{ __html: highlight(r.title || r.question, searchQuery) }} />
                    <p dangerouslySetInnerHTML={{ __html: highlight(
                      (r.description || r.answer || '').substring(0, 120), searchQuery
                    ) }} />
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}

          {searchFocused && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="hc-search-results">
              <div className="hc-sr-empty">
                <Search size={24} />
                <p>No results found. Try different keywords or ask our AI assistant.</p>
              </div>
            </div>
          )}

          {/* Popular searches */}
          <div className="hc-popular">
            <span>Popular:</span>
            {helpContent.popularSearches.slice(0, 5).map((term, i) => (
              <button key={i} className="hc-popular-tag" onClick={() => setSearchQuery(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="hc-section">
        <div className="hc-quick-grid">
          <button className="hc-quick-card" onClick={() => navigate('/tickets/new')}>
            <div className="hc-quick-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <FileText size={28} />
            </div>
            <h3>Create Ticket</h3>
            <p>Submit a new support request</p>
            <ArrowRight size={18} className="hc-quick-arrow" />
          </button>
          <button className="hc-quick-card" onClick={() => navigate('/my-tickets')}>
            <div className="hc-quick-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
              <BookOpen size={28} />
            </div>
            <h3>My Tickets</h3>
            <p>Track your open requests</p>
            <ArrowRight size={18} className="hc-quick-arrow" />
          </button>
          <button className="hc-quick-card" onClick={() => navigate('/dashboard')}>
            <div className="hc-quick-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <TrendingUp size={28} />
            </div>
            <h3>Dashboard</h3>
            <p>View your overview</p>
            <ArrowRight size={18} className="hc-quick-arrow" />
          </button>
          <button className="hc-quick-card" onClick={() => setShowContact(true)}>
            <div className="hc-quick-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Headphones size={28} />
            </div>
            <h3>Contact Support</h3>
            <p>Talk to our team directly</p>
            <ArrowRight size={18} className="hc-quick-arrow" />
          </button>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="hc-section">
        <div className="hc-section-head">
          <h2><Book size={22} /> Browse by Category</h2>
          <p>Find help articles organized by topic</p>
        </div>
        <div className="hc-cat-grid">
          {helpContent.categories.map(cat => {
            const Icon = ICON_MAP[cat.id] || HelpCircle;
            return (
              <button key={cat.id} className="hc-cat-card" onClick={() => setSelectedCategory(cat.id)}>
                <div className="hc-cat-icon" style={{ background: `${cat.color}1a`, color: cat.color }}>
                  <Icon size={24} />
                </div>
                <div className="hc-cat-body">
                  <h3>{cat.title}</h3>
                  <p>{cat.description}</p>
                </div>
                <span className="hc-cat-count">{cat.articleCount} articles</span>
                <ChevronRight size={18} className="hc-cat-arrow" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Trending Articles ── */}
      <section className="hc-section">
        <div className="hc-section-head">
          <h2><Zap size={22} /> Trending Articles</h2>
          <p>Most-read guides this month</p>
        </div>
        <div className="hc-trending-grid">
          {trendingArticles.map((article, idx) => (
            <button key={article.id} className="hc-trend-card" onClick={() => openArticle(article)}>
              <span className="hc-trend-rank">#{idx + 1}</span>
              <div className="hc-trend-icon">{article.icon}</div>
              <div className="hc-trend-body">
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="hc-trend-meta">
                  <span className="hc-badge" data-level={article.difficulty?.toLowerCase()}>{article.difficulty}</span>
                  <span><Clock size={12} /> {article.readTime}</span>
                  <span><Eye size={12} /> {article.views?.toLocaleString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── All articles grid ── */}
      <section className="hc-section">
        <div className="hc-section-head">
          <h2><BookOpen size={22} /> All Guides & Articles</h2>
          <p>Complete knowledge base</p>
        </div>
        <div className="hc-all-grid">
          {helpContent.articles.map(article => (
            <button key={article.id} className="hc-article-card" onClick={() => openArticle(article)}>
              <div className="hc-ac-header">
                <span className="hc-ac-icon">{article.icon}</span>
                <span className="hc-badge" data-level={article.difficulty?.toLowerCase()}>{article.difficulty}</span>
              </div>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <div className="hc-ac-footer">
                <span><Clock size={12} /> {article.readTime}</span>
                <span><ThumbsUp size={12} /> {article.helpful}%</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="hc-section hc-faq-section">
        <div className="hc-section-head">
          <h2><HelpCircle size={22} /> Frequently Asked Questions</h2>
          <p>Quick answers to the most common questions</p>
        </div>

        {/* FAQ category filter */}
        <div className="hc-faq-filters">
          {faqCategories.map(cat => (
            <button
              key={cat}
              className={`hc-faq-pill ${faqFilter === cat ? 'active' : ''}`}
              onClick={() => setFaqFilter(cat)}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="hc-faq-list">
          {filteredFaqs.map(faq => (
            <div key={faq.id} className={`hc-faq-item ${expandedFAQs.has(faq.id) ? 'expanded' : ''}`}>
              <button className="hc-faq-q" onClick={() => toggleFaq(faq.id)}>
                <HelpCircle size={18} className="hc-faq-q-icon" />
                <span>{faq.question}</span>
                {expandedFAQs.has(faq.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedFAQs.has(faq.id) && (
                <div className="hc-faq-a">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hc-cta">
        <div className="hc-cta-inner">
          <MessageCircle size={48} className="hc-cta-icon" />
          <h2>Still can't find what you need?</h2>
          <p>Our support team and AI assistant are here 24/7 to help you resolve any IT issue.</p>
          <div className="hc-cta-btns">
            <button className="hc-btn hc-btn-primary hc-btn-lg" onClick={() => navigate('/tickets/new')}>
              <FileText size={18} /> Create a Ticket
            </button>
            <button className="hc-btn hc-btn-outline hc-btn-lg" onClick={() => setShowContact(true)}>
              <Phone size={18} /> Contact Support
            </button>
          </div>
        </div>
      </section>

      {/* ── AI Assistant + Contact Modal ── */}
      <AIAssistant />
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  );
};

/* ════════════════════════════════════════
   CONTACT MODAL
   ════════════════════════════════════════ */
const ContactModal = ({ onClose }) => (
  <div className="hc-modal-backdrop" onClick={onClose}>
    <div className="hc-modal" onClick={e => e.stopPropagation()}>
      <div className="hc-modal-header">
        <h3><Headphones size={20} /> Contact Support</h3>
        <button className="hc-modal-close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="hc-modal-body">
        <div className="hc-contact-grid">
          <div className="hc-contact-option">
            <div className="hc-contact-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <MessageCircle size={28} />
            </div>
            <h4>Live Chat</h4>
            <p>Instant help from our agents</p>
            <span className="hc-avail online">● Available now</span>
            <button className="hc-btn hc-btn-primary">Start Chat</button>
          </div>
          <div className="hc-contact-option">
            <div className="hc-contact-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Mail size={28} />
            </div>
            <h4>Email</h4>
            <p>support@company.com</p>
            <span className="hc-avail">Response within 24h</span>
            <button className="hc-btn hc-btn-ghost">Send Email</button>
          </div>
          <div className="hc-contact-option">
            <div className="hc-contact-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Phone size={28} />
            </div>
            <h4>Phone</h4>
            <p>+1 (555) 123-4567</p>
            <span className="hc-avail">Mon-Fri 9AM-6PM</span>
            <button className="hc-btn hc-btn-ghost">Call Now</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HelpCenter;
