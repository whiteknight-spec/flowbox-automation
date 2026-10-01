/**
 * Audio Strategy Selection Layer
 *
 * Implements audio strategy based on user audioPreference:
 * - 'approved_library': Clean interface for future licensed royalty-free instrumental library lookup.
 * - 'platform_supported': Preparation instruction for attaching native trending sounds in Reels/Shorts.
 * - 'no_audio': Silent video track output.
 *
 * CRITICAL RULE:
 * Never download or extract copyrighted audio from Instagram Reels or YouTube Shorts.
 * Never pretend audio has been attached when it has not.
 */

// Category recommendations by topic for licensed library selection
const TOPIC_AUDIO_GENRES = {
  motivation: { genre: 'cinematic_epic_ambient', tempo: 'moderate', instruments: ['piano', 'strings', 'subtle_percussion'] },
  love: { genre: 'acoustic_warmth', tempo: 'gentle', instruments: ['acoustic_guitar', 'warm_piano'] },
  humanity: { genre: 'serene_orchestral', tempo: 'calm', instruments: ['cello', 'flute', 'ambient_pads'] },
  thirukkural: { genre: 'traditional_classical_fusion', tempo: 'contemplative', instruments: ['veena', 'flute', 'tanpura_drone'] },
  poetry: { genre: 'minimalist_neoclassical', tempo: 'slow', instruments: ['solo_piano', 'rain_ambience'] },
  meaningful: { genre: 'ambient_soundscape', tempo: 'relaxed', instruments: ['synth_pads', 'gentle_chimes'] },
  one_sided_love: { genre: 'melancholic_piano', tempo: 'slow', instruments: ['solo_piano', 'ambient_cello'] },
  heartbreak: { genre: 'poignant_strings', tempo: 'slow', instruments: ['acoustic_guitar', 'violins'] },
};

/**
 * Selects an audio strategy for a quote video job.
 *
 * @param {Object} params
 * @param {string} [params.audioPreference='approved_library'] - 'approved_library' | 'platform_supported' | 'no_audio'
 * @param {string} [params.topic='motivation'] - Topic ID
 * @param {number} [params.duration=15] - Target video duration in seconds
 * @returns {Object} Structured audio strategy object
 */
function selectAudioStrategy({
  audioPreference = 'approved_library',
  topic = 'motivation',
  duration = 15,
} = {}) {
  const normPref = String(audioPreference || 'approved_library').toLowerCase().trim();
  const normTopic = String(topic || 'motivation').toLowerCase().trim();

  const genreConfig = TOPIC_AUDIO_GENRES[normTopic] || TOPIC_AUDIO_GENRES.motivation;

  if (normPref === 'no_audio' || normPref === 'none') {
    return {
      preference: 'none',
      status: 'silent_configured',
      track: null,
      instruction: 'Video output will be rendered without an audio track (silent).',
      note: 'Silent audio track configured. User can attach external audio if desired.',
      allowCopyrightedDownload: false,
    };
  }

  if (normPref === 'platform_supported') {
    return {
      preference: 'platform_supported',
      status: 'instruction_prepared',
      track: null,
      instruction: 'Render video silently with audio metadata. Attach native trending audio in Instagram Reels or YouTube Shorts app during publishing.',
      note: 'Platform-native audio flow prepared. Flowbox will not download copyrighted audio from Reels/Shorts.',
      allowCopyrightedDownload: false,
    };
  }

  // Default: approved_library
  return {
    preference: 'approved_library',
    status: 'pending', // Explicitly pending lookup in future licensed library
    genre: genreConfig.genre,
    tempo: genreConfig.tempo,
    targetDuration: duration,
    recommendedInstruments: genreConfig.instruments,
    instruction: `Query approved royalty-free library for licensed instrumental track matching genre: "${genreConfig.genre}" at ${duration}s.`,
    note: 'Flowbox uses audio exclusively through supported platform/licensed workflows. No audio is downloaded or extracted from Reels or Shorts.',
    allowCopyrightedDownload: false,
  };
}

module.exports = {
  selectAudioStrategy,
  TOPIC_AUDIO_GENRES,
};
