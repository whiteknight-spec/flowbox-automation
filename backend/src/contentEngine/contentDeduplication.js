/**
 * Generic Content Deduplication & Content History Module
 *
 * Provides a topic-agnostic, language-independent persistent deduplication layer.
 * Tracks previously accepted content by:
 * - workflow_id
 * - topic
 * - language
 * - content identity / fingerprint
 * - created_at
 *
 * Survives server restarts via SQLite table `quote_content_history`.
 */

const crypto = require('crypto');
const db = require('../db');

const DEFAULT_CONTENT_DEDUP_WINDOW = 20;

// In-memory fallback / cache for standalone tests and fast local checks
const memoryContentHistory = [];

/**
 * Normalizes content text for robust, semantic deduplication.
 * - Unicode NFKC normalization
 * - Collapses repeated whitespace
 * - Strips enclosing quotes
 * - Strips harmless punctuation differences (. , ! ? ; : etc.)
 * - Trims whitespace and lowercases
 * Safe for Tamil: preserves all Tamil letters, vowels, and signs.
 *
 * @param {string} text - Raw text to normalize
 * @returns {string} Normalized text
 */
function normalizeContentText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .replace(/^["'“‘«\s]+|["'”’»\s]+$/g, '') // strip enclosing quotes/spaces
    .replace(/[\n\r\t]+/g, ' ')               // convert line breaks/tabs to spaces
    .replace(/\s+/g, ' ')                     // collapse repeated spaces
    .replace(/[.,!?;:…—–-]+$/g, '')           // strip trailing punctuation
    .trim()
    .toLowerCase();
}

/**
 * Computes a deterministic fingerprint for content.
 *
 * @param {Object|string} candidate - Content object or raw quote string
 * @returns {string} Normalized fingerprint
 */
function computeContentFingerprint(candidate) {
  if (!candidate) return '';
  let rawText = '';
  if (typeof candidate === 'string') {
    rawText = candidate;
  } else if (typeof candidate === 'object') {
    // If it's a structured item with itemIdentity or kuralNumber
    if (candidate.kuralNumber) {
      return `kural:${candidate.kuralNumber}`;
    }
    rawText = candidate.quote || candidate.title || '';
  }
  const normalized = normalizeContentText(rawText);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Resolves the configured deduplication window size.
 *
 * @param {Object} [config={}] - Workflow node configuration
 * @param {Object} [options={}] - Execution options
 * @returns {number} Window size (positive integer)
 */
function resolveDedupWindow(config = {}, options = {}) {
  const custom = options.dedupWindow ?? config.dedupWindow ?? config.contentDedupWindow ?? process.env.CONTENT_DEDUP_WINDOW;
  const parsed = parseInt(custom, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONTENT_DEDUP_WINDOW;
}

/**
 * Records an accepted quote content candidate into persistent history.
 *
 * @param {string} workflowId - Target workflow ID
 * @param {Object} params
 * @param {string} params.topic - Topic ID
 * @param {string} params.language - Language code ('ta' | 'en')
 * @param {Object|string} params.content - Accepted content object
 * @param {string} [params.jobId] - Associated quote_video_jobs ID
 * @returns {Object} Created history record
 */
function recordAcceptedContent(workflowId, {
  topic,
  language,
  content,
  jobId = null,
} = {}) {
  if (!topic || !content) return null;

  const id = crypto.randomUUID();
  const normalizedTopic = String(topic).toLowerCase().trim();
  const normalizedLanguage = String(language || 'ta').toLowerCase().trim();
  const fingerprint = computeContentFingerprint(content);
  const itemIdentity = (typeof content === 'object' && content?.kuralNumber)
    ? `kural:${content.kuralNumber}`
    : (content?.itemIdentity || null);
  const quotePreview = String(typeof content === 'object' ? (content.quote || content.title || '') : content).slice(0, 100);
  const now = new Date().toISOString();

  const record = {
    id,
    workflowId: workflowId || 'local',
    topic: normalizedTopic,
    language: normalizedLanguage,
    fingerprint,
    itemIdentity,
    quotePreview,
    jobId,
    createdAt: now,
  };

  // Add to in-memory store
  memoryContentHistory.unshift(record);
  if (memoryContentHistory.length > 500) {
    memoryContentHistory.pop();
  }

  // Persist to SQLite if workflowId exists in workflows table
  if (workflowId) {
    try {
      const wfExists = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflowId);
      if (wfExists) {
        db.prepare(`
          INSERT INTO quote_content_history (
            id, workflow_id, topic, language, fingerprint, item_identity, quote_preview, job_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          id,
          workflowId,
          normalizedTopic,
          normalizedLanguage,
          fingerprint,
          itemIdentity,
          quotePreview,
          jobId
        );
      }
    } catch (err) {
      console.error('[recordAcceptedContent] SQLite insert error:', err.message);
    }
  }

  return record;
}

/**
 * Retrieves recent content history for a workflow, topic, and optional language.
 *
 * @param {string} workflowId - Target workflow ID
 * @param {Object} params
 * @param {string} params.topic - Topic ID
 * @param {string} [params.language] - Optional language filter ('ta' | 'en')
 * @param {number} [params.limit=20] - Maximum history items to retrieve
 * @returns {Array<Object>} List of history items
 */
function getRecentContentHistory(workflowId, {
  topic,
  language = null,
  limit = DEFAULT_CONTENT_DEDUP_WINDOW,
} = {}) {
  const normalizedTopic = String(topic || '').toLowerCase().trim();
  const normalizedLanguage = language ? String(language).toLowerCase().trim() : null;
  const history = [];
  const seenFp = new Set();

  if (workflowId) {
    try {
      let rows = [];
      if (normalizedLanguage) {
        rows = db.prepare(`
          SELECT fingerprint, item_identity, topic, language, created_at
          FROM quote_content_history
          WHERE workflow_id = ? AND topic = ? AND language = ?
          ORDER BY created_at DESC, rowid DESC
          LIMIT ?
        `).all(workflowId, normalizedTopic, normalizedLanguage, limit);
      } else {
        rows = db.prepare(`
          SELECT fingerprint, item_identity, topic, language, created_at
          FROM quote_content_history
          WHERE workflow_id = ? AND topic = ?
          ORDER BY created_at DESC, rowid DESC
          LIMIT ?
        `).all(workflowId, normalizedTopic, limit);
      }

      for (const r of rows) {
        const key = `${r.topic}:${r.language}:${r.fingerprint}`;
        if (!seenFp.has(key)) {
          seenFp.add(key);
          history.push({
            fingerprint: r.fingerprint,
            itemIdentity: r.item_identity,
            topic: r.topic,
            language: r.language,
            createdAt: r.created_at,
          });
        }
      }

      // Fallback: If history table had fewer items, also inspect existing quote_video_jobs
      if (history.length < limit) {
        const jobQuery = normalizedLanguage
          ? db.prepare(`
              SELECT quote, spec, topic, language, created_at
              FROM quote_video_jobs
              WHERE workflow_id = ? AND topic = ? AND language = ?
              ORDER BY created_at DESC, rowid DESC
              LIMIT ?
            `).all(workflowId, normalizedTopic, normalizedLanguage, limit - history.length)
          : db.prepare(`
              SELECT quote, spec, topic, language, created_at
              FROM quote_video_jobs
              WHERE workflow_id = ? AND topic = ?
              ORDER BY created_at DESC, rowid DESC
              LIMIT ?
            `).all(workflowId, normalizedTopic, limit - history.length);

        for (const j of jobQuery) {
          let kuralNumber = null;
          try {
            const parsedSpec = JSON.parse(j.spec || '{}');
            kuralNumber = parsedSpec.content?.kuralNumber || null;
          } catch (_) {}

          const fp = kuralNumber ? `kural:${kuralNumber}` : computeContentFingerprint(j.quote);
          const key = `${j.topic}:${j.language}:${fp}`;
          if (!seenFp.has(key)) {
            seenFp.add(key);
            history.push({
              fingerprint: fp,
              itemIdentity: kuralNumber ? `kural:${kuralNumber}` : null,
              topic: j.topic,
              language: j.language,
              createdAt: j.created_at,
            });
          }
        }
      }
    } catch (err) {
      console.error('[getRecentContentHistory] SQLite query error:', err.message);
    }
  }

  // Merge in-memory history matching workflowId and topic
  for (const m of memoryContentHistory) {
    if (m.workflowId === (workflowId || 'local') && m.topic === normalizedTopic) {
      if (!normalizedLanguage || m.language === normalizedLanguage) {
        const key = `${m.topic}:${m.language}:${m.fingerprint}`;
        if (!seenFp.has(key)) {
          seenFp.add(key);
          history.push({
            fingerprint: m.fingerprint,
            itemIdentity: m.itemIdentity,
            topic: m.topic,
            language: m.language,
            createdAt: m.createdAt,
          });
        }
      }
    }
  }

  return history.slice(0, limit);
}

/**
 * Checks whether a candidate content is a duplicate within the recent history window.
 *
 * @param {Object|string} candidate - Content object or quote string
 * @param {Object} params
 * @param {string} params.workflowId - Workflow ID
 * @param {string} params.topic - Topic ID
 * @param {string} params.language - Language code ('ta' | 'en')
 * @param {number} [params.window=20] - Configured deduplication window
 * @param {number} [params.poolSize=null] - Total available items in source pool (for window adaptation)
 * @param {Array<Object>} [params.recentHistory=null] - Pre-fetched recent history
 * @returns {boolean} True if duplicate, false if unique
 */
function isContentDuplicate(candidate, {
  workflowId,
  topic,
  language,
  window = DEFAULT_CONTENT_DEDUP_WINDOW,
  poolSize = null,
  recentHistory = null,
} = {}) {
  if (!candidate) return false;

  const candidateFp = computeContentFingerprint(candidate);
  const candidateIdentity = (typeof candidate === 'object' && candidate?.kuralNumber)
    ? `kural:${candidate.kuralNumber}`
    : (candidate?.itemIdentity || null);

  // Gracefully adapt window if total pool size is smaller than window
  // E.g., if pool has 4 items, effective window is at most 3 so at least 1 item is always fresh.
  let effectiveWindow = window;
  if (poolSize !== null && typeof poolSize === 'number' && poolSize > 1) {
    effectiveWindow = Math.min(window, poolSize - 1);
  }

  // 1. Check item-identity across the topic (e.g. Thirukkural: prevent same Kural repeating regardless of language)
  if (candidateIdentity) {
    const topicHistory = getRecentContentHistory(workflowId, {
      topic,
      limit: effectiveWindow,
    });
    const topicWindow = topicHistory.slice(0, effectiveWindow);
    const matchesIdentity = topicWindow.some((h) => h.itemIdentity === candidateIdentity || h.fingerprint === candidateIdentity);
    if (matchesIdentity) {
      return true;
    }
  }

  // 2. Check fingerprint within topic + language history
  const langHistory = getRecentContentHistory(workflowId, {
    topic,
    language,
    limit: effectiveWindow,
  });

  const langWindow = langHistory.slice(0, effectiveWindow);
  return langWindow.some((h) => h.fingerprint === candidateFp);
}

/**
 * Clears content history for a workflow (useful in test isolation).
 *
 * @param {string} workflowId - Target workflow ID
 * @param {string} [topic=null] - Optional topic filter
 */
function clearContentHistory(workflowId, topic = null) {
  if (workflowId) {
    try {
      if (topic) {
        db.prepare('DELETE FROM quote_content_history WHERE workflow_id = ? AND topic = ?').run(workflowId, topic);
      } else {
        db.prepare('DELETE FROM quote_content_history WHERE workflow_id = ?').run(workflowId);
      }
    } catch (_) {}
  }

  for (let i = memoryContentHistory.length - 1; i >= 0; i--) {
    const m = memoryContentHistory[i];
    if (m.workflowId === (workflowId || 'local')) {
      if (!topic || m.topic === topic) {
        memoryContentHistory.splice(i, 1);
      }
    }
  }
}

module.exports = {
  normalizeContentText,
  computeContentFingerprint,
  resolveDedupWindow,
  recordAcceptedContent,
  getRecentContentHistory,
  isContentDuplicate,
  clearContentHistory,
  DEFAULT_CONTENT_DEDUP_WINDOW,
};
