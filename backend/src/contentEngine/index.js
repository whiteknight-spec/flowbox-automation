/**
 * Flowbox Content Engine Module
 *
 * Provides a clean unified interface for Daily Quote Video content preparation
 * and video rendering.
 */

const {
  resolveLanguage,
  resolveLanguageForTopic,
  getOppositeLanguage,
  getInitialLanguageForTopic,
  getLanguageMeta,
  SUPPORTED_LANGUAGES,
  DEFAULT_TOPIC_INITIAL_LANGUAGES,
} = require('./languageRotation');
const { resolveTopic, getTopicMeta, TOPIC_REGISTRY, DEFAULT_TOPICS } = require('./topicRotation');
const { getAuthenticThirukkural, isAuthenticKural, THIRUKKURAL_CORPUS } = require('./thirukkuralSource');
const { generateQuoteContent, ORIGINAL_QUOTES } = require('./contentGenerator');
const { validateContent, validateTamilQuality } = require('./contentValidator');
const { selectVisualStrategy, TOPIC_VISUAL_MAP } = require('./visualStrategy');
const { selectAudioStrategy, TOPIC_AUDIO_GENRES } = require('./audioStrategy');
const {
  prepareDailyQuoteVideo,
  getLatestQuoteJob,
  getLatestRootQuoteJob,
  getQuoteJobById,
  listQuoteJobs,
  getQuoteJobCount,
  getRootQuoteJobCount,
  getTopicPreviousLanguage,
  getTopicLanguageState,
  saveTopicLanguageState,
} = require('./videoPreparation');
const {
  renderQuoteVideoJob,
  validateJobForRender,
  generateBackgroundCanvas,
  createQuoteOverlayCanvas,
  createExplanationOverlayCanvas,
  resolveApprovedAudio,
  STORAGE_BASE,
} = require('./videoRenderer');
const {
  approveQuoteVideoJob,
  regenerateQuoteVideoJob,
} = require('./reviewManager');
const {
  normalizeContentText,
  computeContentFingerprint,
  resolveDedupWindow,
  recordAcceptedContent,
  getRecentContentHistory,
  isContentDuplicate,
  clearContentHistory,
  DEFAULT_CONTENT_DEDUP_WINDOW,
} = require('./contentDeduplication');

module.exports = {
  // Main pipeline execution & rendering
  prepareDailyQuoteVideo,
  getLatestQuoteJob,
  getLatestRootQuoteJob,
  getQuoteJobById,
  listQuoteJobs,
  getQuoteJobCount,
  getRootQuoteJobCount,
  getTopicPreviousLanguage,
  getTopicLanguageState,
  saveTopicLanguageState,
  renderQuoteVideoJob,
  validateJobForRender,
  generateBackgroundCanvas,
  createQuoteOverlayCanvas,
  createExplanationOverlayCanvas,
  resolveApprovedAudio,
  STORAGE_BASE,

  // Phase 5: Video Preview & Approval System
  approveQuoteVideoJob,
  regenerateQuoteVideoJob,

  // Modular components
  resolveLanguage,
  resolveLanguageForTopic,
  getOppositeLanguage,
  getInitialLanguageForTopic,
  getLanguageMeta,
  SUPPORTED_LANGUAGES,
  DEFAULT_TOPIC_INITIAL_LANGUAGES,

  resolveTopic,
  getTopicMeta,
  TOPIC_REGISTRY,
  DEFAULT_TOPICS,

  getAuthenticThirukkural,
  isAuthenticKural,
  THIRUKKURAL_CORPUS,

  generateQuoteContent,
  ORIGINAL_QUOTES,

  validateContent,
  validateTamilQuality,

  selectVisualStrategy,
  TOPIC_VISUAL_MAP,

  selectAudioStrategy,
  TOPIC_AUDIO_GENRES,

  // Content Deduplication & History
  normalizeContentText,
  computeContentFingerprint,
  resolveDedupWindow,
  recordAcceptedContent,
  getRecentContentHistory,
  isContentDuplicate,
  clearContentHistory,
  DEFAULT_CONTENT_DEDUP_WINDOW,
};
