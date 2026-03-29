// ============================================================
// DUPLICATE DETECTION SERVICE
// Finds similar open tickets to prevent duplicate submissions.
// Uses keyword overlap scoring — no ML required.
// ============================================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// Stop words to exclude from keyword matching
const STOP_WORDS = new Set([
  'a','an','the','is','it','in','on','at','to','for','of','and','or','but',
  'not','with','from','this','that','my','i','we','you','he','she','they',
  'have','has','had','be','been','was','were','are','will','would','can',
  'could','should','do','did','does','please','help','issue','problem','need',
  'getting','getting','also','after','when','where','why','how','what'
]);

// Minimum score (0-1) to consider a potential duplicate
const MIN_SIMILARITY_SCORE = 0.3;
// Maximum number of similar tickets to return
const MAX_RESULTS = 5;

/**
 * Extract keywords from text for matching.
 * Lowercases, strips punctuation, removes stop words, de-dupes.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractKeywords(text) {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Jaccard similarity between two keyword sets.
 * Returns 0.0 – 1.0
 */
function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find similar OPEN tickets for a given subject + description.
 * Called BEFORE creating a ticket to surface potential duplicates.
 *
 * @param {object} opts
 * @param {string}  opts.subject       - New ticket subject
 * @param {string}  [opts.description] - New ticket description
 * @param {number}  [opts.categoryId]  - Optional: narrow to same category
 * @param {number}  [opts.requesterId] - Optional: same requester context
 * @param {number}  [opts.excludeId]   - Optional: exclude a specific ticket ID
 * @returns {Promise<Array>} Array of { ticket_id, ticket_number, subject, status_name, similarity }
 */
async function findSimilarTickets({ subject, description = '', categoryId = null, requesterId = null, excludeId = null }) {
  try {
    if (!subject?.trim()) return [];

    const subjectKw = extractKeywords(subject);
    const descKw    = extractKeywords(description);
    // Combined keyword set — subject words get counted twice via weighted scoring
    const allKw = new Set([...subjectKw, ...descKw]);

    // Fetch candidates: open/in-progress tickets, same category if specified
    // Limit candidate pool to recent 500 tickets to keep this fast
    const params = { limit: 500 };
    let whereClause = `ts.is_final_status = 0`;

    if (categoryId) {
      whereClause += ` AND t.category_id = @catId`;
      params.catId = categoryId;
    }
    if (excludeId) {
      whereClause += ` AND t.ticket_id <> @excludeId`;
      params.excludeId = excludeId;
    }

    const result = await executeQuery(`
      SELECT TOP (@limit)
        t.ticket_id, t.ticket_number, t.subject, t.description,
        t.created_at, t.requester_id,
        ts.status_name, ts.status_code,
        tc.category_name,
        ISNULL(req.first_name,'') + ' ' + ISNULL(req.last_name,'') AS requester_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN users req ON t.requester_id = req.user_id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
    `, params);

    const candidates = result.recordset || [];
    const scored = [];

    for (const candidate of candidates) {
      const candSubjectKw = extractKeywords(candidate.subject);
      const candDescKw    = extractKeywords(candidate.description);

      // Subject similarity is weighted 70%, description similarity 30%
      const subjectScore = jaccardSimilarity(subjectKw, candSubjectKw);
      const descScore    = jaccardSimilarity(descKw, candDescKw);
      const combined     = (subjectScore * 0.7) + (descScore * 0.3);

      // Boost: same requester gets a small bonus
      const sameRequester = requesterId && candidate.requester_id === requesterId ? 0.05 : 0;
      const finalScore = Math.min(combined + sameRequester, 1.0);

      if (finalScore >= MIN_SIMILARITY_SCORE) {
        scored.push({
          ticket_id:      candidate.ticket_id,
          ticket_number:  candidate.ticket_number,
          subject:        candidate.subject,
          status_name:    candidate.status_name,
          status_code:    candidate.status_code,
          category_name:  candidate.category_name,
          requester_name: candidate.requester_name,
          created_at:     candidate.created_at,
          similarity:     Math.round(finalScore * 100) // percentage
        });
      }
    }

    // Sort by similarity descending, return top N
    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, MAX_RESULTS);

    if (top.length > 0) {
      logger.info('Duplicate detection found similar tickets', {
        subject: subject.substring(0, 60),
        matches: top.length,
        topScore: top[0].similarity
      });
    }

    return top;
  } catch (err) {
    logger.error('Duplicate detection failed', err);
    return []; // non-blocking — always return []
  }
}

module.exports = { findSimilarTickets };
