// ============================================
// BOT API INTEGRATION SERVICE
// Handles actual integration with external APIs (OpenAI, Claude, Google, Ollama, etc)
// Routes requests to configured providers, tracks usage
// Date: March 4, 2026
// ============================================

const db = require('../config/database');
const logger = require('../utils/logger');
const botApiProviderService = require('./botApiProviderService');

class BotApiIntegrationService {
  /**
   * Get available providers with capabilities needed
   */
  async getAvailableProvidersForQuery(queryType) {
    try {
      const providers = await botApiProviderService.getEnabledProviders();
      
      // Map query types to required capabilities
      const queryCapabilitiesMap = {
        'code_analysis': ['code_analysis'],
        'coding_help': ['coding_help', 'code_analysis'],
        'complex_reasoning': ['complex_reasoning'],
        'technical_support': ['code_analysis', 'complex_reasoning'],
        'general': ['code_analysis', 'complex_reasoning']
      };
      
      const requiredCapabilities = queryCapabilitiesMap[queryType] || [];
      
      // Filter providers that have required capabilities
      return providers.filter(p => {
        if (requiredCapabilities.length === 0) return true;
        return requiredCapabilities.some(cap => p.capabilities?.includes(cap));
      });
    } catch (error) {
      logger.error('Error getting available providers:', error);
      return [];
    }
  }

  /**
   * Determine primary provider (from enabled list)
   */
  async getPrimaryProvider() {
    try {
      const providers = await botApiProviderService.getEnabledProviders();
      return providers.length > 0 ? providers[0] : null;
    } catch (error) {
      logger.error('Error getting primary provider:', error);
      return null;
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(messages, apiKey, model = 'gpt-4', options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'IT-Helpdesk-Bot/1.0'
        },
        body: JSON.stringify({
          model: model || 'gpt-4',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1500,
          top_p: options.top_p || 1
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        provider: 'openai',
        model: model || 'gpt-4',
        content: data.choices?.[0]?.message?.content,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        finishReason: data.choices?.[0]?.finish_reason,
        rawResponse: data
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      return {
        success: false,
        provider: 'openai',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Call Claude API
   */
  async callClaude(messages, apiKey, model = 'claude-3-opus-20240229', options = {}) {
    try {
      // Claude requires system prompt separate from messages
      // Extract system message and filter to only user/assistant messages
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-opus-20240229',
          max_tokens: options.max_tokens || 1500,
          messages: chatMessages,
          system: systemMsg?.content || options.system_prompt || 'You are an expert IT helpdesk assistant.'
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        provider: 'claude',
        model: model || 'claude-3-opus-20240229',
        content: data.content?.[0]?.text,
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        finishReason: data.stop_reason,
        rawResponse: data
      };
    } catch (error) {
      logger.error('Claude API error:', error);
      return {
        success: false,
        provider: 'claude',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Call Google Gemini API
   */
  async callGemini(messages, apiKey, model = 'gemini-2.0-flash', options = {}) {
    try {
      // Extract system instruction if present
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');

      // Convert messages to Google format (Gemini uses 'model' instead of 'assistant')
      const contents = chatMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      const requestBody = {
        contents,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.max_tokens || 1500,
          topP: options.top_p || 1
        }
      };

      // Add system instruction if present
      if (systemMsg?.content) {
        requestBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }

      // Validate model name — must start with 'gemini-' and not be the deprecated 'gemini-pro'
      const VALID_GEMINI = /^gemini-(?!pro$)/;
      const effectiveModel = (model && VALID_GEMINI.test(model)) ? model : 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = errBody.error?.message || `Gemini API error: ${response.status} ${response.statusText}`;
        logger.error('Gemini API HTTP error', { status: response.status, model: effectiveModel, error: errMsg });
        throw new Error(errMsg);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        provider: 'google',
        model: effectiveModel,
        content: data.candidates?.[0]?.content?.parts?.[0]?.text,
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
        finishReason: data.candidates?.[0]?.finishReason,
        rawResponse: data
      };
    } catch (error) {
      logger.error('Gemini API error:', { message: error.message });
      return {
        success: false,
        provider: 'google',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Call xAI Grok API (OpenAI-compatible)
   */
  async callGrok(messages, apiKey, model = 'grok-3-mini', options = {}) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'IT-Helpdesk-Bot/1.0'
        },
        body: JSON.stringify({
          model: model || 'grok-3-mini',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1500,
          top_p: options.top_p || 1
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Grok API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        provider: 'grok',
        model: model || 'grok-3-mini',
        content: data.choices?.[0]?.message?.content,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        finishReason: data.choices?.[0]?.finish_reason,
        rawResponse: data
      };
    } catch (error) {
      logger.error('Grok API error:', error);
      return {
        success: false,
        provider: 'grok',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Call Groq API (api.groq.com — LPU inference, OpenAI-compatible)
   * Keys start with gsk_
   */
  async callGroqApi(messages, apiKey, model = 'llama-3.3-70b-versatile', options = {}) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'IT-Helpdesk-Bot/1.0'
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1500,
          top_p: options.top_p || 1
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Groq API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        provider: 'groq',
        model: model || 'llama-3.3-70b-versatile',
        content: data.choices?.[0]?.message?.content,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        finishReason: data.choices?.[0]?.finish_reason,
        rawResponse: data
      };
    } catch (error) {
      logger.error('Groq API error:', error);
      return {
        success: false,
        provider: 'groq',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Call local Ollama LLM
   */
  async callLocalLLM(messages, endpoint = 'http://localhost:11434/api/chat', model = 'llama3:8b', options = {}) {
    try {
      // Use /api/chat endpoint for multi-turn conversation support
      const chatEndpoint = endpoint.replace(/\/api\/generate\s*$/, '/api/chat');
      
      // Convert messages to Ollama chat format
      const ollamaMessages = messages.map(m => ({
        role: m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user'),
        content: m.content
      }));
      
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            num_predict: options.max_tokens || 1500
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Local LLM error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        provider: 'local',
        model,
        content: data.message?.content || data.response,
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        finishReason: 'stop',
        rawResponse: data
      };
    } catch (error) {
      logger.error('Local LLM error:', error);
      return {
        success: false,
        provider: 'local',
        error: error.message,
        provider_error: true
      };
    }
  }

  /**
   * Main method: Route and call appropriate API
   */
  async callExternalAPI(messages, providerId = null, sessionId = null, userId = null, queryType = 'general', options = {}) {
    try {
      let provider = null;
      let apiKeyRecord = null;
      
      // Get provider to use
      if (providerId) {
        provider = await botApiProviderService.getProviderById(providerId);
      } else {
        provider = await this.getPrimaryProvider();
      }
      
      if (!provider) {
        return {
          success: false,
          error: 'No API providers configured or enabled'
        };
      }
      
      // Get API key
      apiKeyRecord = await botApiProviderService.getActiveApiKey(provider.provider_id);
      if (!apiKeyRecord?.api_key) {
        return {
          success: false,
          error: `No API key configured for ${provider.provider_label}`
        };
      }
      
      // Make the API call
      let result = null;
      const startTime = Date.now();
      
      switch (provider.provider_name) {
        case 'openai':
          result = await this.callOpenAI(
            messages,
            apiKeyRecord.api_key,
            apiKeyRecord.model_name || 'gpt-4',
            options
          );
          break;
        
        case 'claude':
          result = await this.callClaude(
            messages,
            apiKeyRecord.api_key,
            apiKeyRecord.model_name || 'claude-3-opus-20240229',
            options
          );
          break;
        
        case 'google':
          result = await this.callGemini(
            messages,
            apiKeyRecord.api_key,
            apiKeyRecord.model_name || 'gemini-2.0-flash',
            options
          );
          break;
        
        case 'grok':
          result = await this.callGrok(
            messages,
            apiKeyRecord.api_key,
            apiKeyRecord.model_name || 'grok-3-mini',
            options
          );
          break;

        case 'groq':
          result = await this.callGroqApi(
            messages,
            apiKeyRecord.api_key,
            apiKeyRecord.model_name || 'llama-3.3-70b-versatile',
            options
          );
          break;

        case 'local':
          // In Docker, use OLLAMA_BASE_URL (e.g. http://ollama:11434) to reach Ollama container
          const ollamaEndpoint = process.env.OLLAMA_BASE_URL
            ? `${process.env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`
            : (provider.api_endpoint || 'http://localhost:11434/api/chat');
          result = await this.callLocalLLM(
            messages,
            ollamaEndpoint,
            apiKeyRecord.model_name || 'llama3:8b',
            options
          );
          break;
        
        default:
          throw new Error(`Unsupported provider: ${provider.provider_name}`);
      }
      
      const latency = Date.now() - startTime;
      
      // Track usage
      if (result.success) {
        await this.trackApiUsage({
          provider_id: provider.provider_id,
          session_id: sessionId,
          user_id: userId,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens: result.totalTokens,
          model_used: result.model,
          latency_ms: latency,
          status: 'success'
        });
      } else {
        await this.trackApiUsage({
          provider_id: provider.provider_id,
          session_id: sessionId,
          user_id: userId,
          status: result.provider_error ? 'error' : 'rate_limited',
          error_message: result.error,
          latency_ms: latency,
          model_used: apiKeyRecord.model_name
        });
      }
      
      return {
        ...result,
        latency_ms: latency,
        provider_id: provider.provider_id,
        provider_label: provider.provider_label
      };
    } catch (error) {
      logger.error('Error calling external API:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Track API usage
   */
  async trackApiUsage(usage) {
    try {
      await db.executeQuery(`
        INSERT INTO bot_api_usage
        (provider_id, session_id, user_id, prompt_tokens, completion_tokens, 
         total_tokens, model_used, latency_ms, status, error_message)
        VALUES
        (@providerId, @sessionId, @userId, @promptTokens, @completionTokens,
         @totalTokens, @modelUsed, @latencyMs, @status, @errorMsg)
      `, {
        providerId: usage.provider_id,
        sessionId: usage.session_id || null,
        userId: usage.user_id || null,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        modelUsed: usage.model_used,
        latencyMs: usage.latency_ms || 0,
        status: usage.status,
        errorMsg: usage.error_message ? usage.error_message.substring(0, 2000) : null
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error tracking API usage:', error);
      return { success: false };
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(providerId = null, days = 30) {
    try {
      let query = `
        SELECT 
          provider_id,
          COUNT(*) AS call_count,
          SUM(total_tokens) AS total_tokens,
          SUM(prompt_tokens) AS total_prompt_tokens,
          SUM(completion_tokens) AS total_completion_tokens,
          AVG(latency_ms) AS avg_latency_ms,
          MIN(created_at) AS first_call,
          MAX(created_at) AS last_call,
          COUNT(CASE WHEN status = 'error' THEN 1 END) AS error_count
        FROM bot_api_usage
        WHERE created_at > DATEADD(DAY, -@days, GETDATE())
      `;
      
      const params = { days };
      
      if (providerId) {
        query += ` AND provider_id = @providerId`;
        params.providerId = providerId;
      }
      
      query += ` GROUP BY provider_id
                 ORDER BY call_count DESC`;
      
      const result = await db.executeQuery(query, params);
      return result.recordset || [];
    } catch (error) {
      logger.error('Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Fallback mechanism: Try next provider if one fails
   */
  async callWithFallback(messages, sessionId = null, userId = null, options = {}) {
    try {
      const providers = await botApiProviderService.getEnabledProviders();
      
      if (providers.length === 0) {
        return {
          success: false,
          error: 'No providers configured'
        };
      }
      
      let lastError = null;
      
      for (const provider of providers) {
        try {
          const result = await this.callExternalAPI(
            messages,
            provider.provider_id,
            sessionId,
            userId,
            'general',
            options
          );
          
          if (result.success) {
            return result;
          }
          
          lastError = result.error;
          logger.warn(`Provider ${provider.provider_label} failed, trying next...`);
        } catch (error) {
          lastError = error.message;
          logger.warn(`Error with provider ${provider.provider_label}:`, error);
          continue;
        }
      }
      
      return {
        success: false,
        error: lastError || 'All providers failed'
      };
    } catch (error) {
      logger.error('Error in fallback mechanism:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new BotApiIntegrationService();
