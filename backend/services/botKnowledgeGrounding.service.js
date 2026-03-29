const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { KNOWLEDGE_BASE } = require('./ai-engine.service');
const botTrainingService = require('./botTrainingService');

const HELP_CONTENT_PATH = path.resolve(__dirname, '../../frontend/src/data/helpContent.js');
const MIN_GROUNDED_SCORE = 2.8;
const IGNORED_QUERY_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'when', 'where', 'which', 'while',
  'your', 'have', 'just', 'from', 'into', 'onto', 'about', 'need', 'help', 'issue',
  'problem', 'working', 'again', 'keep', 'keeps', 'still', 'very', 'really', 'not',
]);
const TOKEN_SYNONYMS = {
  wifi: 'network',
  'wi-fi': 'network',
  internet: 'network',
  connectivity: 'network',
  disconnecting: 'disconnect',
  disconnected: 'disconnect',
  disconnects: 'disconnect',
  crashing: 'crash',
  crashes: 'crash',
  passwords: 'password',
};

class BotKnowledgeGroundingService {
  constructor() {
    this._cache = null;
    this._cacheMtimeMs = 0;
  }

  getKnowledgeBase() {
    if (fs.existsSync(HELP_CONTENT_PATH)) {
      const stat = fs.statSync(HELP_CONTENT_PATH);
      if (this._cache && this._cacheMtimeMs === stat.mtimeMs) {
        return this._cache;
      }

      const source = fs.readFileSync(HELP_CONTENT_PATH, 'utf8');
      const sandbox = { globalThis: {} };
      const transformed = source
        .replace(/export\s+const\s+helpContent\s*=\s*/, 'globalThis.helpContent = ')
        .replace(/export\s+default\s+helpContent\s*;?/g, '');
      vm.runInNewContext(transformed, sandbox, { timeout: 1000, filename: HELP_CONTENT_PATH });

      const helpContent = sandbox.globalThis.helpContent;
      const categories = new Map((helpContent?.categories || []).map((category) => [category.id, category]));
      const articles = (helpContent?.articles || []).map((article) => this._normalizeArticle(article, categories, 'Help Center'));

      this._cache = { articles, categories, sourceLabel: 'Help Center' };
      this._cacheMtimeMs = stat.mtimeMs;
      return this._cache;
    }

    if (this._cache && this._cacheMtimeMs === -1) {
      return this._cache;
    }

    const categories = new Map();
    const articles = (KNOWLEDGE_BASE || []).map((entry) => this._normalizeFallbackEntry(entry));
    this._cache = { articles, categories, sourceLabel: 'Knowledge Base' };
    this._cacheMtimeMs = -1;
    return this._cache;
  }

  searchArticles(query, options = {}) {
    const { limit = 3, minScore = MIN_GROUNDED_SCORE } = options;
    const normalizedQuery = this._normalizeText(query);
    const queryTokens = this._tokenize(normalizedQuery);

    if (!normalizedQuery || queryTokens.length === 0) {
      return [];
    }

    const { articles } = this.getKnowledgeBase();

    return articles
      .map((article) => this._scoreArticle(article, normalizedQuery, queryTokens))
      .filter((match) => match.score >= minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((match, index) => ({
        ...match,
        rank: index + 1,
        confidence: Number(Math.min(0.96, 0.55 + (match.score / 10)).toFixed(2)),
      }));
  }

  async getGroundedAnswer(query, options = {}) {
    const articleMatches = this.searchArticles(query, options);
    const trainingMatches = await this.searchTrainingMatches(query, options);
    const matches = [...articleMatches, ...trainingMatches]
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit || 3);

    if (matches.length === 0) {
      return null;
    }

    const primary = matches[0];
    const alternatives = matches.slice(1, 3);
    return {
      primary,
      alternatives,
      answer: this._buildGroundedAnswer(primary, alternatives),
      followUp: this._buildFollowUp(primary, alternatives),
      sources: matches.map((match) => ({
        articleId: match.articleId,
        title: match.title,
        category: match.category,
        helpCenterPath: '/help-center',
        sourceType: match.sourceType || 'article',
        score: Number(match.score.toFixed(2)),
      })),
    };
  }

  async searchTrainingMatches(query, options = {}) {
    const { limit = 2 } = options;

    try {
      const matches = await botTrainingService.searchTrainingData(query, limit);
      return (matches || []).map((match, index) => ({
        articleId: `training-${match.training_id}`,
        title: match.source_ticket_number
          ? `Resolved Ticket ${match.source_ticket_number}`
          : 'Resolved Ticket Knowledge',
        category: match.category || 'general',
        categoryTitle: this._prettifyTitle(match.category || 'general'),
        description: match.question_pattern || '',
        tags: [],
        relatedArticles: [],
        helpCenterPath: '/help-center',
        sourceLabel: 'Resolved Ticket Knowledge',
        sourceType: 'training',
        digest: match.resolution_text || '',
        plainContent: match.resolution_text || '',
        normalizedTitle: this._normalizeText(match.question_pattern || ''),
        normalizedDescription: this._normalizeText(match.question_pattern || ''),
        normalizedTags: [],
        normalizedContent: this._normalizeText(match.resolution_text || ''),
        trainingId: match.training_id,
        sourceTicketNumber: match.source_ticket_number || null,
        confidence: Number(Math.min(0.97, (match.confidence_score || 0.7) + 0.12).toFixed(2)),
        score: Number((((match.confidence_score || 0.7) * 10) + (match.relevance_score || 0)).toFixed(2)),
        rank: index + 1,
        matchedTokens: this._tokenize(query),
        snippet: this._buildSnippet(match.resolution_text || '', this._tokenize(query)),
      }));
    } catch {
      return [];
    }
  }

  _normalizeArticle(article, categories, sourceLabel) {
    const categoryMeta = categories.get(article.category) || {};
    const plainContent = this._stripMarkdown(article.content || '');
    const digest = plainContent.split(/\n+/).filter(Boolean).slice(0, 6).join(' ');

    return {
      articleId: article.id,
      title: article.title || article.id,
      category: article.category || 'general',
      categoryTitle: categoryMeta.title || article.category || 'General',
      description: article.description || '',
      tags: Array.isArray(article.tags) ? article.tags : [],
      relatedArticles: Array.isArray(article.relatedArticles) ? article.relatedArticles : [],
      helpCenterPath: '/help-center',
      sourceLabel,
      digest,
      plainContent,
      normalizedTitle: this._normalizeText(article.title || ''),
      normalizedDescription: this._normalizeText(article.description || ''),
      normalizedTags: (Array.isArray(article.tags) ? article.tags : []).map((tag) => this._normalizeText(tag)),
      normalizedContent: this._normalizeText(plainContent),
    };
  }

  _normalizeFallbackEntry(entry) {
    const plainContent = this._stripMarkdown(entry.answer || '');
    const firstLine = plainContent.split(/\n+/).find(Boolean) || entry.id;
    return {
      articleId: entry.id,
      title: this._prettifyTitle(firstLine),
      category: entry.category || 'general',
      categoryTitle: this._prettifyTitle(entry.category || 'general'),
      description: entry.patterns?.[0] || '',
      tags: Array.isArray(entry.keywords) ? entry.keywords : [],
      relatedArticles: [],
      helpCenterPath: '/help-center',
      sourceLabel: 'Knowledge Base',
      digest: plainContent.split(/\n+/).filter(Boolean).slice(0, 6).join(' '),
      plainContent,
      normalizedTitle: this._normalizeText(firstLine),
      normalizedDescription: this._normalizeText(entry.patterns?.join(' ') || ''),
      normalizedTags: (Array.isArray(entry.keywords) ? entry.keywords : []).map((tag) => this._normalizeText(tag)),
      normalizedContent: this._normalizeText(plainContent),
    };
  }

  _scoreArticle(article, normalizedQuery, queryTokens) {
    const queryPhrase = normalizedQuery.trim();
    const uniqueTokens = [...new Set(queryTokens)];
    let score = 0;
    let matchedTokens = 0;

    for (const token of uniqueTokens) {
      let tokenMatched = false;

      if (article.normalizedTitle.includes(token)) {
        score += 2.4;
        tokenMatched = true;
      }
      if (article.normalizedTags.some((tag) => tag.includes(token))) {
        score += 1.9;
        tokenMatched = true;
      }
      if (article.normalizedDescription.includes(token)) {
        score += 1.1;
        tokenMatched = true;
      }
      if (article.normalizedContent.includes(token)) {
        score += 0.45;
        tokenMatched = true;
      }
      if (article.category.includes(token)) {
        score += 0.9;
        tokenMatched = true;
      }

      if (tokenMatched) {
        matchedTokens += 1;
      }
    }

    if (queryPhrase.length >= 6) {
      if (article.normalizedTitle.includes(queryPhrase)) score += 3.2;
      if (article.normalizedDescription.includes(queryPhrase)) score += 1.8;
      if (article.normalizedContent.includes(queryPhrase)) score += 1.5;
    }

    if (matchedTokens === uniqueTokens.length && uniqueTokens.length > 1) {
      score += 1.2;
    }

    if (matchedTokens === 0) {
      return { ...article, score: 0, snippet: '', matchedTokens: [] };
    }

    const matched = uniqueTokens.filter((token) =>
      article.normalizedTitle.includes(token)
      || article.normalizedDescription.includes(token)
      || article.normalizedContent.includes(token)
      || article.normalizedTags.some((tag) => tag.includes(token))
    );

    return {
      ...article,
      score,
      matchedTokens: matched,
      snippet: this._buildSnippet(article.plainContent, matched),
    };
  }

  _buildGroundedAnswer(primary, alternatives) {
    const lines = [];
    if (primary.sourceType === 'training') {
      lines.push(`Based on a resolved support ticket: **${primary.title}**`);
    } else if (primary.sourceLabel === 'Help Center') {
      lines.push(`Here's a relevant guide from our Help Center: **${primary.title}**`);
    } else {
      lines.push(`Here's what I found in the Knowledge Base: **${primary.title}**`);
    }
    lines.push('');
    if (primary.snippet) {
      lines.push(primary.snippet);
      lines.push('');
    }
    lines.push(`**Source:** ${primary.sourceLabel} → ${primary.categoryTitle} → ${primary.title}`);
    if (primary.sourceType === 'training' && primary.sourceTicketNumber) {
      lines.push(`**Resolved ticket:** ${primary.sourceTicketNumber}`);
    }
    if (primary.sourceLabel === 'Help Center') {
      lines.push(`**Open in app:** Help Center → search for "${primary.title}"`);
    }

    if (alternatives.length > 0) {
      lines.push('');
      lines.push('**Related articles:**');
      for (const alternative of alternatives) {
        lines.push(`• ${alternative.title}`);
      }
    }

    return lines.join('\n');
  }

  _buildFollowUp(primary, alternatives) {
    const followUp = [];
    if (primary.sourceType === 'training' && primary.sourceTicketNumber) {
      followUp.push(`Related fix: ${primary.sourceTicketNumber}`);
    } else {
      followUp.push(primary.sourceLabel === 'Help Center' ? `Open Help Center: ${primary.title}` : `Review guide: ${primary.title}`);
    }
    if (alternatives[0]) {
      followUp.push(alternatives[0].sourceType === 'training' ? `Related fix: ${alternatives[0].title}` : `Related article: ${alternatives[0].title}`);
    }
    followUp.push('Create a ticket');
    return followUp.slice(0, 3);
  }

  _buildSnippet(content, matchedTokens) {
    if (!content) return '';

    const normalizedTokens = matchedTokens.filter(Boolean);
    const paragraphs = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const candidate = paragraphs.find((line) => normalizedTokens.some((token) => this._normalizeText(line).includes(token))) || paragraphs[0] || '';
    return candidate.length > 420 ? `${candidate.slice(0, 417).trim()}...` : candidate;
  }

  _stripMarkdown(value) {
    return String(value || '')
      .replace(/^#+\s+/gm, '')
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^[-•]\s+/gm, '')
      .replace(/\r/g, '')
      .trim();
  }

  _normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _tokenize(value) {
    const tokens = this._normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2)
      .filter((token) => !IGNORED_QUERY_TOKENS.has(token));

    const expanded = [];
    for (const token of tokens) {
      expanded.push(token);
      if (TOKEN_SYNONYMS[token] && TOKEN_SYNONYMS[token] !== token) {
        expanded.push(TOKEN_SYNONYMS[token]);
      }
    }

    return expanded;
  }

  _prettifyTitle(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

module.exports = new BotKnowledgeGroundingService();
module.exports.MIN_GROUNDED_SCORE = MIN_GROUNDED_SCORE;