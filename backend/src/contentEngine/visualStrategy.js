/**
 * Visual Strategy Selection Layer
 *
 * Implements the visual selection layer as a STRATEGY for future image rendering,
 * without downloading random web images or scraping copyrighted social media.
 *
 * Automatically maps topics and moods to coherent aesthetic styles when visualStyle is 'auto'.
 */

const { getTopicMeta } = require('./topicRotation');

// Mapping of topic moods to cinematic visual strategies
const TOPIC_VISUAL_MAP = {
  motivation: {
    derivedStyle: 'cinematic',
    mood: 'dramatic',
    colorGrading: 'amber_teal_contrast',
    lighting: 'dramatic_golden_rim',
    recommendedImagery: 'mountain_peaks_sunrise_ascending_light',
    description: 'Dramatic high-contrast visuals with ascending light and energetic cinematic depth',
  },
  love: {
    derivedStyle: 'warm_intimate',
    mood: 'intimate',
    colorGrading: 'warm_golden_rose',
    lighting: 'soft_ambient_golden_hour',
    recommendedImagery: 'soft_bokeh_sunset_warm_textures',
    description: 'Warm golden hour ambient lighting with gentle depth of field and soft intimacy',
  },
  humanity: {
    derivedStyle: 'natural_human',
    mood: 'empathetic',
    colorGrading: 'natural_earth_tones',
    lighting: 'gentle_daylight',
    recommendedImagery: 'serene_landscapes_shared_paths_morning_mist',
    description: 'Serene natural landscapes with grounded earth tones and gentle human warmth',
  },
  thirukkural: {
    derivedStyle: 'minimal_traditional',
    mood: 'philosophical',
    colorGrading: 'sandstone_parchment_neutral',
    lighting: 'calm_neutral_ambient',
    recommendedImagery: 'textured_granite_lotus_calm_water_reflections',
    description: 'Understated parchment and stone textures with timeless traditional aesthetics',
  },
  poetry: {
    derivedStyle: 'cinematic_artistic',
    mood: 'artistic',
    colorGrading: 'moody_twilight_cyan',
    lighting: 'dreamy_backlit_bokeh',
    recommendedImagery: 'rain_ripples_misty_dawn_shadows',
    description: 'Dreamy atmospheric bokeh, gentle mist, and reflective artistic silhouettes',
  },
  meaningful: {
    derivedStyle: 'dark_minimal',
    mood: 'contemplative',
    colorGrading: 'deep_obsidian_monochrome',
    lighting: 'subtle_neon_rim_gold_particles',
    recommendedImagery: 'deep_night_sky_starfields_minimal_geometry',
    description: 'Deep obsidian backdrop with subtle glowing ambient particle energy',
  },

  // Future topics
  one_sided_love: {
    derivedStyle: 'melancholic_atmospheric',
    mood: 'melancholic',
    colorGrading: 'cool_dusk_indigo',
    lighting: 'fading_twilight',
    recommendedImagery: 'rain_on_window_distant_streetlights_quiet_space',
    description: 'Cool dusk tones, soft rain reflections, and quiet spacious negative space',
  },
  heartbreak: {
    derivedStyle: 'poignant_shadows',
    mood: 'poignant',
    colorGrading: 'monochrome_high_contrast',
    lighting: 'harsh_shadows_and_single_beam',
    recommendedImagery: 'cracked_stone_with_blooming_moss_single_light',
    description: 'High contrast shadows, fading light, and quiet resilient beauty',
  },
};

/**
 * Selects a visual strategy specification for a quote video.
 *
 * @param {Object} params
 * @param {string} params.topic - Topic ID
 * @param {string} [params.language='ta'] - Language code
 * @param {string} [params.visualStyle='auto'] - Chosen style option
 * @param {string} [params.mood] - Overriding mood
 * @returns {Object} Structured visual strategy object
 */
function selectVisualStrategy({
  topic = 'motivation',
  language = 'ta',
  visualStyle = 'auto',
  mood = null,
} = {}) {
  const normTopic = String(topic || 'motivation').toLowerCase().trim();
  const normStyle = String(visualStyle || 'auto').toLowerCase().trim();

  const topicConfig = TOPIC_VISUAL_MAP[normTopic] || TOPIC_VISUAL_MAP.motivation;

  let resolvedStyle = topicConfig.derivedStyle;
  let resolvedLighting = topicConfig.lighting;
  let resolvedColorGrading = topicConfig.colorGrading;
  let resolvedDescription = topicConfig.description;

  // If explicit user style was chosen instead of auto
  if (normStyle === 'cinematic') {
    resolvedStyle = 'cinematic';
    resolvedLighting = 'widescreen_dramatic_rim';
    resolvedColorGrading = 'film_stock_high_contrast';
    resolvedDescription = 'Film-grade widescreen lighting with cinematic contrast and texture';
  } else if (normStyle === 'dark_atmospheric') {
    resolvedStyle = 'dark_atmospheric';
    resolvedLighting = 'deep_shadow_subtle_ambient';
    resolvedColorGrading = 'obsidian_green_gold_highlights';
    resolvedDescription = 'Deep obsidian dark surfaces with subtle glowing energy elements';
  } else if (normStyle === 'minimal') {
    resolvedStyle = 'minimal';
    resolvedLighting = 'even_soft_diffuse';
    resolvedColorGrading = 'neutral_greyscale_clean';
    resolvedDescription = 'Ultra-clean negative space prioritizing bold typography and legible cadence';
  } else if (normStyle === 'nature') {
    resolvedStyle = 'nature';
    resolvedLighting = 'natural_golden_sunlight';
    resolvedColorGrading = 'organic_green_earth_tones';
    resolvedDescription = 'Organic landscapes, calm forest mist, and tranquil water textures';
  } else if (normStyle === 'plain_black') {
    resolvedStyle = 'plain_black';
    resolvedLighting = 'none_flat';
    resolvedColorGrading = 'pure_black_matte';
    resolvedDescription = 'Pure solid black background providing maximum contrast for typography';
  }

  return {
    style: resolvedStyle,
    backgroundType: normStyle === 'plain_black' ? 'solid_color' : 'generated_or_licensed',
    aspectRatio: '9:16',
    fallback: 'plain_black',
    status: 'pending', // Explicit pending state: no scraping, no fake generation
    details: {
      mood: mood || topicConfig.mood,
      lighting: resolvedLighting,
      colorGrading: resolvedColorGrading,
      recommendedImagery: topicConfig.recommendedImagery,
      description: resolvedDescription,
      requiresScraping: false,
      legalDisclaimer: 'Visual asset will be created via licensed/generated pipeline in rendering stage.',
    },
  };
}

module.exports = {
  selectVisualStrategy,
  TOPIC_VISUAL_MAP,
};
