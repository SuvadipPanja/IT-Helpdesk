// ============================================
// HELP CENTER PAGE
// Interactive help center with smart search, categories, and guides
// Developer: Suvadip Panja
// Date: January 31, 2026
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Book,
  Video,
  MessageCircle,
  TrendingUp,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
  Zap,
  HelpCircle,
  FileText,
  Users,
  Settings,
  AlertCircle,
  CheckCircle2,
  X,
  Keyboard,
  Command
} from 'lucide-react';
import helpContent from '../data/helpContent';
import '../styles/HelpCenter.css';

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      
      // Search in articles
      const articleResults = helpContent.articles.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.includes(query))
      );

      // Search in FAQs
      const faqResults = helpContent.faqs.filter(faq =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
      );

      setSearchResults([...articleResults, ...faqResults]);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // ============================================
  // HANDLE ARTICLE CLICK
  // ============================================
  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // HANDLE QUICK ACTION
  // ============================================
  const handleQuickAction = (action) => {
    switch (action) {
      case 'create-ticket':
        navigate('/tickets/new');
        break;
      case 'my-tickets':
        navigate('/my-tickets');
        break;
      case 'system-status':
        // Show system status (can implement later)
        break;
      case 'contact-support':
        setShowContactModal(true);
        break;
      default:
        break;
    }
  };

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('help-search')?.focus();
      }
      
      // Ctrl/Cmd + / for shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowContactModal(false);
        setSelectedArticle(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // ============================================
  // RENDER: ARTICLE VIEW
  // ============================================
  if (selectedArticle) {
    return (
      <div className="help-center">
        <div className="help-center-header">
          <div className="help-header-content">
            <button 
              className="back-button"
              onClick={() => setSelectedArticle(null)}
            >
              ← Back to Help Center
            </button>
            <h1 className="article-title">
              <span className="article-icon">{selectedArticle.icon}</span>
              {selectedArticle.title}
            </h1>
            <div className="article-meta">
              <span className="difficulty" data-difficulty={selectedArticle.difficulty}>
                {selectedArticle.difficulty}
              </span>
              <span className="read-time">
                <Clock size={14} />
                {selectedArticle.readTime}
              </span>
              <span className="views">
                <TrendingUp size={14} />
                {selectedArticle.views} views
              </span>
              <span className="helpful">
                <ThumbsUp size={14} />
                {selectedArticle.helpful}% found helpful
              </span>
            </div>
          </div>
        </div>

        <div className="article-content-wrapper">
          <div className="article-content">
            <div className="article-body" dangerouslySetInnerHTML={{ __html: selectedArticle.content.replace(/\n/g, '<br/>') }} />
            
            {selectedArticle.video && (
              <div className="video-section">
                <h3>📹 Video Tutorial</h3>
                <div className="video-placeholder">
                  <Video size={48} />
                  <p>Video tutorial available</p>
                  <button className="btn-primary">Watch Video</button>
                </div>
              </div>
            )}

            <div className="article-feedback">
              <h4>Was this article helpful?</h4>
              <div className="feedback-buttons">
                <button className="btn-feedback">
                  <ThumbsUp size={20} />
                  Yes
                </button>
                <button className="btn-feedback">
                  <ThumbsDown size={20} />
                  No
                </button>
              </div>
            </div>

            {selectedArticle.relatedArticles && selectedArticle.relatedArticles.length > 0 && (
              <div className="related-articles">
                <h3>Related Articles</h3>
                <div className="related-grid">
                  {selectedArticle.relatedArticles.slice(0, 3).map(relatedId => {
                    const related = helpContent.articles.find(a => a.id === relatedId);
                    return related ? (
                      <div key={related.id} className="related-card" onClick={() => handleArticleClick(related)}>
                        <span className="related-icon">{related.icon}</span>
                        <h4>{related.title}</h4>
                        <p>{related.description}</p>
                        <span className="read-more">Read more →</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="article-sidebar">
            <div className="sidebar-card">
              <h4>Need More Help?</h4>
              <button className="btn-secondary" onClick={() => setShowContactModal(true)}>
                <MessageCircle size={16} />
                Contact Support
              </button>
            </div>

            <div className="sidebar-card">
              <h4>Quick Actions</h4>
              {helpContent.quickLinks.slice(0, 3).map((link, index) => (
                <button
                  key={index}
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(link.action)}
                >
                  <span>{link.icon}</span>
                  {link.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: MAIN HELP CENTER
  // ============================================
  return (
    <div className="help-center">
      {/* HERO SECTION */}
      <div className="help-hero">
        <div className="help-hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            <span>Help Center</span>
          </div>
          <h1 className="hero-title">How can we help you today?</h1>
          <p className="hero-subtitle">
            Search for answers, browse categories, or contact support
          </p>

          {/* SEARCH BAR */}
          <div className="help-search-wrapper">
            <div className="help-search">
              <Search className="search-icon" size={20} />
              <input
                id="help-search"
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
              <div className="search-shortcut">
                <Keyboard size={14} />
                <span>Ctrl+K</span>
              </div>
            </div>

            {/* SEARCH RESULTS */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">
                  <span>{searchResults.length} results found</span>
                </div>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="search-result-item"
                    onClick={() => {
                      if (result.content) {
                        handleArticleClick(result);
                        setSearchQuery('');
                      }
                    }}
                  >
                    <div className="result-icon">
                      {result.content ? result.icon : '❓'}
                    </div>
                    <div className="result-content">
                      <h4>{result.title || result.question}</h4>
                      <p>{result.description || result.answer.substring(0, 100)}...</p>
                      <div className="result-meta">
                        {result.category && (
                          <span className="result-category">{result.category}</span>
                        )}
                        {result.readTime && (
                          <span className="result-time">{result.readTime}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* POPULAR SEARCHES */}
          <div className="popular-searches">
            <span className="popular-label">Popular:</span>
            {helpContent.popularSearches.slice(0, 4).map((term, index) => (
              <button
                key={index}
                className="popular-tag"
                onClick={() => setSearchQuery(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="quick-actions-section">
        <div className="quick-actions-grid">
          {helpContent.quickLinks.map((link, index) => (
            <div
              key={index}
              className="quick-action-card"
              style={{ borderTopColor: link.color }}
              onClick={() => handleQuickAction(link.action)}
            >
              <div className="quick-action-icon" style={{ background: `${link.color}15`, color: link.color }}>
                <span style={{ fontSize: '28px' }}>{link.icon}</span>
              </div>
              <h3>{link.title}</h3>
              <p>{link.description}</p>
              <span className="action-arrow" style={{ color: link.color }}>
                <ArrowRight size={20} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="help-section">
        <div className="section-header">
          <h2>Browse by Category</h2>
          <p>Find help articles organized by topic</p>
        </div>

        <div className="categories-grid">
          {helpContent.categories.map((category) => (
            <div
              key={category.id}
              className="category-card"
              onClick={() => setSelectedCategory(category.id)}
            >
              <div className="category-icon" style={{ background: `${category.color}15`, color: category.color }}>
                <span style={{ fontSize: '32px' }}>{category.icon}</span>
              </div>
              <div className="category-content">
                <h3>{category.title}</h3>
                <p>{category.description}</p>
                <span className="article-count">{category.articleCount} articles</span>
              </div>
              <ChevronRight className="category-arrow" size={20} />
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED ARTICLES */}
      <div className="help-section">
        <div className="section-header">
          <h2>
            <Zap size={24} />
            Featured Guides
          </h2>
          <p>Most popular help articles</p>
        </div>

        <div className="articles-grid">
          {helpContent.articles.slice(0, 6).map((article) => (
            <div
              key={article.id}
              className="article-card"
              onClick={() => handleArticleClick(article)}
            >
              <div className="article-card-header">
                <span className="article-card-icon">{article.icon}</span>
                <span className="difficulty-badge" data-difficulty={article.difficulty}>
                  {article.difficulty}
                </span>
              </div>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <div className="article-card-footer">
                <span className="read-time">
                  <Clock size={14} />
                  {article.readTime}
                </span>
                <span className="views">
                  <TrendingUp size={14} />
                  {article.views}
                </span>
                <span className="helpful">
                  <ThumbsUp size={14} />
                  {article.helpful}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ SECTION */}
      <div className="help-section faq-section">
        <div className="section-header">
          <h2>
            <HelpCircle size={24} />
            Frequently Asked Questions
          </h2>
          <p>Quick answers to common questions</p>
        </div>

        <div className="faq-container">
          {helpContent.faqs.slice(0, 8).map((faq) => (
            <div key={faq.id} className="faq-item">
              <div
                className="faq-question"
                onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
              >
                <h4>{faq.question}</h4>
                {expandedFAQ === faq.id ? (
                  <ChevronDown size={20} />
                ) : (
                  <ChevronRight size={20} />
                )}
              </div>
              {expandedFAQ === faq.id && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONTACT SUPPORT */}
      <div className="help-section contact-section">
        <div className="contact-card">
          <div className="contact-icon">
            <MessageCircle size={48} />
          </div>
          <h2>Still need help?</h2>
          <p>Our support team is here to assist you</p>
          <button className="btn-primary" onClick={() => setShowContactModal(true)}>
            <Mail size={20} />
            Contact Support
          </button>
        </div>
      </div>

      {/* KEYBOARD SHORTCUTS MODAL */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Keyboard size={24} />
                Keyboard Shortcuts
              </h3>
              <button className="modal-close" onClick={() => setShowShortcuts(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="shortcuts-list">
                {helpContent.shortcuts.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    <div className="shortcut-keys">
                      {shortcut.key.split('+').map((key, i) => (
                        <kbd key={i}>{key.trim()}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT SUPPORT MODAL */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content contact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <MessageCircle size={24} />
                Contact Support
              </h3>
              <button className="modal-close" onClick={() => setShowContactModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="contact-options">
                <div className="contact-option">
                  <div className="contact-option-icon" style={{ background: '#3b82f615', color: '#3b82f6' }}>
                    <MessageCircle size={32} />
                  </div>
                  <h4>Live Chat</h4>
                  <p>Get instant help from our team</p>
                  <span className="availability">Available now</span>
                  <button className="btn-primary">Start Chat</button>
                </div>

                <div className="contact-option">
                  <div className="contact-option-icon" style={{ background: '#10b98115', color: '#10b981' }}>
                    <Mail size={32} />
                  </div>
                  <h4>Email Support</h4>
                  <p>support@company.com</p>
                  <span className="availability">Response within 24h</span>
                  <button className="btn-secondary">Send Email</button>
                </div>

                <div className="contact-option">
                  <div className="contact-option-icon" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                    <Phone size={32} />
                  </div>
                  <h4>Phone Support</h4>
                  <p>+1 (555) 123-4567</p>
                  <span className="availability">Mon-Fri, 9AM-6PM EST</span>
                  <button className="btn-secondary">Call Now</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING HELP BUTTON */}
      <button
        className="floating-help-button"
        onClick={() => setShowShortcuts(true)}
        title="Keyboard Shortcuts (Ctrl + /)"
      >
        <Command size={24} />
      </button>
    </div>
  );
};

export default HelpCenter;