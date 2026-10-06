/**
 * Visual Subsystem Index
 */

const { TOPIC_VISUAL_PROFILES, resolveTopicVisualProfile } = require('./topicVisualProfiles');
const { renderProceduralBackground, applyCinematicVignette, applySubtleGrain } = require('./backgroundRenderer');
const {
  createQuoteOverlayCanvas,
  createExplanationOverlayCanvas,
  wrapText,
  calculateTypographySizing,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SAFE_TOP,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  MAX_CONTENT_WIDTH,
} = require('./typographyRenderer');
const { calculateAnimationTiming, buildFilterComplex } = require('./textAnimation');
const { prepareVisualComposition } = require('./composition');

module.exports = {
  TOPIC_VISUAL_PROFILES,
  resolveTopicVisualProfile,
  renderProceduralBackground,
  applyCinematicVignette,
  applySubtleGrain,
  createQuoteOverlayCanvas,
  createExplanationOverlayCanvas,
  wrapText,
  calculateTypographySizing,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SAFE_TOP,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  MAX_CONTENT_WIDTH,
  calculateAnimationTiming,
  buildFilterComplex,
  prepareVisualComposition,
};
