// ============================================================
// HELP CENTER — DB-backed, API-connected
// Categories · Articles · FAQs · Search · Announcements
// ============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Book, MessageCircle, TrendingUp, Clock,
  ThumbsUp, ThumbsDown, ChevronRight, ChevronDown,
  Mail, Phone, ArrowRight, Sparkles, Zap, HelpCircle,
  FileText, Users, Settings, AlertCircle, CheckCircle2,
  X, Shield, Wifi, Monitor, Server,
  ArrowLeft, Eye, BookOpen, Headphones, Loader
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { kbService } from '../services/kbService';
import AnnouncementBanner from '../components/common/AnnouncementBanner';
import '../styles/HelpCenter.css';

/* ── Icon map for categories ── */
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

/* ── Normalize article fields (DB vs seed may differ) ── */
function normalizeArticle(a) {
  return {
    ...a,
    id: a.article_id || a.id,
    category: a.category_slug || a.category,
    readTime: a.read_time || a.readTime || '3 min read',
    helpful: a.helpful_yes && (a.helpful_yes + a.helpful_no) > 0
      ? Math.round(a.helpful_yes / (a.helpful_yes + a.helpful_no) * 100)
      : (a.helpful || 0),
  };
}

/* ── Normalize FAQ fields ── */
function normalizeFaq(f) {
  return {
    ...f,
    id: f.faq_id || f.id,
    category: f.category_slug || f.category_name || f.category || 'General',
  };
}

// ─────────────────────────────────────────────────────────────
const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchRef = useRef(null);

  /* ── state ── */
  const [categories,       setCategories]      = useState([]);
  const [articles,         setArticles]        = useState([]);
  const [faqs,             setFaqs]            = useState([]);
  const [popularSearches,  setPopularSearches] = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [searchQuery,      setSearchQuery]     = useState('');
  const [searchResults,    setSearchResults]   = useState({ articles: [], faqs: [] });
  const [searching,        setSearching]       = useState(false);
  const [searchFocused,    setSearchFocused]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle,  setSelectedArticle]  = useState(null);
  const [expandedFAQs,     setExpandedFAQs]    = useState(new Set());
  const [faqFilter,        setFaqFilter]       = useState('all');
  const [feedback,         setFeedback]        = useState({});
  const [showContact,      setShowContact]     = useState(false);

  /* ── Load all content ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, artRes, faqRes, popRes, searchRes] = await Promise.allSettled([
          kbService.getCategories(),
          kbService.getArticles({ status: 'published', limit: 50 }),
          kbService.getFaqs(),
          kbService.getPopular(),
          kbService.getPopularSearches(),
        ]);

        if (catRes.status === 'fulfilled')
          setCategories(catRes.value.data?.data || []);

        if (artRes.status === 'fulfilled') {
          const all = (artRes.value.data?.data || []).map(normalizeArticle);
          setArticles(all);
        }

        if (faqRes.status === 'fulfilled')
          setFaqs((faqRes.value.data?.data || []).map(normalizeFaq));

        if (popRes.status === 'fulfilled') {
          const pop = (popRes.value.data?.data || []).map(normalizeArticle);
          setArticles(prev => {
            const popIds = new Set(pop.map(a => a.article_id));
            const rest = prev.filter(a => !popIds.has(a.article_id));
            return [...pop, ...rest];
          });
        }

        if (searchRes.status === 'fulfilled')
          setPopularSearches(searchRes.value.data?.data || []);
      } catch (_) {
        /* leave empty */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── Open article from URL query param (?article=slug) ── */
  useEffect(() => {
    const articleSlug = searchParams.get('article');
    if (articleSlug && !loading) {
      openArticle(articleSlug);
    }
  }, [searchParams, loading]);

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

  /* ── Debounced search via API ── */
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ articles: [], faqs: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await kbService.search(searchQuery.trim());
        setSearchResults(r.data?.data || { articles: [], faqs: [] });
      } catch (_) {
        const q = searchQuery.toLowerCase();
        const arts = articles.filter(a =>
          a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
        ).slice(0, 8);
        const faqMatches = faqs.filter(f => f.question?.toLowerCase().includes(q)).slice(0, 4);
        setSearchResults({ articles: arts, faqs: faqMatches });
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, articles, faqs]);

  /* ── highlight ── */
  const highlight = (text, query) => {
    if (!query || query.length < 2 || !text) return text || '';
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
    if (faqFilter === 'all') return faqs;
    return faqs.filter(f => f.category === faqFilter);
  }, [faqFilter, faqs]);

  const faqCategories = useMemo(() => {
    const cats = [...new Set(faqs.map(f => f.category || 'General'))];
    return ['all', ...cats];
  }, [faqs]);

  /* ── article view ── */
  const openArticle = useCallback(async (articleOrObj) => {
    const slug = typeof articleOrObj === 'string'
      ? articleOrObj
      : (articleOrObj.slug || String(articleOrObj.article_id || articleOrObj.id));
    try {
      const r = await kbService.getArticleBySlug(slug);
      const art = r.data?.data;
      setSelectedArticle(normalizeArticle(art || articleOrObj));
    } catch (_) {
      setSelectedArticle(normalizeArticle(articleOrObj));
    }
    setSelectedCategory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ── category articles ── */
  const categoryArticles = useMemo(() => {
    if (!selectedCategory) return [];
    return articles.filter(a => a.category === selectedCategory || a.category_slug === selectedCategory);
  }, [selectedCategory, articles]);

  /* ── trending ── */
  const trendingArticles = useMemo(() =>
    [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4),
    [articles]
  );

  /* ── feedback ── */
  const handleFeedback = async (articleId, isHelpful) => {
    setFeedback(prev => ({ ...prev, [articleId]: isHelpful }));
    try { await kbService.submitFeedback(articleId, { is_helpful: isHelpful }); } catch (_) {}
  };

  /* ── markdown renderer ── */
  const formatContent = (text) => {
    if (!text) return '';
    return text
      .replace(/\|(.+)\|/g, m => `<tr>${m.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('')}</tr>`)
      .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim,  '<h2>$1</h2>')
      .replace(/^# (.*$)/gim,   '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,    '<em>$1</em>')
      .replace(/^- (.*$)/gim,   '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g,   '<br/>')
      .replace(/^/,     '<p>')
      .replace(/$/,     '</p>');
  };

  /* ═══════════════════════════════════════
     LOADING
  ═══════════════════════════════════════ */
  if (loading) {
    return (
      <div className="hc-page hc-loading">
        <Loader size={36} style={{ color: '#6366f1', animation: 'hc-spin 1s linear infinite' }} />
        <p>Loading Help Center…</p>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     ARTICLE DETAIL VIEW
  ═══════════════════════════════════════ */
  if (selectedArticle) {
    const art = selectedArticle;
    const artId = art.article_id || art.id;
    const catName = art.category_name || categories.find(c => c.slug === art.category)?.name || '';

    return (
      <div className="hc-page">
        <AnnouncementBanner />
        <div className="hc-breadcrumb">
          <button onClick={() => setSelectedArticle(null)}><ArrowLeft size={16} /> Help Center</button>
          <ChevronRight size={14} />
          {catName && (
            <>
              <button onClick={() => { setSelectedCategory(art.category || art.category_slug); setSelectedArticle(null); }}>
                {catName}
              </button>
              <ChevronRight size={14} />
            </>
          )}
          <span className="hc-breadcrumb-current">{art.title}</span>
        </div>

        <div className="hc-article-layout">
          <article className="hc-article">
            <header className="hc-article-header">
              <span className="hc-article-icon">{art.icon}</span>
              <h1>{art.title}</h1>
              <p className="hc-article-desc">{art.description}</p>
              <div className="hc-article-meta">
                <span className="hc-badge" data-level={(art.difficulty||'').toLowerCase()}>{art.difficulty}</span>
                <span><Clock size={14} /> {art.readTime}</span>
                <span><Eye size={14} /> {(art.views||0).toLocaleString()} views</span>
                {art.helpful > 0 && <span><ThumbsUp size={14} /> {art.helpful}% helpful</span>}
              </div>
            </header>

            <div className="hc-article-body"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContent(art.content)) }} />

            <div className="hc-feedback">
              <h4>Was this article helpful?</h4>
              {feedback[artId] != null ? (
                <p className="hc-feedback-thanks"><CheckCircle2 size={18} /> Thanks for your feedback!</p>
              ) : (
                <div className="hc-feedback-btns">
                  <button onClick={() => handleFeedback(artId, true)}  className="hc-feedback-btn yes"><ThumbsUp size={18} /> Yes, helpful</button>
                  <button onClick={() => handleFeedback(artId, false)} className="hc-feedback-btn no"><ThumbsDown size={18} /> Not helpful</button>
                </div>
              )}
            </div>

            {(art.related || []).length > 0 && (
              <div className="hc-related">
                <h3>📚 Related Articles</h3>
                <div className="hc-related-grid">
                  {art.related.map(r => (
                    <button key={r.article_id} className="hc-related-card" onClick={() => openArticle(r)}>
                      <span className="hc-related-icon">{r.icon}</span>
                      <div><h4>{r.title}</h4><p>{r.description}</p></div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>

          <aside className="hc-article-sidebar">
            <div className="hc-sidebar-card">
              <h4><Headphones size={16} /> Need more help?</h4>
              <p>Can't find your answer? Our support team is ready to assist.</p>
              <button className="hc-btn hc-btn-primary" onClick={() => navigate('/tickets/create')}><FileText size={16} /> Create Ticket</button>
              <button className="hc-btn hc-btn-ghost" onClick={() => setShowContact(true)}><MessageCircle size={16} /> Contact Support</button>
            </div>
            <div className="hc-sidebar-card">
              <h4><TrendingUp size={16} /> Trending Articles</h4>
              {trendingArticles.map(a => (
                <button key={a.article_id||a.id} className="hc-sidebar-link" onClick={() => openArticle(a)}>
                  <span>{a.icon}</span> {a.title}
                </button>
              ))}
            </div>
          </aside>
        </div>
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      </div>
    );
  }

  /* ═══════════════════════════════════════
     CATEGORY VIEW
  ═══════════════════════════════════════ */
  if (selectedCategory) {
    const cat = categories.find(c => c.slug === selectedCategory);
    return (
      <div className="hc-page">
        <AnnouncementBanner />
        <div className="hc-breadcrumb">
          <button onClick={() => setSelectedCategory(null)}><ArrowLeft size={16} /> Help Center</button>
          <ChevronRight size={14} />
          <span className="hc-breadcrumb-current">{cat?.name}</span>
        </div>
        <div className="hc-category-header">
          <span className="hc-cat-icon-lg" style={{ background: `${cat?.color}1a`, color: cat?.color }}>{cat?.icon}</span>
          <div>
            <h1>{cat?.name}</h1>
            <p>{cat?.description} · {categoryArticles.length} article{categoryArticles.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="hc-articles-list">
          {categoryArticles.length === 0 ? (
            <div className="hc-empty"><BookOpen size={40} /><p>No articles in this category yet.</p></div>
          ) : categoryArticles.map(article => (
            <button key={article.article_id||article.id} className="hc-list-card" onClick={() => openArticle(article)}>
              <span className="hc-list-icon">{article.icon}</span>
              <div className="hc-list-body">
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="hc-list-meta">
                  <span className="hc-badge" data-level={(article.difficulty||'').toLowerCase()}>{article.difficulty}</span>
                  <span><Clock size={12} /> {article.readTime}</span>
                  <span><Eye size={12} /> {(article.views||0).toLocaleString()}</span>
                </div>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      </div>
    );
  }

  /* ═══════════════════════════════════════
     MAIN HELP CENTER
  ═══════════════════════════════════════ */
  const allResults = [
    ...(searchResults.articles||[]).map(a => ({ ...normalizeArticle(a), type: 'article' })),
    ...(searchResults.faqs||[]).map(f    => ({ ...normalizeFaq(f),     type: 'faq'     })),
  ];

  return (
    <div className="hc-page">
      <AnnouncementBanner />

      {/* Hero */}
      <section className="hc-hero">
        <div className="hc-hero-inner">
          <div className="hc-hero-badge"><Sparkles size={14} /> Help Center</div>
          <h1>How can we help you?</h1>
          <p>Search our knowledge base, browse guides, or ask our AI assistant</p>

          <div className="hc-search-wrap">
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
              {searching
                ? <Loader size={16} style={{ color: '#9ca3af', animation: 'hc-spin 1s linear infinite', marginRight: '8px' }} />
                : searchQuery && (
                  <button className="hc-search-clear" onClick={() => setSearchQuery('')}><X size={16} /></button>
                )
              }
              <kbd className="hc-kbd">Ctrl+K</kbd>
            </div>

            {searchFocused && searchQuery.length >= 2 && allResults.length > 0 && (
              <div className="hc-search-results">
                <div className="hc-sr-header">{allResults.length} result{allResults.length !== 1 ? 's' : ''} found</div>
                {allResults.map((r, i) => (
                  <button key={i} className="hc-sr-item"
                    onMouseDown={() => {
                      if (r.type === 'article') openArticle(r);
                      else { toggleFaq(r.id); setSearchQuery(''); }
                    }}
                  >
                    <span className="hc-sr-type">{r.type === 'article' ? '📄' : '❓'}</span>
                    <div className="hc-sr-body">
                      <h4 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlight(r.title||r.question, searchQuery)) }} />
                      <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlight((r.description||r.answer||'').substring(0,120), searchQuery)) }} />
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            )}

            {searchFocused && searchQuery.length >= 2 && allResults.length === 0 && !searching && (
              <div className="hc-search-results">
                <div className="hc-sr-empty"><Search size={24} /><p>No results found. Try different keywords.</p></div>
              </div>
            )}
          </div>

          {popularSearches.length > 0 && (
            <div className="hc-popular">
              <span>Popular:</span>
              {popularSearches.slice(0, 6).map((term, i) => (
                <button key={i} className="hc-popular-tag" onClick={() => setSearchQuery(term)}>{term}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="hc-section">
        <div className="hc-quick-grid">
          {[
            { label: 'Create Ticket',   desc: 'Submit a new support request', Icon: FileText,   color: '#6366f1', onClick: () => navigate('/tickets/create') },
            { label: 'My Tickets',      desc: 'Track your open requests',      Icon: BookOpen,   color: '#8b5cf6', onClick: () => navigate('/my-tickets')      },
            { label: 'Dashboard',       desc: 'View your overview',            Icon: TrendingUp, color: '#10b981', onClick: () => navigate('/dashboard')       },
            { label: 'Contact Support', desc: 'Talk to our team directly',     Icon: Headphones, color: '#f59e0b', onClick: () => setShowContact(true)         },
          ].map(({ label, desc, Icon, color, onClick }) => (
            <button key={label} className="hc-quick-card" onClick={onClick}>
              <div className="hc-quick-icon" style={{ background: `${color}1a`, color }}><Icon size={28} /></div>
              <h3>{label}</h3><p>{desc}</p>
              <ArrowRight size={18} className="hc-quick-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="hc-section">
          <div className="hc-section-head">
            <h2><Book size={22} /> Browse by Category</h2>
            <p>Find help articles organized by topic</p>
          </div>
          <div className="hc-cat-grid">
            {categories.map(cat => {
              const Icon = ICON_MAP[cat.slug] || HelpCircle;
              return (
                <button key={cat.category_id} className="hc-cat-card" onClick={() => setSelectedCategory(cat.slug)}>
                  <div className="hc-cat-icon" style={{ background: `${cat.color}1a`, color: cat.color }}><Icon size={24} /></div>
                  <div className="hc-cat-body"><h3>{cat.name}</h3><p>{cat.description}</p></div>
                  <span className="hc-cat-count">{cat.article_count} articles</span>
                  <ChevronRight size={18} className="hc-cat-arrow" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Trending */}
      {trendingArticles.length > 0 && (
        <section className="hc-section">
          <div className="hc-section-head">
            <h2><Zap size={22} /> Trending Articles</h2>
            <p>Most-read guides this month</p>
          </div>
          <div className="hc-trending-grid">
            {trendingArticles.map((article, idx) => (
              <button key={article.article_id||article.id} className="hc-trend-card" onClick={() => openArticle(article)}>
                <span className="hc-trend-rank">#{idx + 1}</span>
                <div className="hc-trend-icon">{article.icon}</div>
                <div className="hc-trend-body">
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                  <div className="hc-trend-meta">
                    <span className="hc-badge" data-level={(article.difficulty||'').toLowerCase()}>{article.difficulty}</span>
                    <span><Clock size={12} /> {article.readTime}</span>
                    <span><Eye size={12} /> {(article.views||0).toLocaleString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* All Articles */}
      {articles.length > 0 && (
        <section className="hc-section">
          <div className="hc-section-head">
            <h2><BookOpen size={22} /> All Guides & Articles</h2>
            <p>Complete knowledge base — {articles.length} articles</p>
          </div>
          <div className="hc-all-grid">
            {articles.map(article => (
              <button key={article.article_id||article.id} className="hc-article-card" onClick={() => openArticle(article)}>
                <div className="hc-ac-header">
                  <span className="hc-ac-icon">{article.icon}</span>
                  <span className="hc-badge" data-level={(article.difficulty||'').toLowerCase()}>{article.difficulty}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="hc-ac-footer">
                  <span><Clock size={12} /> {article.readTime}</span>
                  {article.helpful > 0 && <span><ThumbsUp size={12} /> {article.helpful}%</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="hc-section hc-faq-section">
          <div className="hc-section-head">
            <h2><HelpCircle size={22} /> Frequently Asked Questions</h2>
            <p>Quick answers to the most common questions</p>
          </div>
          <div className="hc-faq-filters">
            {faqCategories.map(cat => (
              <button key={cat} className={`hc-faq-pill ${faqFilter === cat ? 'active' : ''}`} onClick={() => setFaqFilter(cat)}>
                {cat === 'all' ? 'All' : (cat.charAt(0).toUpperCase() + cat.slice(1))}
              </button>
            ))}
          </div>
          <div className="hc-faq-list">
            {filteredFaqs.map(faq => {
              const fid = faq.faq_id || faq.id;
              return (
                <div key={fid} className={`hc-faq-item ${expandedFAQs.has(fid) ? 'expanded' : ''}`}>
                  <button className="hc-faq-q" onClick={() => toggleFaq(fid)}>
                    <HelpCircle size={18} className="hc-faq-q-icon" />
                    <span>{faq.question}</span>
                    {expandedFAQs.has(fid) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  {expandedFAQs.has(fid) && <div className="hc-faq-a"><p>{faq.answer}</p></div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="hc-cta">
        <div className="hc-cta-inner">
          <MessageCircle size={48} className="hc-cta-icon" />
          <h2>Still can't find what you need?</h2>
          <p>Our support team and AI assistant are here to help you resolve any IT issue.</p>
          <div className="hc-cta-btns">
            <button className="hc-btn hc-btn-primary hc-btn-lg" onClick={() => navigate('/tickets/create')}><FileText size={18} /> Create a Ticket</button>
            <button className="hc-btn hc-btn-outline hc-btn-lg" onClick={() => setShowContact(true)}><Phone size={18} /> Contact Support</button>
          </div>
        </div>
      </section>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  );
};

/* ── Contact Modal ── */
const ContactModal = ({ onClose }) => (
  <div className="hc-modal-backdrop" onClick={onClose}>
    <div className="hc-modal" onClick={e => e.stopPropagation()}>
      <div className="hc-modal-header">
        <h3><Headphones size={20} /> Contact Support</h3>
        <button className="hc-modal-close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="hc-modal-body">
        <div className="hc-contact-grid">
          {[
            { Icon: MessageCircle, color: '#6366f1', title: 'Live Chat',    sub: 'Instant help from our agents',    avail: '● Available now', cls: 'online', btn: 'primary', label: 'Start Chat' },
            { Icon: Mail,          color: '#10b981', title: 'Email',        sub: 'support@company.com',             avail: 'Response within 24h',           btn: 'ghost',   label: 'Send Email' },
            { Icon: Phone,         color: '#f59e0b', title: 'Phone',        sub: '+1 (555) 123-4567',               avail: 'Mon–Fri 9AM–6PM',               btn: 'ghost',   label: 'Call Now'   },
          ].map(({ Icon, color, title, sub, avail, cls, btn, label }) => (
            <div key={title} className="hc-contact-option">
              <div className="hc-contact-icon" style={{ background: `${color}1a`, color }}><Icon size={28} /></div>
              <h4>{title}</h4><p>{sub}</p>
              <span className={`hc-avail ${cls||''}`}>{avail}</span>
              <button className={`hc-btn hc-btn-${btn}`}>{label}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default HelpCenter;
