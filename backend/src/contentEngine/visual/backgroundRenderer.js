/**
 * Procedural Cinematic Background Renderer
 *
 * Renders high-fidelity 9:16 background canvases locally using @napi-rs/canvas.
 * Zero external scraping, zero copyright risk.
 *
 * Implements procedural background compositions:
 * - cinematic_gradient_depth
 * - atmospheric_light_beam
 * - soft_fog_glow
 * - subtle_grain_vignette
 * - abstract_organic_waves
 * - minimal_light_field
 * - plain_black
 *
 * Supports slightly over-dimensioned canvas (1140x2026) to enable silky-smooth
 * deterministic vertical drift motion in FFmpeg.
 */

const { createCanvas } = require('@napi-rs/canvas');

/**
 * Procedural pseudo-random grain overlay generator.
 * Uses a fixed seed PRNG so renders remain 100% deterministic.
 */
function applySubtleGrain(ctx, width, height, density = 0.035) {
  const grainCanvas = createCanvas(width, height);
  const grainCtx = grainCanvas.getContext('2d');
  const imgData = grainCtx.createImageData(width, height);
  const data = imgData.data;

  // Simple LCG PRNG for determinism
  let seed = 123456789;
  function lcg() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  const step = 2; // Step 2px for subtle organic texture
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (lcg() < 0.22) {
        const val = Math.floor(lcg() * 255);
        const idx = (y * width + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = Math.floor(density * 255);
      }
    }
  }

  grainCtx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(grainCanvas, 0, 0);
  ctx.restore();
}

/**
 * Applies a cinematic radial vignette around canvas edges.
 */
function applyCinematicVignette(ctx, width, height, strength = 0.75) {
  const cx = width / 2;
  const cy = height / 2;
  const innerRadius = Math.min(width, height) * 0.42;
  const outerRadius = Math.max(width, height) * 0.75;

  const vignette = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.7, `rgba(0, 0, 0, ${strength * 0.6})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${strength})`);

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Main procedural background generation function.
 *
 * @param {Object} profile - Topic visual profile specification
 * @param {Object} [dims] - Dimensions (defaults to 1140x2026 for drift motion)
 * @returns {Canvas} Rendered canvas instance
 */
function renderProceduralBackground(profile, dims = { width: 1140, height: 2026 }) {
  const { width, height } = dims;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgType = profile.backgroundType || 'cinematic_gradient_depth';
  const palette = profile.palette || {};
  const baseColor = palette.base || '#070a0f';
  const midColor = palette.mid || '#0b1320';
  const darkColor = palette.dark || '#030508';
  const atmosphereGlow = palette.atmosphereGlow || 'rgba(0, 229, 117, 0.14)';
  const secondaryGlow = palette.secondaryGlow || 'rgba(245, 158, 11, 0.16)';

  // 1. PLAIN BLACK
  if (bgType === 'plain_black') {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }

  // 2. BASE NON-LINEAR VERTICAL GRADIENT
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, baseColor);
  baseGrad.addColorStop(0.25, midColor);
  baseGrad.addColorStop(0.75, baseColor);
  baseGrad.addColorStop(1, darkColor);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. PROCEDURAL COMPOSITIONS BY TYPE
  switch (bgType) {
    case 'cinematic_gradient_depth': {
      // Primary ambient glow at upper-center
      const radial1 = ctx.createRadialGradient(width * 0.35, height * 0.25, 40, width * 0.35, height * 0.25, width * 0.75);
      radial1.addColorStop(0, secondaryGlow);
      radial1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radial1;
      ctx.fillRect(0, 0, width, height);

      // Secondary restrained glow in lower right
      const radial2 = ctx.createRadialGradient(width * 0.72, height * 0.75, 50, width * 0.72, height * 0.75, width * 0.8);
      radial2.addColorStop(0, atmosphereGlow);
      radial2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radial2;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'atmospheric_light_beam': {
      // Soft cinematic distance falloff: subtle, quiet light dissipated over negative space
      ctx.save();
      // 1. Distant, very soft light falloff (no hard polygons or sharp graphic edges)
      const distantLight = ctx.createRadialGradient(
        width * 0.72, height * 0.22, 50,
        width * 0.60, height * 0.38, width * 0.95
      );
      distantLight.addColorStop(0, atmosphereGlow);
      distantLight.addColorStop(0.45, secondaryGlow);
      distantLight.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
      distantLight.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = distantLight;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle shadow boundary deepening the lower negative space for a feeling of quiet distance
      const distanceShadow = ctx.createLinearGradient(0, height * 0.25, 0, height);
      distanceShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      distanceShadow.addColorStop(0.65, 'rgba(3, 3, 4, 0.25)');
      distanceShadow.addColorStop(1, 'rgba(2, 2, 3, 0.55)');

      ctx.fillStyle = distanceShadow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'soft_fog_glow': {
      // Multi-layer diffuse atmospheric mist pools
      const mist1 = ctx.createRadialGradient(width * 0.5, height * 0.4, 60, width * 0.5, height * 0.4, width * 0.65);
      mist1.addColorStop(0, atmosphereGlow);
      mist1.addColorStop(0.6, secondaryGlow);
      mist1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mist1;
      ctx.fillRect(0, 0, width, height);

      const mist2 = ctx.createRadialGradient(width * 0.3, height * 0.7, 50, width * 0.3, height * 0.7, width * 0.7);
      mist2.addColorStop(0, secondaryGlow);
      mist2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mist2;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'abstract_organic_waves': {
      // Smooth flowing bezier wave bands in deep background
      ctx.save();
      ctx.fillStyle = atmosphereGlow;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.3);
      ctx.bezierCurveTo(width * 0.35, height * 0.22, width * 0.65, height * 0.38, width, height * 0.28);
      ctx.lineTo(width, height * 0.48);
      ctx.bezierCurveTo(width * 0.6, height * 0.58, width * 0.3, height * 0.42, 0, height * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = secondaryGlow;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.65);
      ctx.bezierCurveTo(width * 0.4, height * 0.55, width * 0.7, height * 0.75, width, height * 0.68);
      ctx.lineTo(width, height * 0.85);
      ctx.bezierCurveTo(width * 0.6, height * 0.92, width * 0.25, height * 0.78, 0, height * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'subtle_grain_vignette': {
      // Sacred/literary deep parchment tone with central diffuse warm glow
      const litGlow = ctx.createRadialGradient(width * 0.5, height * 0.45, 80, width * 0.5, height * 0.45, width * 0.7);
      litGlow.addColorStop(0, atmosphereGlow);
      litGlow.addColorStop(0.5, secondaryGlow);
      litGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = litGlow;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'minimal_light_field':
    default: {
      // Studio matte obsidian with single micro-diffuse center glow
      const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.48, 50, width * 0.5, height * 0.48, width * 0.55);
      centerGlow.addColorStop(0, atmosphereGlow);
      centerGlow.addColorStop(0.5, secondaryGlow);
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }

  // 4. Subtle film grain texture overlay
  applySubtleGrain(ctx, width, height, 0.025);

  // 5. Cinematic edge vignette
  applyCinematicVignette(ctx, width, height, 0.75);

  return canvas;
}

module.exports = {
  renderProceduralBackground,
  applyCinematicVignette,
  applySubtleGrain,
};
