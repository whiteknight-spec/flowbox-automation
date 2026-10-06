/**
 * Topic Visual Profiles & Aesthetic Mapping
 *
 * Provides topic-aware visual configurations for the 7 core topics:
 * 1. motivation
 * 2. love
 * 3. one_sided_love
 * 4. humanity
 * 5. thirukkural
 * 6. poetry
 * 7. meaningful
 *
 * Implements deterministic visual strategy resolution combining topic mood,
 * user style preference, language, and duration.
 */

const TOPIC_VISUAL_PROFILES = {
  motivation: {
    id: 'motivation',
    topic: 'motivation',
    name: 'Motivation',
    derivedStyle: 'cinematic',
    badge: 'MOTIVATION',
    emoji: '🔥',
    mood: 'dramatic',
    feeling: 'Resilience & Forward Determination',
    backgroundType: 'cinematic_gradient_depth',
    palette: {
      base: '#070a0f',
      mid: '#0b1320',
      dark: '#030508',
      atmosphereGlow: 'rgba(0, 229, 117, 0.14)', // Flowbox restrained neon green
      secondaryGlow: 'rgba(245, 158, 11, 0.16)', // Warm amber rim
      accentColor: '#00e575',
      secondaryAccent: '#fbbf24',
      quoteColor: '#ffffff',
      explanationColor: '#cbd5e1',
    },
    motion: {
      type: 'forward_drift',
      driftPx: 100,
    },
  },

  love: {
    id: 'love',
    topic: 'love',
    name: 'Love',
    derivedStyle: 'warm_intimate',
    badge: 'LOVE',
    emoji: '❤️',
    mood: 'intimate',
    feeling: 'Deep Emotional Bonds & Quiet Warmth',
    backgroundType: 'soft_fog_glow',
    palette: {
      base: '#0c070a',
      mid: '#170e14',
      dark: '#050304',
      atmosphereGlow: 'rgba(251, 113, 133, 0.11)', // Soft warm rose (no cheesy hearts)
      secondaryGlow: 'rgba(245, 158, 11, 0.14)', // Warm golden hour amber
      accentColor: '#fb7185',
      secondaryAccent: '#f59e0b',
      quoteColor: '#ffffff',
      explanationColor: '#e2e8f0',
    },
    motion: {
      type: 'intimate_breathing',
      driftPx: 75,
    },
  },

  one_sided_love: {
    id: 'one_sided_love',
    topic: 'one_sided_love',
    name: 'One-Sided Love',
    derivedStyle: 'melancholic_atmospheric',
    badge: 'ONE-SIDED LOVE',
    emoji: '🥀',
    mood: 'melancholic',
    feeling: 'Distance, Quiet Longing & Silent Grace',
    backgroundType: 'atmospheric_light_beam',
    palette: {
      base: '#070709', // Deep obsidian charcoal
      mid: '#0c0c10',  // Muted charcoal nuance
      dark: '#030304', // Quiet deep black
      atmosphereGlow: 'rgba(217, 180, 130, 0.055)', // Extremely subtle warm-amber atmospheric breath
      secondaryGlow: 'rgba(168, 162, 158, 0.04)',   // Muted stone gray distant light falloff
      accentColor: '#d4b483', // Restrained muted warm amber (no blue/indigo)
      secondaryAccent: '#78716c', // Muted warm gray
      quoteColor: '#ffffff',
      explanationColor: '#a8a29e', // Soft stone gray for gentle emotional separation
    },
    motion: {
      type: 'slow_longing_drift',
      driftPx: 50,
    },
  },

  humanity: {
    id: 'humanity',
    topic: 'humanity',
    name: 'Humanity',
    derivedStyle: 'natural_human',
    badge: 'HUMANITY',
    emoji: '🤝',
    mood: 'empathetic',
    feeling: 'Empathy, Shared Kindness & Grounded Grace',
    backgroundType: 'abstract_organic_waves',
    palette: {
      base: '#080a09',
      mid: '#0e1410',
      dark: '#030403',
      atmosphereGlow: 'rgba(234, 179, 8, 0.11)', // Warm daylight gold
      secondaryGlow: 'rgba(16, 185, 129, 0.11)', // Grounded emerald dawn
      accentColor: '#fbbf24',
      secondaryAccent: '#34d399',
      quoteColor: '#ffffff',
      explanationColor: '#cbd5e1',
    },
    motion: {
      type: 'organic_expansion',
      driftPx: 80,
    },
  },

  thirukkural: {
    id: 'thirukkural',
    topic: 'thirukkural',
    name: 'Thirukkural',
    derivedStyle: 'minimal_traditional',
    badge: 'THIRUKKURAL',
    emoji: '📜',
    mood: 'philosophical',
    feeling: 'Timeless Classical Literary Wisdom',
    backgroundType: 'subtle_grain_vignette',
    palette: {
      base: '#080706',
      mid: '#110e0b',
      dark: '#030302',
      atmosphereGlow: 'rgba(217, 119, 6, 0.16)', // Sacred literary gold
      secondaryGlow: 'rgba(251, 191, 36, 0.09)', // Warm parchment highlight
      accentColor: '#fbbf24',
      secondaryAccent: '#d97706',
      quoteColor: '#ffffff',
      explanationColor: '#cbd5e1',
    },
    motion: {
      type: 'timeless_calm',
      driftPx: 50,
    },
  },

  poetry: {
    id: 'poetry',
    topic: 'poetry',
    name: 'Poetry',
    derivedStyle: 'cinematic_artistic',
    badge: 'POETRY',
    emoji: '✍️',
    mood: 'artistic',
    feeling: 'Soulful Reflections & Lyrical Cadence',
    backgroundType: 'soft_fog_glow',
    palette: {
      base: '#08080a', // Deep obsidian charcoal
      mid: '#0f0e13',  // Soft atmospheric charcoal
      dark: '#030304', // Quiet near-black foundation
      atmosphereGlow: 'rgba(210, 204, 196, 0.075)', // Subtle warm-gray atmospheric mist (no cyan)
      secondaryGlow: 'rgba(202, 168, 92, 0.055)',   // Restrained muted warm-gold light (no purple)
      accentColor: '#d4c5a9', // Restrained antique gold-sand (replaces cyan)
      secondaryAccent: '#8c857b', // Muted warm gray
      quoteColor: '#ffffff',
      explanationColor: '#c2bcb2', // Warm literary parchment gray
    },
    motion: {
      type: 'lyrical_drift',
      driftPx: 60,
    },
  },

  meaningful: {
    id: 'meaningful',
    topic: 'meaningful',
    name: 'Meaningful',
    derivedStyle: 'dark_minimal',
    badge: 'MEANINGFUL',
    emoji: '🌙',
    mood: 'contemplative',
    feeling: 'Deep Philosophical Thought & Negative Space',
    backgroundType: 'minimal_light_field',
    palette: {
      base: '#050608',
      mid: '#090d12',
      dark: '#020304',
      atmosphereGlow: 'rgba(255, 255, 255, 0.06)', // Starlight diffuse pool
      secondaryGlow: 'rgba(0, 229, 117, 0.08)', // Flowbox micro-green whisper
      accentColor: '#f1f5f9',
      secondaryAccent: '#00e575',
      quoteColor: '#ffffff',
      explanationColor: '#94a3b8',
    },
    motion: {
      type: 'contemplative_calm',
      driftPx: 45,
    },
  },
};

/**
 * Resolves a complete, deterministic topic visual profile.
 *
 * @param {Object} params
 * @param {string} params.topic - Topic ID
 * @param {string} [params.visualStyle='auto'] - User style choice
 * @param {string} [params.language='en'] - 'ta' | 'en'
 * @param {number} [params.duration=15] - Duration in seconds
 * @param {string} [params.quote=''] - Quote string for dynamic length calculation
 * @param {string} [params.explanation=''] - Explanation string
 * @returns {Object} Complete visual profile specification
 */
function resolveTopicVisualProfile({
  topic = 'motivation',
  visualStyle = 'auto',
  language = 'en',
  duration = 15,
  quote = '',
  explanation = '',
} = {}) {
  const normTopic = String(topic || 'motivation').toLowerCase().trim();
  const baseProfile = TOPIC_VISUAL_PROFILES[normTopic] || TOPIC_VISUAL_PROFILES.motivation;

  const normStyle = String(visualStyle || 'auto').toLowerCase().trim();

  // If visualStyle is 'plain_black', enforce total minimalist black
  if (normStyle === 'plain_black') {
    return {
      ...baseProfile,
      derivedStyle: 'plain_black',
      backgroundType: 'plain_black',
      palette: {
        ...baseProfile.palette,
        base: '#050507',
        mid: '#050507',
        dark: '#020203',
        atmosphereGlow: 'rgba(0, 0, 0, 0)',
        secondaryGlow: 'rgba(0, 0, 0, 0)',
      },
      motion: { type: 'static', driftPx: 0 },
      visualTitle: `Plain Black • ${baseProfile.name}`,
    };
  }

  // If user selected a specific style override (not auto)
  let effectiveStyle = baseProfile.derivedStyle;
  let bgType = baseProfile.backgroundType;

  if (normStyle === 'cinematic') {
    effectiveStyle = 'cinematic';
    bgType = 'cinematic_gradient_depth';
  } else if (normStyle === 'dark_atmospheric') {
    effectiveStyle = 'dark_atmospheric';
    bgType = 'atmospheric_light_beam';
  } else if (normStyle === 'minimal') {
    effectiveStyle = 'minimal';
    bgType = 'minimal_light_field';
  } else if (normStyle === 'nature') {
    effectiveStyle = 'nature';
    bgType = 'abstract_organic_waves';
  }

  // Build human-friendly visual title (e.g. "Cinematic • Motivation")
  const styleDisplayNames = {
    cinematic: 'Cinematic',
    warm_intimate: 'Warm Intimate',
    melancholic_atmospheric: 'Dark & Atmospheric',
    natural_human: 'Grounded Warmth',
    minimal_traditional: 'Timeless Classical',
    cinematic_artistic: 'Artistic Cadence',
    dark_minimal: 'Dark & Minimal',
    nature: 'Organic Nature',
    plain_black: 'Plain Black',
  };

  const styleDisplay = styleDisplayNames[effectiveStyle] || 'Cinematic';
  const visualTitle = `${styleDisplay} • ${baseProfile.name}`;

  return {
    ...baseProfile,
    derivedStyle: effectiveStyle,
    backgroundType: bgType,
    visualTitle,
    language,
    duration,
    hasExplanation: Boolean(explanation && explanation.trim().length > 0),
    isThirukkural: normTopic === 'thirukkural',
  };
}

module.exports = {
  TOPIC_VISUAL_PROFILES,
  resolveTopicVisualProfile,
};
