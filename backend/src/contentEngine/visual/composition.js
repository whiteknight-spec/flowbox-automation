/**
 * Visual Composition Orchestrator
 *
 * Integrates Topic Visual Profiles, Procedural Backgrounds, Typography Layout,
 * and Text Animation into a unified, deterministic Render Plan.
 */

const { resolveTopicVisualProfile } = require('./topicVisualProfiles');
const { calculateAnimationTiming } = require('./textAnimation');
const { calculateTypographySizing, SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT, MAX_CONTENT_WIDTH } = require('./typographyRenderer');

/**
 * Prepares a complete visual render plan for a quote video job.
 *
 * @param {Object} job - Quote video job record from SQLite
 * @param {Object} [options] - Additional render options or overrides
 * @returns {Object} Deterministic render plan
 */
function prepareVisualComposition(job, options = {}) {
  const topic = job.topic || job.spec?.topic?.id || 'motivation';
  const visualStyle = options.visualStyle || job.visualStrategy?.style || job.spec?.visual?.style || 'auto';
  const language = job.language || 'en';
  const duration = parseInt(job.duration || 15, 10);
  const quote = job.quote || '';
  const explanation = job.explanation || '';
  const hasExplanation = Boolean(explanation && explanation.trim().length > 0);

  // 1. Resolve Topic Profile
  const profile = resolveTopicVisualProfile({
    topic,
    visualStyle,
    language,
    duration,
    quote,
    explanation,
  });

  // 2. Calculate Animation Keyframes & Durations
  const timing = calculateAnimationTiming(duration, hasExplanation);

  // 3. Calculate Typography Plan
  const typography = calculateTypographySizing({
    quote,
    explanation,
    language,
    isThirukkural: profile.isThirukkural,
    hasExplanation,
  });

  // 4. Safe Area Definition
  const safeArea = {
    top: SAFE_TOP,
    bottom: SAFE_BOTTOM,
    left: SAFE_LEFT,
    right: SAFE_RIGHT,
    maxWidth: MAX_CONTENT_WIDTH,
    maxContentWidth: MAX_CONTENT_WIDTH,
  };

  return {
    jobId: job.id,
    topic,
    language,
    duration,
    visualTitle: profile.visualTitle,
    profile,
    timing,
    typography,
    safeArea,
    hasExplanation,
    isThirukkural: profile.isThirukkural,
    audioFade: timing.audio,
  };
}

module.exports = {
  prepareVisualComposition,
};
