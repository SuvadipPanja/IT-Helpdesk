// ============================================
// BOT BEHAVIOR CONFIG SERVICE
// Fetches greeting, personality, empathy, and system prompt building
// Enables human-like, empathetic, admin-controlled responses
// ============================================

const settingsService = require('./settings.service');
const logger = require('../utils/logger');

// Empathy/sentiment indicators - user seems frustrated, urgent, or stressed
const EMPATHY_INDICATORS = [
  /\b(frustrated|frustrating|annoyed|angry|upset|mad)\b/i,
  /\b(urgent|emergency|asap|as soon as possible|critical|immediately)\b/i,
  /\b(help!|please help|desperate|stuck|blocked)\b/i,
  /\b(not working again|still not working|broken again|again!)\b/i,
  /\b(why\s+(is|does|won't|can't)|why is this)\b/i,
  /\b(wasted|wasting|hours|days|too long)\b/i,
  /\b(can't get|unable to|impossible)\b/i,
  /\b(deadline|due (today|tomorrow)|client waiting)\b/i,
];

// Personality tone instructions for external AI
const PERSONALITY_INSTRUCTIONS = {
  professional_friendly: `Be warm, helpful, and professional. Use a friendly but respectful tone. 
    Acknowledge the user's situation before solving. Use phrases like "I understand", "Let me help you with that", "Good question".`,

  formal: `Be formal and professional. Use clear, concise language. Avoid casual phrases. 
    Maintain a respectful, business-appropriate tone throughout.`,

  casual: `Be conversational and approachable. You can use informal language, light humor where appropriate.
    Keep it friendly like a helpful colleague.`,

  technical: `Be precise and technical. Use proper terminology. Provide detailed, step-by-step explanations.
    Assume the user wants accuracy and depth.`,
};

const EMPATHY_PREAMBLE = `
**EMPATHY MODE ACTIVE**: The user may be frustrated or under time pressure. 
- Start with a brief, genuine acknowledgment of their situation (e.g., "I understand this is frustrating" or "I know timing matters").
- Be extra clear and actionable. Avoid lengthy preambles.
- If the issue is complex, break it into small, doable steps.
- Offer to create a ticket if they need human follow-up.`;

/**
 * Detect if the user message suggests frustration, urgency, or stress
 */
function detectEmpathyNeeded(message) {
  if (!message || typeof message !== 'string') return false;
  const text = message.trim();
  return EMPATHY_INDICATORS.some((pattern) => pattern.test(text));
}

/**
 * Get full bot behavior config from system_settings
 */
async function getBehaviorConfig() {
  try {
    const all = await settingsService.getAll(true);
    const get = (key, fallback) => (all[key]?.value !== undefined && all[key]?.value !== null && all[key]?.value !== '') ? all[key].value : fallback;

    return {
      bot_name: get('bot_name', 'IT Support Assistant'),
      bot_greeting: get('bot_greeting', 'Hello [UserName]! 👋 I\'m [BotName], your IT support assistant. How can I help you today?'),
      bot_default_context: get('bot_default_context', 'I can help with tickets, password resets, troubleshooting, and more. I have access to your account and can fetch your ticket status.'),
      bot_personality_tone: get('bot_personality_tone', 'professional_friendly'),
      bot_enable_intelligence: get('bot_enable_intelligence', 'true') !== 'false' && get('bot_enable_intelligence', 'true') !== '0',
      bot_empathy_enabled: get('bot_empathy_enabled', 'true') !== 'false' && get('bot_empathy_enabled', 'true') !== '0',
      bot_confidence_threshold: parseFloat(get('bot_confidence_threshold', '0.45')) || 0.45,
      bot_ai_always_enhance: get('bot_ai_always_enhance', 'false') === 'true', // When true, always use external AI for complex queries
    };
  } catch (err) {
    logger.warn('Failed to fetch bot behavior config:', err.message);
    return {
      bot_name: 'IT Support Assistant',
      bot_greeting: 'Hello! 👋 I\'m your IT support assistant. How can I help you today?',
      bot_default_context: 'I can help with tickets, troubleshooting, and more.',
      bot_personality_tone: 'professional_friendly',
      bot_enable_intelligence: true,
      bot_empathy_enabled: true,
      bot_confidence_threshold: 0.45,
      bot_ai_always_enhance: false,
    };
  }
}

/**
 * Build the system prompt for external AI providers
 * Includes personality, empathy cues, app context, and integration capabilities
 */
async function buildAISystemPrompt(botName, user, userContext = '') {
  const config = await getBehaviorConfig();
  const personality = PERSONALITY_INSTRUCTIONS[config.bot_personality_tone] || PERSONALITY_INSTRUCTIONS.professional_friendly;
  const context = config.bot_default_context || '';

  let prompt = `You are an expert IT helpdesk assistant named "${botName || config.bot_name}". You are integrated into a live ticketing system.

**CORE BEHAVIOR:**
- ${personality}
- Provide accurate, correct, and actionable answers. If unsure, say so and suggest creating a support ticket.
- Use markdown for formatting (bold, lists, code blocks).
- Be concise but thorough. Break complex instructions into numbered steps.
- You have real-time access to: user's tickets, ticket status, team stats (for admins), password policy, and more.
- For general (non-IT) questions (e.g., trivia, definitions, general knowledge, small talk), answer helpfully and naturally. You are NOT limited to IT topics only.

**CONVERSATION STYLE:**
- For greetings and small talk ("how are you", "good morning", "what's up"), respond warmly and naturally, then gently offer help.
- Reference the previous conversation when relevant — e.g., "Following up on what you mentioned earlier..." or "Since we were just looking at your ticket...".
- Vary your sentence structure to avoid sounding repetitive or robotic.
- Never start consecutive responses the same way (avoid always starting with "Sure!" or "Of course!").
- It's fine to show personality: light humor or a friendly comment is welcome where appropriate.
- Keep responses conversational and avoid overly formal  or mechanical language.

**APPLICATION INTEGRATION:**
- ${context}
- You can guide users to: create tickets, change password, view ticket status, navigate to dashboard, help center.
- When suggesting actions, mention the exact steps or paths (e.g., "Go to Tickets → Create" or "Say 'create a ticket'").

**USER CONTEXT:**
- Current user: ${user?.full_name || user?.username || 'User'} (Role: ${user?.role?.role_name || 'User'})
${userContext}`;

  return prompt;
}

/**
 * Get empathy preamble to append to system prompt when user seems stressed
 */
function getEmpathyPreamble(enabled) {
  if (!enabled) return '';
  return '\n\n' + EMPATHY_PREAMBLE;
}

module.exports = {
  detectEmpathyNeeded,
  getBehaviorConfig,
  buildAISystemPrompt,
  getEmpathyPreamble,
  PERSONALITY_INSTRUCTIONS,
};
