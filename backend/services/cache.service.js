// ============================================
// CACHE SERVICE - In-memory cache for lookups & profiles
// Uses node-cache - no extra infrastructure required
// ============================================

const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Lookup cache: 30 min TTL (categories, priorities, statuses, roles, departments, locations, processes)
const LOOKUP_TTL = 30 * 60;
// Sub-categories: 15 min (can change per category)
const SUBCAT_TTL = 15 * 60;
// Auth/me profile: 2 min
const AUTH_ME_TTL = 2 * 60;

const lookupCache = new NodeCache({
  stdTTL: LOOKUP_TTL,
  checkperiod: 60,
  useClones: true,
});

const authCache = new NodeCache({
  stdTTL: AUTH_ME_TTL,
  checkperiod: 30,
  useClones: true,
});

// Cache key constants
const KEYS = {
  CATEGORIES: 'lookup:categories',
  PRIORITIES: 'lookup:priorities',
  STATUSES: 'lookup:statuses',
  ROLES: 'lookup:roles',
  DEPARTMENTS: 'lookup:departments',
  LOCATIONS: 'lookup:locations',
  PROCESSES: 'lookup:processes',
  SUBCATEGORIES: (catId) => `lookup:subcat:${catId}`,
  SUBCAT_FIELDS: (subCatId) => `lookup:subcatfields:${subCatId}`,
  AUTH_ME: (userId) => `auth:me:${userId}`,
};

/**
 * Get from lookup cache or fetch and cache
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function that returns data to cache
 * @param {number} [ttl] - Optional TTL in seconds (overrides default)
 * @returns {Promise<any>}
 */
const getOrSet = async (key, fetchFn, ttl) => {
  const cached = lookupCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const data = await fetchFn();
  lookupCache.set(key, data, ttl || LOOKUP_TTL);
  return data;
};

/**
 * Get from auth cache or fetch and cache (does not cache null/undefined)
 */
const getOrSetAuth = async (key, fetchFn) => {
  const cached = authCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const data = await fetchFn();
  if (data != null) {
    authCache.set(key, data, AUTH_ME_TTL);
  }
  return data;
};

/**
 * Invalidate lookup cache (all lookups or specific key)
 */
const invalidateLookup = (key) => {
  if (key) {
    lookupCache.del(key);
    logger.info('Cache invalidated', { key });
  } else {
    lookupCache.flushAll();
    logger.info('Lookup cache flushed');
  }
};

/**
 * Invalidate all lookups (call when admin updates categories, priorities, etc.)
 */
const invalidateAllLookups = () => {
  lookupCache.flushAll();
  logger.info('All lookup caches invalidated');
};

/**
 * Invalidate auth/me for a user (call on profile/role update)
 */
const invalidateAuthMe = (userId) => {
  if (userId) {
    authCache.del(KEYS.AUTH_ME(userId));
    logger.info('Auth cache invalidated', { userId });
  }
};

/**
 * Invalidate sub-category cache when sub-category or fields change
 */
const invalidateSubCategories = (categoryId) => {
  if (categoryId) {
    lookupCache.del(KEYS.SUBCATEGORIES(categoryId));
  } else {
    const keys = lookupCache.keys().filter((k) => k.startsWith('lookup:subcat:'));
    keys.forEach((k) => lookupCache.del(k));
  }
  logger.info('Sub-category cache invalidated', { categoryId });
};

/**
 * Get cache stats (for debugging/admin)
 */
const getStats = () => {
  return {
    lookup: lookupCache.getStats(),
    auth: authCache.getStats(),
  };
};

module.exports = {
  KEYS,
  getOrSet,
  getOrSetAuth,
  invalidateLookup,
  invalidateAllLookups,
  invalidateAuthMe,
  invalidateSubCategories,
  getStats,
  lookupCache,
  authCache,
};
