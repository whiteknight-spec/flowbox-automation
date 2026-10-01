/**
 * Language Rotation Module
 * Deterministically determines the language for the next quote video.
 *
 * For languageConfig === 'alternate':
 * Day 1 -> Tamil (ta)
 * Day 2 -> English (en)
 * Day 3 -> Tamil (ta)
 * Day 4 -> English (en)
 * ...
 */

const SUPPORTED_LANGUAGES = {
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
};

const DEFAULT_TOPIC_INITIAL_LANGUAGES = {
  motivation: 'ta',
  love: 'en',
  humanity: 'ta',
  thirukkural: 'en',
  poetry: 'ta',
  meaningful: 'en',
};

/**
 * Returns the opposite language for alternation ('ta' <-> 'en').
 */
function getOppositeLanguage(lang) {
  const normalized = String(lang || 'ta').toLowerCase().trim();
  return (normalized === 'ta' || normalized === 'tamil') ? 'en' : 'ta';
}

/**
 * Returns the deterministic initial language for a topic if it has never occurred.
 */
function getInitialLanguageForTopic(topic, topicIndex = 0) {
  const t = String(topic || '').toLowerCase().trim();
  if (DEFAULT_TOPIC_INITIAL_LANGUAGES[t]) {
    return DEFAULT_TOPIC_INITIAL_LANGUAGES[t];
  }
  return topicIndex % 2 === 0 ? 'ta' : 'en';
}

/**
 * Resolves the language independently for a specific topic.
 * Each topic maintains its own language alternation state.
 *
 * @param {Object} params
 * @param {string} [params.languageConfig='alternate'] - 'alternate' | 'tamil' | 'english' | 'ta' | 'en'
 * @param {string} params.topic - Topic ID (e.g. 'motivation', 'love', 'thirukkural')
 * @param {string|null} [params.previousLanguage=null] - Previous language used for THIS topic
 * @param {number} [params.topicIndex=0] - Position in rotation list for fallback seed
 * @returns {string} Language code ('ta' | 'en')
 */
function resolveLanguageForTopic({
  languageConfig = 'alternate',
  topic,
  previousLanguage = null,
  topicIndex = 0,
} = {}) {
  const normalized = String(languageConfig || 'alternate').toLowerCase().trim();

  // Explicit fixed choices
  if (normalized === 'tamil' || normalized === 'ta') {
    return 'ta';
  }
  if (normalized === 'english' || normalized === 'en') {
    return 'en';
  }

  // If topic has previously occurred, use opposite of its previous language
  if (previousLanguage) {
    return getOppositeLanguage(previousLanguage);
  }

  // If topic has never occurred, use deterministic initial language
  return getInitialLanguageForTopic(topic, topicIndex);
}

/**
 * Resolves the next language deterministically.
 * Backwards compatible with legacy callers; supports per-topic alternation when topic is provided.
 *
 * @param {Object} params
 * @param {string} params.languageConfig - 'alternate' | 'tamil' | 'english' | 'ta' | 'en'
 * @param {string|null} [params.lastLanguage] - Language code of previous run
 * @param {string} [params.topic] - Topic being resolved for
 * @param {string|null} [params.previousLanguage] - Previous language for this topic
 * @param {number} [params.runCount] - Total count of prior runs
 * @param {number} [params.topicIndex] - Index of topic in rotation
 * @returns {string} Language code ('ta' | 'en')
 */
function resolveLanguage({
  languageConfig = 'alternate',
  lastLanguage = null,
  topic = null,
  previousLanguage = null,
  runCount = 0,
  topicIndex = 0,
} = {}) {
  if (topic) {
    return resolveLanguageForTopic({
      languageConfig,
      topic,
      previousLanguage: previousLanguage || lastLanguage,
      topicIndex,
    });
  }

  const normalized = String(languageConfig || 'alternate').toLowerCase().trim();
  if (normalized === 'tamil' || normalized === 'ta') return 'ta';
  if (normalized === 'english' || normalized === 'en') return 'en';

  if (lastLanguage) {
    return getOppositeLanguage(lastLanguage);
  }

  if (runCount && typeof runCount === 'number') {
    return runCount % 2 === 0 ? 'ta' : 'en';
  }

  return 'ta';
}

function getLanguageMeta(code) {
  const normalized = (code || 'ta').toLowerCase();
  return (
    SUPPORTED_LANGUAGES[normalized] || {
      code: normalized,
      name: normalized.toUpperCase(),
      nativeName: normalized,
      flag: '🌐',
    }
  );
}

module.exports = {
  resolveLanguage,
  resolveLanguageForTopic,
  getOppositeLanguage,
  getInitialLanguageForTopic,
  getLanguageMeta,
  SUPPORTED_LANGUAGES,
  DEFAULT_TOPIC_INITIAL_LANGUAGES,
};
