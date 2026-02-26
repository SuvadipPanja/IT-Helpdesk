// ============================================
// AI HELP ASSISTANT — Smart IT Support Chatbot
// Powered by backend NLP engine with TF-IDF scoring,
// synonym expansion, fuzzy matching & context tracking
// ============================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Bot, User, Sparkles,
  ArrowRight, Minimize2, Maximize2, RotateCcw, Zap
} from 'lucide-react';
import api from '../../services/api';

/* ────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────── */
const AIAssistant = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* ── auto‑scroll ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  /* ── Greeting ── */
  const openChat = useCallback(() => {
    setIsOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{
        id: Date.now(),
        role: 'bot',
        text: `Hi there! 👋 I'm **Nexus AI Assistant** — your smart IT support helper.\n\nI use natural language processing to understand your questions and provide step-by-step solutions for IT issues.\n\n**What can I help you with today?**`,
        followUp: ['Reset my password', 'My computer is slow', 'Create a ticket', 'Network issues'],
        confidence: 1,
        time: new Date()
      }]);
    }
  }, [hasGreeted]);

  /* ── Call backend AI engine ── */
  const queryAI = useCallback(async (message) => {
    try {
      const response = await api.post('/ai/chat', { message, sessionId });
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error('Invalid response');
    } catch (err) {
      console.error('AI Engine error:', err);
      // Graceful fallback
      return {
        answer: `I'm having trouble processing your request right now. In the meantime:\n\n1. **Browse the Help Center** articles below\n2. **Create a support ticket** for personalized help\n3. Try rephrasing your question\n\nI apologize for the inconvenience!`,
        confidence: 0,
        category: 'error',
        followUp: ['Create a ticket', 'Password reset', 'Network issues'],
        entities: [],
        matchedTopic: null
      };
    }
  }, [sessionId]);

  /* ── Send message ── */
  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', text: msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Handle navigation shortcuts
    const lower = msg.toLowerCase();
    if (lower === 'create a ticket' || lower === 'raise a ticket') {
      await delay(600);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: `Sure! I'll take you to the **Create Ticket** page. You can describe your issue there and our support team will assist you.\n\nRedirecting now... 🚀`,
        confidence: 1,
        time: new Date()
      }]);
      await delay(1200);
      navigate('/tickets/new');
      setIsOpen(false);
      return;
    }

    if (lower === 'go to dashboard' || lower === 'dashboard') {
      await delay(500);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: 'Taking you to the dashboard... 🏠',
        confidence: 1,
        time: new Date()
      }]);
      await delay(800);
      navigate('/dashboard');
      setIsOpen(false);
      return;
    }

    if (lower === 'track my ticket' || lower === 'my tickets') {
      await delay(500);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: 'Taking you to your tickets... 📋',
        confidence: 1,
        time: new Date()
      }]);
      await delay(800);
      navigate('/my-tickets');
      setIsOpen(false);
      return;
    }

    if (lower === 'back to help center' || lower === 'help center') {
      await delay(500);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: 'Taking you to the Help Center... 📚',
        confidence: 1,
        time: new Date()
      }]);
      await delay(800);
      navigate('/help');
      setIsOpen(false);
      return;
    }

    // Call backend NLP engine
    const result = await queryAI(msg);

    // Simulate typing delay (proportional to answer length)
    const typingMs = Math.min(400 + result.answer.length * 2, 1800);
    await delay(typingMs);

    setIsTyping(false);
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      role: 'bot',
      text: result.answer,
      followUp: result.followUp,
      confidence: result.confidence,
      category: result.category,
      entities: result.entities,
      time: new Date()
    }]);
  }, [input, navigate, queryAI]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setHasGreeted(false);
    openChat();
  };

  /* ── Format markdown-lite ── */
  const formatText = (text) => {
    if (!text) return '';
    return text
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  /* ── Confidence indicator ── */
  const ConfidenceDot = ({ confidence }) => {
    if (confidence === undefined || confidence === null) return null;
    const pct = Math.round(confidence * 100);
    const color = pct >= 70 ? 'var(--success-color, #10b981)' :
                  pct >= 40 ? 'var(--warning-color, #f59e0b)' :
                              'var(--text-muted, #94a3b8)';
    return (
      <span className="ai-confidence" title={`AI Confidence: ${pct}%`}>
        <span className="ai-confidence-dot" style={{ background: color }} />
        <span className="ai-confidence-text">{pct}%</span>
      </span>
    );
  };

  /* ═══ RENDER ═══ */
  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="ai-fab" onClick={openChat} title="AI Help Assistant">
          <div className="ai-fab-icon">
            <Bot size={26} />
          </div>
          <span className="ai-fab-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`ai-chat ${isExpanded ? 'ai-chat--expanded' : ''}`}>
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-left">
              <div className="ai-avatar">
                <Sparkles size={18} />
              </div>
              <div>
                <h4>Nexus AI Assistant</h4>
                <span className="ai-status">
                  <span className="ai-status-dot" />
                  NLP Engine • Online
                </span>
              </div>
            </div>
            <div className="ai-chat-header-actions">
              <button onClick={resetChat} title="New conversation"><RotateCcw size={16} /></button>
              <button onClick={() => setIsExpanded(p => !p)} title={isExpanded ? 'Minimize' : 'Expand'}>
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)} title="Close"><X size={16} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-chat-body">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-msg ai-msg--${msg.role}`}>
                <div className="ai-msg-avatar">
                  {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="ai-msg-content">
                  <div className="ai-msg-bubble" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                  {msg.role === 'bot' && msg.confidence !== undefined && msg.confidence < 1 && (
                    <ConfidenceDot confidence={msg.confidence} />
                  )}
                  {msg.followUp && msg.followUp.length > 0 && (
                    <div className="ai-suggestions">
                      {msg.followUp.map((s, i) => (
                        <button key={i} className="ai-chip" onClick={() => handleSend(s)}>
                          <ArrowRight size={12} />{s}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="ai-msg-time">
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="ai-msg ai-msg--bot">
                <div className="ai-msg-avatar"><Bot size={16} /></div>
                <div className="ai-msg-content">
                  <div className="ai-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-footer">
            <div className="ai-input-wrap">
              <input
                ref={inputRef}
                type="text"
                placeholder="Describe your IT issue..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="ai-send"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="ai-disclaimer">
              <Zap size={10} /> Powered by NLP Engine — TF-IDF + Fuzzy Match + Context
            </p>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Utility ── */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default AIAssistant;
