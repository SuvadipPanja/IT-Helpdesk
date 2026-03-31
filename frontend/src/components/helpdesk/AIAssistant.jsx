// ============================================
// AI HELP ASSISTANT — Smart IT Support Chatbot
// Powered by backend NLP engine with TF-IDF scoring,
// synonym expansion, fuzzy matching & context tracking
// ============================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Send, User,
  ArrowRight, Minimize2, Maximize2, RotateCcw, Zap, Mic, MicOff
} from 'lucide-react';
import DOMPurify from 'dompurify';
import api from '../../services/api';
import { formatTime } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import settingsLoader from '../../utils/settingsLoader';
import '../../styles/AIAssistant.css';

const BOT_NAME = 'IT Support Assistant';

/**
 * Repairs emoji/special chars stored as Windows-1252 mojibake.
 * e.g. 👋 (bytes F0 9F 91 8B) decoded via cp1252 gives ðŸ'‹ (U+00F0 U+0178 U+2018 U+2039).
 * We reverse the cp1252 mapping then re-interpret as UTF-8 via TextDecoder.
 */
const _CP1252 = {
  '\u20ac':0x80,'\u201a':0x82,'\u0192':0x83,'\u201e':0x84,'\u2026':0x85,
  '\u2020':0x86,'\u2021':0x87,'\u02c6':0x88,'\u2030':0x89,'\u0160':0x8a,
  '\u2039':0x8b,'\u0152':0x8c,'\u017d':0x8e,'\u2018':0x91,'\u2019':0x92,
  '\u201c':0x93,'\u201d':0x94,'\u2022':0x95,'\u2013':0x96,'\u2014':0x97,
  '\u02dc':0x98,'\u2122':0x99,'\u0161':0x9a,'\u203a':0x9b,'\u0153':0x9c,
  '\u017e':0x9e,'\u0178':0x9f,
};
function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str;
  // Quick bail-out: no high-range characters that indicate mojibake
  if (!/[\u0080-\u00ff\u0152\u0153\u0160\u0161\u017d\u017e\u0178\u0192\u02c6\u02dc\u2013-\u2026\u2030\u2039\u203a\u20ac\u2122]/.test(str)) return str;
  try {
    const bytes = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (_CP1252[ch] !== undefined) {
        bytes.push(_CP1252[ch]);
      } else if (cp <= 0xff) {
        bytes.push(cp);
      } else {
        return str; // non-latin char → this string is probably not pure mojibake
      }
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return str;
  }
}

const NamasteBotIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="32" cy="20" r="13" fill="currentColor" opacity="0.2" />
    <rect x="19" y="11" width="26" height="18" rx="8" fill="currentColor" />
    <circle cx="27" cy="20" r="2.8" fill="white" />
    <circle cx="37" cy="20" r="2.8" fill="white" />
    <rect x="28" y="25" width="8" height="2.8" rx="1.4" fill="white" />
    <rect x="31" y="5" width="2" height="5" rx="1" fill="currentColor" />
    <circle cx="32" cy="4" r="2" fill="currentColor" />
    <path d="M32 33C28.5 33 25.5 35.4 24.7 38.8L21.9 50.2C21.4 52.3 23.9 53.7 25.4 52.2L32 45.6L38.6 52.2C40.1 53.7 42.6 52.3 42.1 50.2L39.3 38.8C38.5 35.4 35.5 33 32 33Z" fill="currentColor" />
    <path d="M28.8 39.5L32 42.7L35.2 39.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Ticket creation step definitions ── */
const TICKET_STEPS = {
  IDLE: 'idle',
  SUBJECT: 'subject',
  CATEGORY: 'category',
  SUBCATEGORY: 'subcategory',
  PRIORITY: 'priority',
  LOCATION: 'location',
  DEPARTMENT: 'department',
  DESCRIPTION: 'description',
  CONFIRM: 'confirm',
};

const PASSWORD_STEPS = {
  IDLE: 'idle',
  NEW_PASSWORD: 'new_password',
  CURRENT_PASSWORD: 'current_password',
  CONFIRM: 'confirm',
};

/* ────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────── */
const AIAssistant = () => {
  const navigate = useNavigate();
  const { user, licenseState, hasLicensedFeature } = useAuth();
  const assistantLicensed = !licenseState?.loaded || hasLicensedFeature('ai_assistant');

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Initialize messages directly from localStorage to prevent race conditions
  const [messages, setMessages] = useState(() => {
    try {
      if (user?.user_id) {
        const raw = localStorage.getItem(`ai-assistant-messages-${user.user_id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.slice(-50).map((m) => ({ ...m, time: m?.time ? new Date(m.time) : new Date() }));
          }
        }
      }
    } catch { /* ignore corrupt data */ }
    return [];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Initialize hasGreeted from localStorage — true if we have persisted messages
  const [hasGreeted, setHasGreeted] = useState(() => {
    try {
      if (user?.user_id) {
        const raw = localStorage.getItem(`ai-assistant-messages-${user.user_id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  });

  // Initialize sessionId from localStorage — reuse persisted session for context continuity
  const [sessionId, setSessionId] = useState(() => {
    if (user?.user_id) {
      const key = `ai-assistant-session-${user.user_id}`;
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const generated = `session-${user.user_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, generated);
      return generated;
    }
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  const [botName, setBotName] = useState(() => settingsLoader.getSetting('bot_name', BOT_NAME));
  const [botIconUrl, setBotIconUrl] = useState(() => settingsLoader.getSetting('bot_icon_url', ''));
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Ticket creation wizard state ── */
  const [ticketStep, setTicketStep] = useState(TICKET_STEPS.IDLE);
  const [ticketDraft, setTicketDraft] = useState({
    subject: '',
    category_id: '',
    category_name: '',
    sub_category_id: '',
    sub_category_name: '',
    other_category_text: '',
    priority_id: '',
    priority_name: '',
    location_id: '',
    location_name: '',
    department_id: '',
    department_name: '',
    description: ''
  });
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);

  /* ── Password wizard state ── */
  const [passwordStep, setPasswordStep] = useState(PASSWORD_STEPS.IDLE);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [passwordDraft, setPasswordDraft] = useState({ newPassword: '', currentPassword: '' });

  /* ── Voice input state ── */
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  /* ── Feedback state: msgId → 'positive' | 'negative' ── */
  const [feedbacks, setFeedbacks] = useState({});
  const recognitionRef = useRef(null);
  const voiceFinalTextRef = useRef('');
  const autoSubmitRef = useRef(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setInput(finalTranscript);
          voiceFinalTextRef.current = finalTranscript;
        } else if (interimTranscript) {
          setInput(interimTranscript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-submit when speech recognition ends with final text
        const finalText = voiceFinalTextRef.current.trim();
        if (finalText) {
          // Small delay to ensure state updates have applied
          setTimeout(() => {
            if (autoSubmitRef.current) {
              autoSubmitRef.current(finalText);
            }
          }, 300);
        }
        voiceFinalTextRef.current = '';
      };

      recognition.onerror = (event) => {
        if (process.env.NODE_ENV === 'development') console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        voiceFinalTextRef.current = ''; // Clear on error
        if (event.error === 'not-allowed') {
          // Show error in current messages
          setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'bot',
            text: '🎤 Microphone access denied. Please allow microphone permission in your browser settings.',
            confidence: 1,
            time: new Date()
          }]);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput('');
      voiceFinalTextRef.current = ''; // Clear any previous transcript
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('[Voice] Start error:', err);
        setIsListening(false);
      }
    }
  }, [isListening]);

  const getAssetUrl = useCallback((assetPath) => {
    if (!assetPath) return '';
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
    if (assetPath.startsWith('/uploads')) {
      const base = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || '';
      return `${base}${assetPath}`;
    }
    return assetPath;
  }, []);

  const refreshBotBranding = useCallback(() => {
    setBotName(settingsLoader.getSetting('bot_name', BOT_NAME));
    setBotIconUrl(settingsLoader.getSetting('bot_icon_url', ''));
  }, []);

  useEffect(() => {
    const onSettingsUpdated = () => refreshBotBranding();
    window.addEventListener('settings-updated', onSettingsUpdated);
    refreshBotBranding();
    return () => window.removeEventListener('settings-updated', onSettingsUpdated);
  }, [refreshBotBranding]);

  // Fallback: sync session ID when user loads after component mount (e.g., AuthContext async)
  useEffect(() => {
    if (!user?.user_id) return;
    const sessionKey = `ai-assistant-session-${user.user_id}`;
    const existing = localStorage.getItem(sessionKey);
    if (existing) {
      setSessionId((prev) => prev !== existing ? existing : prev);
      return;
    }
    // Only generate if no session exists in localStorage yet
    setSessionId((prev) => {
      if (prev && localStorage.getItem(sessionKey)) return prev;
      const generated = `session-${user.user_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(sessionKey, generated);
      return generated;
    });
  }, [user?.user_id]);

  // Fallback: restore messages when user loads after component mount
  useEffect(() => {
    if (!user?.user_id) return;
    const messagesKey = `ai-assistant-messages-${user.user_id}`;
    const raw = localStorage.getItem(messagesKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages((prev) => {
          // Only restore if current messages are empty (greeting not yet sent)
          if (prev.length === 0) {
            setHasGreeted(true);
            return parsed.slice(-50).map((m) => ({ ...m, time: m?.time ? new Date(m.time) : new Date() }));
          }
          return prev;
        });
      }
    } catch {
      // Ignore invalid local storage payload
    }
  }, [user?.user_id]);

  // Persist last messages
  useEffect(() => {
    if (!user?.user_id || messages.length === 0) return;
    const messagesKey = `ai-assistant-messages-${user.user_id}`;
    localStorage.setItem(messagesKey, JSON.stringify(messages.slice(-50)));
  }, [messages, user?.user_id]);

  const botIconResolved = getAssetUrl(botIconUrl);

  /* ── auto‑scroll ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  /* ── Greeting (uses admin-configured bot_greeting with placeholders) ── */
  const getGreetingText = useCallback(() => {
    const rawTemplate = settingsLoader.getSetting('bot_greeting', '') || '';
    // Repair any emoji stored as garbled bytes from the database
    const template = fixMojibake(rawTemplate);
    if (!template || template.trim().length === 0) {
      const firstName = user?.first_name || user?.username || 'there';
      return `Hello ${firstName}! 👋 I'm **${botName || BOT_NAME}**, your IT support assistant.\n\nI can help you with ticket management, troubleshooting, password resets, and more.\n\n**How can I help you today?**`;
    }
    const firstName = user?.first_name || user?.username || 'there';
    const roleName = user?.role?.role_name || 'User';
    return template
      .replace(/\[UserName\]/g, firstName)
      .replace(/\[UserRole\]/g, roleName)
      .replace(/\[BotName\]/g, botName || BOT_NAME);
  }, [user, botName]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{
        id: Date.now(),
        role: 'bot',
        text: getGreetingText(),
        followUp: ['What is my last ticket status?', 'Reset my password', 'Create a ticket', 'Network issues'],
        confidence: 1,
        time: new Date()
      }]);
    }
  }, [hasGreeted, getGreetingText]);

  /* ── Call backend AI engine ── */
  const queryAI = useCallback(async (message) => {
    try {
      const response = await api.post('/ai/chat', { message, sessionId });
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error('Invalid response');
    } catch (err) {
      const featureDisabled = err.response?.status === 403 && err.response?.data?.data?.code === 'LICENSE_FEATURE_DISABLED';
      if (featureDisabled) {
        return {
          answer: `${err.response?.data?.message || 'This assistant is not enabled in the current license.'}\n\nPlease contact your administrator to enable the licensed AI assistant feature.`,
          confidence: 1,
          category: 'license-feature-disabled',
          followUp: ['Create a ticket', 'Help Center', 'Contact administrator'],
          sources: [],
          entities: [],
          matchedTopic: null
        };
      }

      const backendMsg = err.response?.data?.message;
      const is500 = err.response?.status === 500;
      const isNetwork = err.message === 'Network Error' || err.code === 'ERR_NETWORK';
      let hint = '';
      if (is500 || isNetwork) {
        hint = '\n\n**Tip:** If using Ollama for AI, ensure it is running (`ollama serve`) and has `llama3:8b` loaded. Check Settings → Bot Settings → AI Providers.';
      }

      return {
        answer: `${backendMsg || "I'm having trouble processing your request right now."}${hint}\n\nIn the meantime:\n1. **Browse the Help Center** articles below\n2. **Create a support ticket** for personalized help\n3. Try rephrasing your question\n\nI apologize for the inconvenience!`,
        confidence: 0,
        category: 'error',
        followUp: ['Create a ticket', 'Password reset', 'Network issues'],
        sources: [],
        entities: [],
        matchedTopic: null
      };
    }
  }, [sessionId]);

  /* ── Fetch dropdown data for ticket creation ── */
  const fetchTicketOptions = useCallback(async () => {
    const fallback = { data: { success: false, data: [] } };
    const [catRes, priRes, locRes, deptRes] = await Promise.all([
      api.get('/system/categories').catch(() => fallback),
      api.get('/system/priorities').catch(() => fallback),
      api.get('/system/locations').catch(() => fallback),
      api.get('/system/departments').catch(() => fallback),
    ]);
    if (catRes.data?.success) setCategories(catRes.data.data);
    if (priRes.data?.success) setPriorities(priRes.data.data);
    if (locRes.data?.success) setLocations(locRes.data.data);
    if (deptRes.data?.success) setDepartments(deptRes.data.data);
  }, []);

  const fetchSubCategories = useCallback(async (categoryId) => {
    if (!categoryId) {
      setSubCategories([]);
      return [];
    }

    try {
      const res = await api.get(`/system/sub-categories/${categoryId}`);
      if (res.data?.success) {
        const list = res.data.data || [];
        setSubCategories(list);
        return list;
      } else {
        setSubCategories([]);
        return [];
      }
    } catch {
      setSubCategories([]);
      return [];
    }
  }, []);

  /* ── Helper: add bot message ── */
  const addBotMsg = useCallback((text, extra = {}) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'bot',
      text,
      confidence: 1,
      time: new Date(),
      ...extra,
    }]);
  }, []);

  const getPolicy = useCallback(async () => {
    if (passwordPolicy) return passwordPolicy;
    try {
      const res = await api.get('/security/password-policy');
      if (res.data?.success) {
        setPasswordPolicy(res.data.data);
        return res.data.data;
      }
    } catch (e) {
    }
    const fallback = {
      password_min_length: '8',
      password_require_uppercase: 'true',
      password_require_lowercase: 'true',
      password_require_number: 'true',
      password_require_special: 'true',
      password_history_count: '5',
    };
    setPasswordPolicy(fallback);
    return fallback;
  }, [passwordPolicy]);

  const validateNewPassword = useCallback((pwd, policy) => {
    const errors = [];
    const minLen = Number(policy?.password_min_length || 8);
    const requireUpper = String(policy?.password_require_uppercase) === 'true';
    const requireLower = String(policy?.password_require_lowercase) === 'true';
    const requireNumber = String(policy?.password_require_number) === 'true';
    const requireSpecial = String(policy?.password_require_special) === 'true';

    if (!pwd || pwd.length < minLen) errors.push(`At least ${minLen} characters`);
    if (requireUpper && !/[A-Z]/.test(pwd)) errors.push('At least 1 uppercase letter');
    if (requireLower && !/[a-z]/.test(pwd)) errors.push('At least 1 lowercase letter');
    if (requireNumber && !/[0-9]/.test(pwd)) errors.push('At least 1 number');
    if (requireSpecial && !/[^A-Za-z0-9]/.test(pwd)) errors.push('At least 1 special character');

    return { valid: errors.length === 0, errors };
  }, []);

  const startPasswordWizard = useCallback(async () => {
    const policy = await getPolicy();
    const minLen = Number(policy?.password_min_length || 8);
    const historyCount = Number(policy?.password_history_count || 5);

    setPasswordDraft({ newPassword: '', currentPassword: '' });
    setPasswordStep(PASSWORD_STEPS.NEW_PASSWORD);
    await delay(300);
    setIsTyping(false);
    addBotMsg(
      `Sure — I can change your password securely.\n\n` +
      `**Password policy:**\n` +
      `• Minimum ${minLen} characters\n` +
      `• 1 uppercase, 1 lowercase, 1 number, 1 special character\n` +
      `• Must be different from last ${historyCount} passwords\n\n` +
      `Please provide your **new password**. _(Type \"cancel\" to stop)_`
    );
  }, [addBotMsg, getPolicy]);

  const submitPasswordChange = useCallback(async () => {
    setIsTyping(true);
    try {
      const response = await api.put('/profile/password', {
        current_password: passwordDraft.currentPassword,
        new_password: passwordDraft.newPassword,
        confirm_password: passwordDraft.newPassword,
      });

      await delay(500);
      setIsTyping(false);

      if (response.data?.success) {
        addBotMsg(
          `✅ Your password has been changed successfully.\n\nFor security, please use this new password on your next login as well.`,
          { followUp: ['Go to dashboard', 'What is my last ticket status?'] }
        );
      } else {
        throw new Error(response.data?.message || 'Password change failed');
      }
    } catch (error) {
      await delay(350);
      setIsTyping(false);
      const errMsg = error.response?.data?.message || error.message || 'Failed to change password';
      const policyErrors = error.response?.data?.data?.errors;
      const details = Array.isArray(policyErrors) && policyErrors.length > 0
        ? `\n\nPolicy checks:\n${policyErrors.map((e) => `• ${e}`).join('\n')}`
        : '';

      addBotMsg(`❌ Password change failed: ${errMsg}${details}`);
    } finally {
      setPasswordStep(PASSWORD_STEPS.IDLE);
      setPasswordDraft({ newPassword: '', currentPassword: '' });
    }
  }, [addBotMsg, passwordDraft]);

  const handlePasswordStep = useCallback(async (msg) => {
    const lower = msg.toLowerCase().trim();

    if (lower === 'cancel' || lower === 'abort' || lower === 'stop') {
      setPasswordStep(PASSWORD_STEPS.IDLE);
      setPasswordDraft({ newPassword: '', currentPassword: '' });
      await delay(250);
      setIsTyping(false);
      addBotMsg('Password change cancelled. How else can I help you?', {
        followUp: ['What is my last ticket status?', 'Create a ticket']
      });
      return;
    }

    if (passwordStep === PASSWORD_STEPS.NEW_PASSWORD) {
      const policy = await getPolicy();
      const validation = validateNewPassword(msg, policy);

      if (!validation.valid) {
        await delay(250);
        setIsTyping(false);
        addBotMsg(`That password does not meet policy:\n${validation.errors.map((e) => `• ${e}`).join('\n')}\n\nPlease enter a valid **new password**:`);
        return;
      }

      setPasswordDraft((prev) => ({ ...prev, newPassword: msg }));
      setPasswordStep(PASSWORD_STEPS.CURRENT_PASSWORD);
      await delay(250);
      setIsTyping(false);
      addBotMsg('Great. Now enter your **current password** to confirm this change:');
      return;
    }

    if (passwordStep === PASSWORD_STEPS.CURRENT_PASSWORD) {
      if (!msg || msg.length < 3) {
        await delay(200);
        setIsTyping(false);
        addBotMsg('Current password looks too short. Please re-enter your **current password**:');
        return;
      }

      setPasswordDraft((prev) => ({ ...prev, currentPassword: msg }));
      setPasswordStep(PASSWORD_STEPS.CONFIRM);
      await delay(200);
      setIsTyping(false);
      addBotMsg('Type **yes** to apply password change now, or **cancel** to stop.', { followUp: ['Yes', 'Cancel'] });
      return;
    }

    if (passwordStep === PASSWORD_STEPS.CONFIRM) {
      if (lower === 'yes' || lower === 'y' || lower === 'confirm') {
        await submitPasswordChange();
      } else {
        await delay(200);
        setIsTyping(false);
        addBotMsg('Please type **yes** to confirm password update, or **cancel** to stop.');
      }
    }
  }, [passwordStep, addBotMsg, getPolicy, validateNewPassword, submitPasswordChange]);

  /* ── Start ticket creation wizard ── */
  const startTicketWizard = useCallback(async () => {
    await fetchTicketOptions();
    setTicketDraft({
      subject: '',
      category_id: '',
      category_name: '',
      sub_category_id: '',
      sub_category_name: '',
      other_category_text: '',
      priority_id: '',
      priority_name: '',
      location_id: '',
      location_name: '',
      department_id: '',
      department_name: '',
      description: ''
    });
    setSubCategories([]);
    setTicketStep(TICKET_STEPS.SUBJECT);
    await delay(500);
    setIsTyping(false);
    addBotMsg(
      `Great! Let's create a support ticket together. 🎫\n\nI'll ask you a few questions to fill in the details.\n\n**Step 1 — Subject**\nPlease enter a short summary for your ticket (e.g. "Cannot access email", "Laptop not booting"):`,
    );
  }, [fetchTicketOptions, addBotMsg]);

  /* ── Submit ticket to API ── */
  const submitTicket = useCallback(async () => {
    setIsTyping(true);
    try {
      const body = {
        subject: ticketDraft.subject,
        description: ticketDraft.description,
      };
      if (ticketDraft.category_id) body.category_id = Number(ticketDraft.category_id);
      if (ticketDraft.sub_category_id) body.sub_category_id = Number(ticketDraft.sub_category_id);
      if (ticketDraft.other_category_text) body.other_category_text = ticketDraft.other_category_text;
      if (ticketDraft.priority_id) body.priority_id = Number(ticketDraft.priority_id);
      if (ticketDraft.location_id) body.location_id = Number(ticketDraft.location_id);
      if (ticketDraft.department_id) body.department_id = Number(ticketDraft.department_id);

      const res = await api.post('/tickets', body);
      await delay(800);
      setIsTyping(false);

      if (res.data?.success) {
        const t = res.data.data;
        const ticketNo = t?.ticket_number || t?.ticketNumber || 'N/A';
        addBotMsg(
          `✅ **Ticket created successfully!**\n\n` +
          `🔖 **Ticket #**: ${ticketNo}\n` +
          `📌 **Subject**: ${ticketDraft.subject}\n` +
          `📂 **Category**: ${ticketDraft.category_name || 'Default'}\n` +
          `⚡ **Priority**: ${ticketDraft.priority_name || 'Default'}\n` +
          `📍 **Location**: ${ticketDraft.location_name || 'Default'}\n` +
          `🏢 **Department**: ${ticketDraft.department_name || 'N/A'}\n\n` +
          `Our team will review your ticket shortly. You can track it from the **My Tickets** page.`,
          { followUp: ['Track my ticket', 'Create a ticket', 'Go to dashboard'] }
        );
      } else {
        throw new Error(res.data?.message || 'Failed to create ticket');
      }
    } catch (err) {
      await delay(400);
      setIsTyping(false);
      const errMsg = err.response?.data?.message || err.message || 'Something went wrong';
      addBotMsg(
        `❌ **Ticket creation failed**: ${errMsg}\n\nPlease try again or create a ticket manually from the tickets page.`,
        { followUp: ['Create a ticket', 'Go to dashboard'] }
      );
    } finally {
      setTicketStep(TICKET_STEPS.IDLE);
      setTicketDraft({
        subject: '',
        category_id: '',
        category_name: '',
        sub_category_id: '',
        sub_category_name: '',
        other_category_text: '',
        priority_id: '',
        priority_name: '',
        location_id: '',
        location_name: '',
        department_id: '',
        department_name: '',
        description: ''
      });
      setSubCategories([]);
    }
  }, [ticketDraft, addBotMsg]);

  /* ── Handle ticket wizard step input ── */
  const handleTicketStep = useCallback(async (msg) => {
    const lower = msg.toLowerCase().trim();

    // Allow cancel at any point
    if (lower === 'cancel' || lower === 'abort' || lower === 'stop') {
      setTicketStep(TICKET_STEPS.IDLE);
      setTicketDraft({
        subject: '',
        category_id: '',
        category_name: '',
        sub_category_id: '',
        sub_category_name: '',
        other_category_text: '',
        priority_id: '',
        priority_name: '',
        location_id: '',
        location_name: '',
        department_id: '',
        department_name: '',
        description: ''
      });
      setSubCategories([]);
      await delay(400);
      setIsTyping(false);
      addBotMsg('Ticket creation cancelled. ❌\n\nHow else can I help you?', {
        followUp: ['Create a ticket', 'Reset my password', 'Network issues'],
      });
      return;
    }

    // Helper to show the next step after PRIORITY (which is LOCATION)
    const showLocationStep = async () => {
      setTicketStep(TICKET_STEPS.LOCATION);
      await delay(500);
      setIsTyping(false);

      if (locations.length > 0) {
        const locList = locations.map((l, i) => `${i + 1}. ${l.location_name}`).join('\n');
        addBotMsg(
          `Great! ✅\n\n**Step 5 — Location** _(required)_\nSelect your location by entering its **number**:\n\n${locList}`
        );
      } else {
        // No locations configured — skip to department
        showDepartmentStep();
      }
    };

    // Helper to show the DEPARTMENT step
    const showDepartmentStep = async () => {
      if (departments.length > 0) {
        setTicketStep(TICKET_STEPS.DEPARTMENT);
        await delay(500);
        setIsTyping(false);
        const deptList = departments.map((d, i) => `${i + 1}. ${d.department_name}`).join('\n');
        addBotMsg(
          `Great! ✅\n\n**Step 6 — Department** _(optional)_\nSelect a department by entering its **number**:\n\n${deptList}\n\n_(or type "skip")_`
        );
      } else {
        // No departments — skip to description
        showDescriptionStep();
      }
    };

    // Helper to show the DESCRIPTION step
    const showDescriptionStep = async () => {
      setTicketStep(TICKET_STEPS.DESCRIPTION);
      await delay(500);
      setIsTyping(false);
      addBotMsg(
        `Almost there! ✅\n\n**Step 7 — Description** _(required)_\nPlease describe your issue in detail. Include any error messages, when it started, and steps to reproduce:`,
      );
    };

    switch (ticketStep) {
      case TICKET_STEPS.SUBJECT: {
        if (msg.length < 3) {
          await delay(400);
          setIsTyping(false);
          addBotMsg('⚠️ Subject is too short. Please enter at least 3 characters:');
          return;
        }
        setTicketDraft(prev => ({ ...prev, subject: msg }));
        setTicketStep(TICKET_STEPS.CATEGORY);
        await delay(500);
        setIsTyping(false);

        if (categories.length > 0) {
          const catList = categories.map((c, i) => `${i + 1}. ${c.category_name}`).join('\n');
          addBotMsg(
            `Got it! ✅\n\n**Step 2 — Category** _(required)_\nSelect a category by entering its **number**:\n\n${catList}`
          );
        } else {
          addBotMsg(
            `Got it! ✅\n\n**Step 2 — Category** _(required)_\nNo categories are configured. Type the category name or type "skip" to use default:`
          );
        }
        break;
      }

      case TICKET_STEPS.CATEGORY: {
        const num = parseInt(msg, 10);
        const catArr = categories.length > 0 ? categories : [];

        if (catArr.length > 0 && num >= 1 && num <= catArr.length) {
          const cat = catArr[num - 1];
          setTicketDraft(prev => ({
            ...prev,
            category_id: cat.category_id,
            category_name: cat.category_name,
            sub_category_id: '',
            sub_category_name: '',
            other_category_text: ''
          }));
          const fetchedSubCategories = await fetchSubCategories(cat.category_id);

          if (fetchedSubCategories.length > 0) {
            setTicketStep(TICKET_STEPS.SUBCATEGORY);
            await delay(500);
            setIsTyping(false);

            const subList = fetchedSubCategories.map((sc, i) => `${i + 1}. ${sc.sub_category_name}`).join('\n');
            addBotMsg(
              `Great! ✅\n\n**Step 3 — Subcategory**\nSelect a subcategory by entering its **number**:\n\n${subList}\n\n_(or type "skip")_`
            );
            break;
          }
        } else if (catArr.length > 0) {
          await delay(400);
          setIsTyping(false);
          addBotMsg(`⚠️ Invalid selection. Please enter a number between **1** and **${catArr.length}**:`);
          return;
        }

        // No subcategories or no categories — go to PRIORITY
        setTicketStep(TICKET_STEPS.PRIORITY);
        await delay(500);
        setIsTyping(false);

        if (priorities.length > 0) {
          const priList = priorities.map((p, i) => `${i + 1}. ${p.priority_name}`).join('\n');
          addBotMsg(
            `Great! ✅\n\n**Step 4 — Priority** _(required)_\nSelect a priority level by entering its **number**:\n\n${priList}`
          );
        } else {
          addBotMsg(
            `Great! ✅\n\n**Step 4 — Priority** _(required)_\nNo priorities configured. Type "skip" to use default (Medium):`
          );
        }
        break;
      }

      case TICKET_STEPS.SUBCATEGORY: {
        if (lower === 'skip') {
          setTicketDraft(prev => ({
            ...prev,
            sub_category_id: '',
            sub_category_name: '',
            other_category_text: ''
          }));
        } else {
          const num = parseInt(msg, 10);
          if (subCategories.length > 0 && num >= 1 && num <= subCategories.length) {
            const sub = subCategories[num - 1];
            setTicketDraft(prev => ({
              ...prev,
              sub_category_id: sub.sub_category_id,
              sub_category_name: sub.sub_category_name,
            }));
          } else if (subCategories.length > 0) {
            await delay(400);
            setIsTyping(false);
            addBotMsg(`⚠️ Invalid selection. Please enter a number between **1** and **${subCategories.length}**, or type "skip":`);
            return;
          }
        }

        setTicketStep(TICKET_STEPS.PRIORITY);
        await delay(500);
        setIsTyping(false);

        if (priorities.length > 0) {
          const priList = priorities.map((p, i) => `${i + 1}. ${p.priority_name}`).join('\n');
          addBotMsg(
            `Great! ✅\n\n**Step 4 — Priority** _(required)_\nSelect a priority level by entering its **number**:\n\n${priList}`
          );
        } else {
          addBotMsg(
            `Great! ✅\n\n**Step 4 — Priority** _(required)_\nNo priorities configured. Type "skip" to use default (Medium):`
          );
        }
        break;
      }

      case TICKET_STEPS.PRIORITY: {
        const num = parseInt(msg, 10);
        const priArr = priorities.length > 0 ? priorities : [];
        if (priArr.length > 0 && num >= 1 && num <= priArr.length) {
          const pri = priArr[num - 1];
          setTicketDraft(prev => ({ ...prev, priority_id: pri.priority_id, priority_name: pri.priority_name }));
        } else if (priArr.length > 0) {
          await delay(400);
          setIsTyping(false);
          addBotMsg(`⚠️ Invalid selection. Please enter a number between **1** and **${priArr.length}**:`);
          return;
        }

        await showLocationStep();
        break;
      }

      case TICKET_STEPS.LOCATION: {
        const num = parseInt(msg, 10);
        const locArr = locations.length > 0 ? locations : [];
        if (locArr.length > 0 && num >= 1 && num <= locArr.length) {
          const loc = locArr[num - 1];
          setTicketDraft(prev => ({ ...prev, location_id: loc.location_id, location_name: loc.location_name }));
        } else if (locArr.length > 0) {
          await delay(400);
          setIsTyping(false);
          addBotMsg(`⚠️ Invalid selection. Please enter a number between **1** and **${locArr.length}**:`);
          return;
        }

        await showDepartmentStep();
        break;
      }

      case TICKET_STEPS.DEPARTMENT: {
        if (lower === 'skip') {
          setTicketDraft(prev => ({ ...prev, department_id: '', department_name: '' }));
        } else {
          const num = parseInt(msg, 10);
          const deptArr = departments.length > 0 ? departments : [];
          if (deptArr.length > 0 && num >= 1 && num <= deptArr.length) {
            const dept = deptArr[num - 1];
            setTicketDraft(prev => ({ ...prev, department_id: dept.department_id, department_name: dept.department_name }));
          } else if (deptArr.length > 0) {
            await delay(400);
            setIsTyping(false);
            addBotMsg(`⚠️ Invalid selection. Please enter a number between **1** and **${deptArr.length}**, or type "skip":`);
            return;
          }
        }

        await showDescriptionStep();
        break;
      }

      case TICKET_STEPS.DESCRIPTION: {
        if (msg.length < 10) {
          await delay(400);
          setIsTyping(false);
          addBotMsg('⚠️ Description is too short. Please provide at least 10 characters to help our team understand your issue:');
          return;
        }
        setTicketDraft(prev => {
          const updated = { ...prev, description: msg };
          // Move to confirm using a timeout so state is updated
          setTimeout(() => {
            setTicketStep(TICKET_STEPS.CONFIRM);
            const catDisplay = updated.category_name || 'Default';
            const subCatDisplay = updated.sub_category_name ? updated.sub_category_name : '—';
            const priDisplay = updated.priority_name || 'Default (Medium)';
            const locDisplay = updated.location_name || '—';
            const deptDisplay = updated.department_name || '—';
            addBotMsg(
              `📋 **Ticket Summary — Please Review**\n\n` +
              `📌 **Subject**: ${updated.subject}\n` +
              `📂 **Category**: ${catDisplay}\n` +
              `🗂️ **Subcategory**: ${subCatDisplay}\n` +
              `⚡ **Priority**: ${priDisplay}\n` +
              `📍 **Location**: ${locDisplay}\n` +
              `🏢 **Department**: ${deptDisplay}\n` +
              `📝 **Description**: ${updated.description}\n\n` +
              `Type **"yes"** to submit, or **"no"** to cancel.`,
              { followUp: ['Yes', 'No'] }
            );
          }, 600);
          return updated;
        });
        await delay(500);
        setIsTyping(false);
        break;
      }

      case TICKET_STEPS.CONFIRM: {
        if (lower === 'yes' || lower === 'y' || lower === 'confirm' || lower === 'submit') {
          submitTicket();
        } else if (lower === 'no' || lower === 'n') {
          setTicketStep(TICKET_STEPS.IDLE);
          setTicketDraft({
            subject: '',
            category_id: '',
            category_name: '',
            sub_category_id: '',
            sub_category_name: '',
            other_category_text: '',
            priority_id: '',
            priority_name: '',
            location_id: '',
            location_name: '',
            department_id: '',
            department_name: '',
            description: ''
          });
          setSubCategories([]);
          await delay(400);
          setIsTyping(false);
          addBotMsg('Ticket creation cancelled. ❌\n\nHow else can I help you?', {
            followUp: ['Create a ticket', 'Reset my password', 'Network issues'],
          });
        } else {
          await delay(300);
          setIsTyping(false);
          addBotMsg('Please type **"yes"** to submit the ticket or **"no"** to cancel.', { followUp: ['Yes', 'No'] });
        }
        break;
      }

      default:
        break;
    }
  }, [ticketStep, categories, subCategories, priorities, locations, departments, addBotMsg, submitTicket, fetchSubCategories]);

  /* ── Send message ── */
  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    // Add user message
    const maskInput = passwordStep !== PASSWORD_STEPS.IDLE;
    const userMsg = { id: Date.now(), role: 'user', text: maskInput ? '••••••••' : msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    if (passwordStep !== PASSWORD_STEPS.IDLE) {
      await handlePasswordStep(msg);
      return;
    }

    // If ticket creation wizard is active, route to wizard handler
    if (ticketStep !== TICKET_STEPS.IDLE) {
      await handleTicketStep(msg);
      return;
    }

    // Handle navigation shortcuts with fuzzy intent matching
    const lower = msg.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // ── Fuzzy intent matchers ──
    // Ticket creation: matches "create a ticket", "I want to raise ticket", "can you log a ticket", etc.
    const ticketCreatePattern = /\b(create|raise|new|open|submit|log|make|file|register|book)\b.*\b(ticket|issue|request|complaint|problem)\b|\b(ticket|issue|request)\b.*\b(create|raise|open|submit|log|make|file|register)\b|\b(i\s+(want|need|would like)\s+to\s+(create|raise|open|submit|log|make|file)\s+(a\s+)?(ticket|issue|request))/i;

    // Password change: matches "change my password", "I want to reset password", "how to update my pwd", "modify password", etc.
    const passwordPattern = /\b(change|reset|update|modify|forgot|forget|set|alter|renew)\b.*\b(password|pwd|passcode|credentials|pass\s*word)\b|\b(password|pwd|passcode|credentials)\b.*\b(change|reset|update|modify|forgot|set|alter|renew)\b|\b(i\s+(want|need|would like)\s+to\s+(change|reset|update|modify)\s+(my\s+)?(password|pwd|passcode))/i;

    // Dashboard navigation: matches "go to dashboard", "show dashboard", "open dashboard", "take me to dashboard"
    const dashboardPattern = /\b(go\s+to|show|open|take\s+me\s+to|navigate\s+to|view)\b.*\bdashboard\b|\bdashboard\b/i;

    // Track tickets: matches "track my ticket", "my tickets", "show my tickets", "where is my ticket", "view my tickets"
    const trackTicketPattern = /\b(track|show|view|see|where|find|list|check)\b.*\b(my\s+ticket|my\s+issue|my\s+request)s?\b|\bmy\s+tickets?\b/i;

    // Help center: matches "help center", "go to help", "need help", "help me", "show help"
    const helpCenterPattern = /\b(go\s+to|back\s+to|show|open|take\s+me\s+to|navigate\s+to)\b.*\bhelp(\s+center)?\b|\bhelp\s+center\b/i;

    if (ticketCreatePattern.test(lower)) {
      await startTicketWizard();
      return;
    }

    if (passwordPattern.test(lower)) {
      await startPasswordWizard();
      return;
    }

    if (dashboardPattern.test(lower)) {
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

    if (trackTicketPattern.test(lower)) {
      await delay(500);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: 'Taking you to tickets with **Created by Me** filter... 📋',
        confidence: 1,
        time: new Date()
      }]);
      await delay(800);
      navigate('/tickets?requester_id=me');
      setIsOpen(false);
      return;
    }

    if (helpCenterPattern.test(lower)) {
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
      sources: result.sources || [],
      entities: result.entities,
      aiProvider: result.aiProvider || null,
      aiEnhanced: result.aiEnhanced || false,
      time: new Date()
    }]);
  }, [
    input,
    navigate,
    queryAI,
    ticketStep,
    handleTicketStep,
    startTicketWizard,
    passwordStep,
    handlePasswordStep,
    startPasswordWizard,
  ]);

  // Keep autoSubmitRef in sync with handleSend for voice auto-submit
  useEffect(() => {
    autoSubmitRef.current = handleSend;
  }, [handleSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setTicketStep(TICKET_STEPS.IDLE);
    setTicketDraft({
      subject: '',
      category_id: '',
      category_name: '',
      sub_category_id: '',
      sub_category_name: '',
      other_category_text: '',
      priority_id: '',
      priority_name: '',
      description: ''
    });
    setSubCategories([]);
    setPasswordStep(PASSWORD_STEPS.IDLE);
    setPasswordDraft({ newPassword: '', currentPassword: '' });
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    if (user?.user_id) {
      localStorage.removeItem(`ai-assistant-messages-${user.user_id}`);
      const newSession = `session-${user.user_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(`ai-assistant-session-${user.user_id}`, newSession);
      setSessionId(newSession);
    }

    // Reset greeting and immediately show welcome message (uses configured greeting)
    setMessages([{
      id: Date.now(),
      role: 'bot',
      text: getGreetingText(),
      followUp: ['What is my last ticket status?', 'Reset my password', 'Create a ticket', 'Network issues'],
      confidence: 1,
      time: new Date()
    }]);
    setHasGreeted(true);
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

  const handleSourceClick = async (source) => {
    if (!source) return;

    if (source.sourceType === 'article' && source.articleId) {
      navigate(`/help?article=${encodeURIComponent(source.articleId)}`);
      setIsOpen(false);
      return;
    }

    if (source.sourceType === 'training') {
      await handleSend(`Explain the fix from ${source.title}`);
    }
  };

  /* ── Send 👍/👎 feedback for a bot message ── */
  const sendFeedback = useCallback(async (msg, vote) => {
    // Prevent re-voting or voting on greeting / system messages
    if (feedbacks[msg.id] || msg.confidence === 1) return;

    // Optimistically mark in UI
    setFeedbacks(prev => ({ ...prev, [msg.id]: vote }));

    // Find the last user message that preceded this bot message
    const botIndex = messages.findIndex(m => m.id === msg.id);
    const prevUser = botIndex > 0
      ? [...messages].slice(0, botIndex).reverse().find(m => m.role === 'user')
      : null;

    try {
      await api.post('/ai/feedback', {
        sessionId,
        userQuestion: prevUser?.text || '',
        botAnswer: msg.text || '',
        feedback: vote,
      });
    } catch {
      // Feedback is best-effort — don't disturb the user on failure
    }
  }, [feedbacks, messages, sessionId]);

  /* ── Confidence indicator ── */
  const ConfidenceDot = ({ confidence }) => {
    if (confidence === undefined || confidence === null) return null;
    const pct = Math.round(confidence * 100);
    const color = pct >= 70 ? 'var(--success-color, #10b981)' :
                  pct >= 40 ? 'var(--warning-color, #f59e0b)' :
                              'var(--text-muted, #94a3b8)';
    return (
      <span className="nbot-confidence" title={`AI Confidence: ${pct}%`}>
        <span className="nbot-confidence-dot" style={{ background: color }} />
        <span className="nbot-confidence-text">{pct}%</span>
      </span>
    );
  };

  /* ═══ RENDER ═══ */
  if (!assistantLicensed) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="nbot-fab" onClick={openChat} title={botName || BOT_NAME}>
          <div className="nbot-fab-icon">
            {botIconResolved ? (
              <img src={botIconResolved} alt="Bot" className="nbot-custom-icon" onError={() => setBotIconUrl('')} />
            ) : (
              <NamasteBotIcon size={22} />
            )}
          </div>
          <span className="nbot-fab-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`nbot-chat ${isExpanded ? 'nbot-chat--expanded' : ''}`}>
          {/* Header */}
          <div className="nbot-chat-header">
            <div className="nbot-chat-header-left">
              <div className="nbot-avatar">
                {botIconResolved ? (
                  <img src={botIconResolved} alt="Bot" className="nbot-custom-icon" onError={() => setBotIconUrl('')} />
                ) : (
                  <NamasteBotIcon size={18} />
                )}
              </div>
              <div>
                <h4>{botName || BOT_NAME}</h4>
                <span className="nbot-status">
                  <span className="nbot-status-dot" />
                  Online
                </span>
              </div>
            </div>
            <div className="nbot-chat-header-actions">
              <button onClick={resetChat} title="New conversation"><RotateCcw size={16} /></button>
              <button onClick={() => setIsExpanded(p => !p)} title={isExpanded ? 'Minimize' : 'Expand'}>
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)} title="Close"><X size={16} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="nbot-chat-body">
            {messages.map((msg) => (
              <div key={msg.id} className={`nbot-msg nbot-msg--${msg.role}`}>
                <div className="nbot-msg-avatar">
                  {msg.role === 'bot'
                    ? (botIconResolved
                        ? <img src={botIconResolved} alt="Bot" className="nbot-custom-icon-sm" onError={() => setBotIconUrl('')} />
                        : <NamasteBotIcon size={14} />)
                    : <User size={16} />}
                </div>
                <div className="nbot-msg-content">
                  <div className="nbot-msg-bubble" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatText(msg.text)) }} />
                  {msg.role === 'bot' && msg.confidence !== undefined && msg.confidence < 1 && (
                    <ConfidenceDot confidence={msg.confidence} />
                  )}
                  {msg.role === 'bot' && msg.aiProvider && (
                    <span className="nbot-ai-badge" title={`Powered by ${msg.aiProvider}`}>
                      ⚡ {msg.aiProvider}
                    </span>
                  )}
                  {msg.role === 'bot' && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                    <div className="nbot-sources-block">
                      <div className="nbot-sources-label">Sources</div>
                      <div className="nbot-sources-list">
                        {msg.sources.slice(0, 3).map((source) => (
                          <button
                            key={`${msg.id}-${source.articleId}`}
                            type="button"
                            className={`nbot-source-chip nbot-source-chip--${source.sourceType || 'article'}`}
                            onClick={() => handleSourceClick(source)}
                            title={`${source.title}${source.score ? ` (${Math.round(source.score * 10) / 10})` : ''}`}
                          >
                            <span className="nbot-source-chip-type">
                              {source.sourceType === 'training' ? 'Fix' : 'Guide'}
                            </span>
                            <span className="nbot-source-chip-title">{source.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.followUp && msg.followUp.length > 0 && (
                    <div className="nbot-suggestions">
                      {msg.followUp.map((s, i) => (
                        <button key={i} className="nbot-chip" onClick={() => handleSend(s)}>
                          <ArrowRight size={12} />{s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="nbot-msg-footer">
                    <span className="nbot-msg-time">
                      {formatTime(msg.time)}
                    </span>
                    {msg.role === 'bot' && msg.confidence !== undefined && msg.confidence < 1 && (
                      <div className="nbot-feedback-btns" title="Was this helpful?">
                        <button
                          className={`nbot-feedback-btn${feedbacks[msg.id] === 'positive' ? ' nbot-feedback-btn--active-pos' : ''}`}
                          onClick={() => sendFeedback(msg, 'positive')}
                          disabled={!!feedbacks[msg.id]}
                          aria-label="Helpful"
                        >👍</button>
                        <button
                          className={`nbot-feedback-btn${feedbacks[msg.id] === 'negative' ? ' nbot-feedback-btn--active-neg' : ''}`}
                          onClick={() => sendFeedback(msg, 'negative')}
                          disabled={!!feedbacks[msg.id]}
                          aria-label="Not helpful"
                        >👎</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="nbot-msg nbot-msg--bot">
                <div className="nbot-msg-avatar">
                  {botIconResolved
                    ? <img src={botIconResolved} alt="Bot" className="nbot-custom-icon-sm" onError={() => setBotIconUrl('')} />
                    : <NamasteBotIcon size={14} />}
                </div>
                <div className="nbot-msg-content">
                  <div className="nbot-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="nbot-chat-footer">
            <div className="nbot-input-wrap">
              {voiceSupported && (
                <button
                  className={`nbot-voice-btn ${isListening ? 'nbot-voice-btn--active' : ''}`}
                  onClick={toggleVoice}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                  type="button"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  {isListening && <span className="nbot-voice-pulse" />}
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  isListening ? '🎤 Listening... speak now' :
                  ticketStep === TICKET_STEPS.SUBJECT ? 'Enter ticket subject...' :
                  ticketStep === TICKET_STEPS.CATEGORY ? 'Enter category number or "skip"...' :
                  ticketStep === TICKET_STEPS.PRIORITY ? 'Enter priority number or "skip"...' :
                  ticketStep === TICKET_STEPS.DESCRIPTION ? 'Describe your issue in detail...' :
                  ticketStep === TICKET_STEPS.CONFIRM ? 'Type "yes" or "no"...' :
                  'Describe your IT issue...'
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="nbot-send"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="nbot-disclaimer">
              <Zap size={10} /> AI-Powered {settingsLoader.getSetting('company_name') || 'IT'} Support
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
