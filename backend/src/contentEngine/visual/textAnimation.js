/**
 * Text Animation & Cinematic Pacing Engine
 *
 * Implements subtle, high-production-value text motion:
 * - Fade in with smooth upward settlement (no tacky bounce or zoom)
 * - Pacing calibrated strictly by duration: 10s, 15s, 20s, 30s
 * - Background slow ambient crop drift (IMAX-style subtle parallax)
 * - Audio volume fade-in and fade-out
 * - Clean fade-out before video concludes
 */

/**
 * Calculates animation timing keyframes based on video duration.
 *
 * @param {number} duration - Video duration in seconds (10, 15, 20, 30)
 * @param {boolean} hasExplanation - Whether an explanation overlay is present
 * @returns {Object} Timing specification
 */
function calculateAnimationTiming(duration = 15, hasExplanation = false) {
  const dur = Math.max(5, Math.min(60, Number(duration) || 15));

  let quoteInStart = 0.5;
  let quoteInDur = 1.0;
  let quoteSlidePx = 28;

  let explInStart = 2.8;
  let explInDur = 1.0;
  let explSlidePx = 18;

  let fadeOutDur = 1.0;
  let fadeOutStart = Math.max(1.0, dur - 1.2);

  if (dur <= 10) {
    // 10s: Fast but still cinematic
    quoteInStart = 0.4;
    quoteInDur = 0.8;
    quoteSlidePx = 24;

    explInStart = 2.0;
    explInDur = 0.8;
    explSlidePx = 14;

    fadeOutDur = 0.8;
    fadeOutStart = Math.max(1.0, dur - 1.0);
  } else if (dur <= 15) {
    // 15s: Default standard composition
    quoteInStart = 0.5;
    quoteInDur = 1.0;
    quoteSlidePx = 28;

    explInStart = 2.8;
    explInDur = 1.0;
    explSlidePx = 18;

    fadeOutDur = 1.0;
    fadeOutStart = Math.max(1.0, dur - 1.2);
  } else if (dur <= 20) {
    // 20s: Slower reveal, more atmospheric breathing room
    quoteInStart = 0.6;
    quoteInDur = 1.2;
    quoteSlidePx = 30;

    explInStart = 3.6;
    explInDur = 1.2;
    explSlidePx = 20;

    fadeOutDur = 1.2;
    fadeOutStart = Math.max(1.0, dur - 1.5);
  } else {
    // 30s: Rich cinematic storytelling pace
    quoteInStart = 0.8;
    quoteInDur = 1.5;
    quoteSlidePx = 32;

    explInStart = 5.2;
    explInDur = 1.5;
    explSlidePx = 22;

    fadeOutDur = 1.5;
    fadeOutStart = Math.max(1.0, dur - 1.8);
  }

  return {
    duration: dur,
    quote: {
      inStart: quoteInStart,
      inDur: quoteInDur,
      slidePx: quoteSlidePx,
      outStart: fadeOutStart,
      outDur: fadeOutDur,
    },
    explanation: hasExplanation
      ? {
          inStart: explInStart,
          inDur: explInDur,
          slidePx: explSlidePx,
          outStart: fadeOutStart,
          outDur: fadeOutDur,
        }
      : null,
    background: {
      hasMotion: true,
      driftPx: 106, // Drift 106px over duration from 1140x2026 canvas down to 1080x1920
    },
    audio: {
      fadeInDur: 0.8,
      fadeOutDur: Math.min(1.8, dur * 0.12),
      fadeOutStart: Math.max(0.5, dur - Math.min(1.8, dur * 0.12)),
    },
  };
}

/**
 * Builds the complete FFmpeg -filter_complex string.
 *
 * @param {Object} params
 * @param {Object} params.timing - Animation timing object
 * @param {boolean} params.hasExplanation - Whether explanation overlay exists
 * @param {boolean} [params.enableBgMotion=true] - Whether to apply ambient vertical drift
 * @returns {string} filter_complex string
 */
function buildFilterComplex({
  timing,
  hasExplanation = false,
  enableBgMotion = true,
}) {
  const { quote, explanation, duration } = timing;
  const q = quote;
  const e = explanation;

  let filter = '';

  // 1. Background layer:
  // Input 0 is 1140x2026. If motion enabled, crop smoothly over time to 1080x1920.
  if (enableBgMotion) {
    const driftY = `106*(1 - t/${duration})`;
    filter += `[0:v]crop=1080:1920:30:'${driftY}'[bg_motion];`;
  } else {
    filter += `[0:v]crop=1080:1920:30:53[bg_motion];`;
  }

  // 2. Quote layer with alpha fade in and fade out
  filter += `[1:v]format=rgba,fade=t=in:st=${q.inStart}:d=${q.inDur}:alpha=1,fade=t=out:st=${q.outStart}:d=${q.outDur}:alpha=1[txt_q];`;

  // 3. Explanation layer (if present)
  if (hasExplanation && e) {
    filter += `[2:v]format=rgba,fade=t=in:st=${e.inStart}:d=${e.inDur}:alpha=1,fade=t=out:st=${e.outStart}:d=${e.outDur}:alpha=1[txt_e];`;

    // Overlay Quote on Background with smooth upward settlement
    const qOffsetExpr = `'if(lt(t,${q.inStart + q.inDur}), ${q.slidePx} - ${q.slidePx}*(t-${q.inStart})/${q.inDur}, 0)'`;
    filter += `[bg_motion][txt_q]overlay=0:${qOffsetExpr}[bg_q];`;

    // Overlay Explanation on [bg_q] with smooth upward settlement
    const eOffsetExpr = `'if(lt(t,${e.inStart + e.inDur}), ${e.slidePx} - ${e.slidePx}*(t-${e.inStart})/${e.inDur}, 0)'`;
    filter += `[bg_q][txt_e]overlay=0:${eOffsetExpr}[v_out]`;
  } else {
    // Quote only
    const qOffsetExpr = `'if(lt(t,${q.inStart + q.inDur}), ${q.slidePx} - ${q.slidePx}*(t-${q.inStart})/${q.inDur}, 0)'`;
    filter += `[bg_motion][txt_q]overlay=0:${qOffsetExpr}[v_out]`;
  }

  return filter;
}

module.exports = {
  calculateAnimationTiming,
  buildFilterComplex,
};
