// ============================================
// BOT API PROVIDER SERVICE
// Manages external API providers (OpenAI, Claude, Google, etc)
// Encryption/decryption of API keys, provider configuration
// Date: March 4, 2026
// ============================================

const db = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Simple encryption for API keys (in production, use AWS KMS or Azure Key Vault)
const ENCRYPTION_KEY = process.env.BOT_API_KEY_ENCRYPTION || 'bot-api-key-encryption-key-256bit!!';
const ALGORITHM = 'aes-256-cbc';

class BotApiProviderService {
  /**
   * Encrypt API key
   */
  encryptApiKey(apiKey) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Error encrypting API key:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypt API key
   */
  decryptApiKey(encryptedKey) {
    try {
      const parts = encryptedKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
      let decrypted = decipher.update(parts[1], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting API key:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Get all API providers
   */
  async getProviders() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          provider_id,
          provider_name,
          provider_label,
          description,
          api_endpoint,
          is_enabled,
          is_configured,
          rate_limit_rpm,
          rate_limit_tpm,
          timeout_seconds,
          priority,
          capabilities,
          created_at
        FROM bot_api_providers
        ORDER BY provider_name
      `);
      
      return (result.recordset || []).map(p => ({
        ...p,
        capabilities: p.capabilities ? JSON.parse(p.capabilities) : []
      }));
    } catch (error) {
      logger.error('Error fetching API providers:', error);
      throw error;
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          provider_id,
          provider_name,
          provider_label,
          description,
          api_endpoint,
          is_enabled,
          is_configured,
          rate_limit_rpm,
          rate_limit_tpm,
          timeout_seconds,
          priority,
          capabilities
        FROM bot_api_providers
        WHERE provider_id = @providerId
      `, { providerId });
      
      const provider = result.recordset?.[0];
      if (provider) {
        provider.capabilities = provider.capabilities ? JSON.parse(provider.capabilities) : [];
      }
      return provider || null;
    } catch (error) {
      logger.error('Error fetching provider by ID:', error);
      throw error;
    }
  }

  /**
   * Get provider by name
   */
  async getProviderByName(providerName) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          provider_id,
          provider_name,
          provider_label,
          description,
          api_endpoint,
          is_enabled,
          is_configured,
          rate_limit_rpm,
          rate_limit_tpm,
          timeout_seconds,
          priority,
          capabilities
        FROM bot_api_providers
        WHERE provider_name = @providerName
      `, { providerName });
      
      const provider = result.recordset?.[0];
      if (provider) {
        provider.capabilities = provider.capabilities ? JSON.parse(provider.capabilities) : [];
      }
      return provider || null;
    } catch (error) {
      logger.error('Error fetching provider by name:', error);
      throw error;
    }
  }

  /**
   * Get enabled providers only
   */
  async getEnabledProviders() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          provider_id,
          provider_name,
          provider_label,
          is_configured,
          rate_limit_rpm,
          rate_limit_tpm,
          timeout_seconds,
          priority,
          capabilities
        FROM bot_api_providers
        WHERE is_enabled = 1 AND is_configured = 1
        ORDER BY priority DESC, provider_name
      `);
      
      return (result.recordset || []).map(p => ({
        ...p,
        capabilities: p.capabilities ? JSON.parse(p.capabilities) : []
      }));
    } catch (error) {
      logger.error('Error fetching enabled providers:', error);
      throw error;
    }
  }

  /**
   * Set API key for provider
   */
  async setApiKey(providerId, apiKey, modelName, userId) {
    try {
      // Encrypt the API key
      const encryptedKey = this.encryptApiKey(apiKey);
      const last4 = apiKey.slice(-4);
      
      // Insert or update API key
      const result = await db.executeQuery(`
        INSERT INTO bot_api_keys 
        (provider_id, api_key_encrypted, api_key_last4, model_name, created_by, updated_by)
        VALUES 
        (@providerId, @encryptedKey, @last4, @modelName, @userId, @userId)
        
        SELECT key_id, provider_id, api_key_last4, model_name, is_active
        FROM bot_api_keys
        WHERE key_id = SCOPE_IDENTITY()
      `, {
        providerId,
        encryptedKey,
        last4,
        modelName: modelName || null,
        userId
      });
      
      // Update provider to mark as configured
      await db.executeQuery(`
        UPDATE bot_api_providers
        SET is_configured = 1, updated_by = @userId, updated_at = GETDATE()
        WHERE provider_id = @providerId
      `, { providerId, userId });
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error setting API key:', error);
      throw error;
    }
  }

  /**
   * Get active API key for provider
   */
  async getActiveApiKey(providerId) {
    try {
      const result = await db.executeQuery(`
        SELECT 
          key_id,
          provider_id,
          api_key_encrypted,
          model_name,
          is_active
        FROM bot_api_keys
        WHERE provider_id = @providerId AND is_active = 1
        ORDER BY created_at DESC
      `, { providerId });
      
      const keyRecord = result.recordset?.[0];
      if (keyRecord) {
        try {
          keyRecord.api_key = this.decryptApiKey(keyRecord.api_key_encrypted);
          delete keyRecord.api_key_encrypted;
        } catch (e) {
          logger.warn('Failed to decrypt API key for provider:', providerId);
        }
      }
      return keyRecord || null;
    } catch (error) {
      logger.error('Error fetching active API key:', error);
      throw error;
    }
  }

  /**
   * Deactivate old API keys for provider
   */
  async deactivateOldKeys(providerId) {
    try {
      await db.executeQuery(`
        UPDATE bot_api_keys
        SET is_active = 0
        WHERE provider_id = @providerId AND is_active = 1
      `, { providerId });
      
      return { success: true };
    } catch (error) {
      logger.error('Error deactivating old keys:', error);
      throw error;
    }
  }

  /**
   * Update provider configuration
   */
  async updateProvider(providerId, updateData, userId) {
    try {
      let setClause = [];
      const params = { providerId, userId };
      const fields = ['provider_label', 'description', 'api_endpoint', 'is_enabled', 'rate_limit_rpm', 'rate_limit_tpm', 'timeout_seconds', 'priority', 'capabilities'];
      
      fields.forEach(field => {
        if (field in updateData) {
          setClause.push(`${field} = @${field}`);
          params[field] = field === 'capabilities' ? JSON.stringify(updateData[field]) : updateData[field];
        }
      });
      
      if (setClause.length === 0) {
        return await this.getProviderById(providerId);
      }
      
      setClause.push('updated_by = @userId');
      setClause.push('updated_at = GETDATE()');
      
      const result = await db.executeQuery(`
        UPDATE bot_api_providers
        SET ${setClause.join(', ')}
        WHERE provider_id = @providerId
        
        SELECT provider_id, provider_name, provider_label, is_enabled, is_configured
        FROM bot_api_providers
        WHERE provider_id = @providerId
      `, params);
      
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error('Error updating provider:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testApiConnection(providerId) {
    try {
      const provider = await this.getProviderById(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }
      
      // For local/Ollama, no API key is strictly needed
      let apiKey = null;
      if (provider.provider_name !== 'local') {
        apiKey = await this.getActiveApiKey(providerId);
        if (!apiKey?.api_key) {
          throw new Error('No API key configured for this provider');
        }
      }
      
      // Provider-specific connection tests
      let testResult = { success: false, message: '' };
      
      switch (provider.provider_name) {
        case 'openai':
          testResult = await this.testOpenAIConnection(apiKey.api_key, provider);
          break;
        case 'claude':
          testResult = await this.testClaudeConnection(apiKey.api_key, provider);
          break;
        case 'google':
          testResult = await this.testGoogleConnection(apiKey.api_key, provider);
          break;
        case 'grok':
          testResult = await this.testGrokConnection(apiKey.api_key, provider);
          break;
        case 'groq':
          testResult = await this.testGroqConnection(apiKey.api_key, provider);
          break;
        case 'local':
          testResult = await this.testOllamaConnection(provider);
          break;
        default:
          testResult = { success: true, message: 'Provider type not verified yet' };
      }
      
      return testResult;
    } catch (error) {
      logger.error('Error testing API connection:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Test OpenAI connection
   */
  async testOpenAIConnection(apiKey, provider) {
    try {
      const response = await fetch(provider.api_endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        }),
        timeout: provider.timeout_seconds * 1000
      });
      
      if (!response.ok) {
        return { success: false, message: `API returned: ${response.status} ${response.statusText}` };
      }
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Test Claude connection
   */
  async testClaudeConnection(apiKey, provider) {
    try {
      const response = await fetch(provider.api_endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'test' }]
        }),
        timeout: provider.timeout_seconds * 1000
      });
      
      if (!response.ok) {
        return { success: false, message: `API returned: ${response.status}` };
      }
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Test Google connection
   */
  async testGoogleConnection(apiKey, provider) {
    try {
      // Always construct proper URL with model path — DB endpoint may be stale
      const model = 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: AbortSignal.timeout((provider.timeout_seconds || 30) * 1000)
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, message: errData.error?.message || `API returned: ${response.status}` };
      }
      
      return { success: true, message: 'Google Gemini connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Test xAI Grok connection
   */
  async testGrokConnection(apiKey, provider) {
    try {
      const response = await fetch(provider.api_endpoint || 'https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout((provider.timeout_seconds || 30) * 1000)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, message: errData.error?.message || `API returned: ${response.status} ${response.statusText}` };
      }

      return { success: true, message: 'xAI Grok connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Test Groq connection (groq.com — LPU inference, OpenAI-compatible)
   */
  async testGroqConnection(apiKey, provider) {
    try {
      const response = await fetch(provider.api_endpoint || 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout((provider.timeout_seconds || 30) * 1000)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, message: errData.error?.message || `API returned: ${response.status} ${response.statusText}` };
      }

      return { success: true, message: 'Groq connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Test Ollama/Local LLM connection
   */
  async testOllamaConnection(provider) {
    try {
      const baseUrl = (provider.api_endpoint || 'http://localhost:11434/api/generate').replace('/api/generate', '').replace('/api/chat', '');
      
      // Step 1: Check if Ollama is running (GET /api/tags)
      const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!tagsResponse.ok) {
        return { 
          success: false, 
          message: 'Ollama is not responding. Make sure Ollama is installed and running (ollama serve)' 
        };
      }
      
      const tagsData = await tagsResponse.json();
      const models = tagsData.models || [];
      const modelNames = models.map(m => m.name || m.model).filter(Boolean);
      
      if (modelNames.length === 0) {
        return {
          success: true,
          message: 'Ollama is running but no models installed. Run: ollama pull mistral (or llama3, codellama)',
          models: [],
          ollamaRunning: true
        };
      }
      
      // Step 2: Quick test with first available model
      const testModel = modelNames[0];
      const testResponse = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: testModel, prompt: 'Hi', stream: false, options: { num_predict: 5 } }),
        signal: AbortSignal.timeout(15000)
      });
      
      if (!testResponse.ok) {
        return {
          success: false,
          message: `Ollama running but model test failed (${testResponse.status})`,
          models: modelNames,
          ollamaRunning: true
        };
      }
      
      return {
        success: true,
        message: `Ollama connected! ${modelNames.length} model(s) available: ${modelNames.join(', ')}`,
        models: modelNames,
        ollamaRunning: true
      };
    } catch (error) {
      if (error.name === 'TimeoutError' || error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Cannot connect to Ollama. Make sure it is running: ollama serve',
          ollamaRunning: false
        };
      }
      return { success: false, message: `Connection failed: ${error.message}`, ollamaRunning: false };
    }
  }

  /**
   * Auto-detect Ollama and available models
   */
  async detectOllama() {
    try {
      const provider = await this.getProviderByName('local');
      const defaultBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const baseUrl = (provider?.api_endpoint || defaultBase + '/api/generate').replace('/api/generate', '').replace('/api/chat', '');
      
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) {
        return { running: false, models: [] };
      }
      
      const data = await response.json();
      const models = (data.models || []).map(m => ({
        name: m.name || m.model,
        size: m.size ? (m.size / 1e9).toFixed(1) + ' GB' : 'Unknown',
        modified: m.modified_at
      }));
      
      return { running: true, models, baseUrl };
    } catch {
      return { running: false, models: [] };
    }
  }

  /**
   * Get provider stats (usage, cost, etc)
   */
  async getProviderStats(providerId, days = 30) {
    try {
      const result = await db.executeQuery(`
        SELECT TOP 1
          provider_id,
          total_calls,
          total_tokens_used,
          total_cost,
          avg_latency_ms,
          last_used,
          error_count,
          rate_limited_count
        FROM v_bot_api_provider_stats
        WHERE provider_id = @providerId
      `, { providerId });
      
      return result.recordset?.[0] || {
        total_calls: 0,
        total_tokens_used: 0,
        total_cost: 0,
        avg_latency_ms: 0,
        error_count: 0
      };
    } catch (error) {
      logger.error('Error fetching provider stats:', error);
      throw error;
    }
  }

  /**
   * Get all provider stats
   */
  async getAllProviderStats() {
    try {
      const result = await db.executeQuery(`
        SELECT 
          provider_id,
          provider_name,
          provider_label,
          is_enabled,
          total_calls,
          total_tokens_used,
          total_cost,
          avg_latency_ms,
          last_used,
          error_count,
          rate_limited_count
        FROM v_bot_api_provider_stats
        ORDER BY total_calls DESC
      `);
      
      return result.recordset || [];
    } catch (error) {
      logger.error('Error fetching all provider stats:', error);
      throw error;
    }
  }
}

module.exports = new BotApiProviderService();
