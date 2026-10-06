/**
 * Typography & Layout System
 *
 * Implements high-end 9:16 vertical typography layout with:
 * - First-class Tamil (Noto Sans Tamil) and English (Noto Sans)
 * - Safe Area compliance for Instagram Reels and YouTube Shorts
 *   (top margin >= 300px, bottom margin >= 380px, left/right margins >= 120px)
 * - Dynamic typography sizing based on length, language, duration, and hierarchy
 * - Specialized Thirukkural couplet formatting (2-line hero couplet + accent separator + secondary explanation)
 * - Restrained, elegant branding without boxy UI cards or neon clutter
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

// Register high-quality local fonts
const FONTS_DIR = path.join(__dirname, '../../../assets/fonts');
if (fs.existsSync(FONTS_DIR)) {
  const tamilBold = path.join(FONTS_DIR, 'NotoSansTamil-Bold.ttf');
  const tamilReg = path.join(FONTS_DIR, 'NotoSansTamil-Regular.ttf');
  const latinBold = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');
  const latinReg = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');

  if (fs.existsSync(tamilBold)) GlobalFonts.registerFromPath(tamilBold, 'NotoSansTamilBold');
  if (fs.existsSync(tamilReg)) GlobalFonts.registerFromPath(tamilReg, 'NotoSansTamilRegular');
  if (fs.existsSync(latinBold)) GlobalFonts.registerFromPath(latinBold, 'NotoSansBold');
  if (fs.existsSync(latinReg)) GlobalFonts.registerFromPath(latinReg, 'NotoSansRegular');
}

// System fallbacks
const SYSTEM_FALLBACKS = [
  '/System/Library/Fonts/Supplemental/Tamil Sangam MN.ttc',
  '/System/Library/Fonts/Supplemental/Tamil MN.ttc',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
];
for (const fontPath of SYSTEM_FALLBACKS) {
  if (fs.existsSync(fontPath)) {
    try {
      GlobalFonts.registerFromPath(fontPath);
    } catch (_) {}
  }
}

const FONT_FAMILY_BOLD = 'NotoSansTamilBold, NotoSansBold, "Tamil Sangam MN", "Tamil MN", Arial, sans-serif';
const FONT_FAMILY_REGULAR = 'NotoSansTamilRegular, NotoSansRegular, "Tamil Sangam MN", "Tamil MN", Arial, sans-serif';

// Safe Area Constants for 1080x1920 (Reels / Shorts)
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const SAFE_TOP = 320;      // Keeps clear of top account header, search, audio bar
const SAFE_BOTTOM = 1540;   // Keeps clear of bottom caption, audio disc, action buttons
const SAFE_LEFT = 120;
const SAFE_RIGHT = 960;
const MAX_CONTENT_WIDTH = 840; // 77.8% of canvas width (leaves 120px on left and right)

/**
 * Wraps text into lines that strictly fit within maxWidth.
 * Respects explicit newlines and avoids orphan single words where possible.
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const paragraphs = String(text).split('\n');
  const lines = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      const metrics = ctx.measureText(testLine);
      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Calculates optimal dynamic typography sizes for quote and explanation.
 */
function calculateTypographySizing({
  quote = '',
  explanation = '',
  language = 'en',
  isThirukkural = false,
  hasExplanation = false,
}) {
  const quoteLen = quote.length;
  const isTamil = language === 'ta';

  let quoteFontSize = 50;
  let quoteLineHeight = isTamil ? 80 : 74;

  if (isThirukkural) {
    // Thirukkural Couplets are 2 punchy lines
    quoteFontSize = 54;
    quoteLineHeight = 88;
  } else if (quoteLen <= 45) {
    quoteFontSize = isTamil ? 56 : 60;
    quoteLineHeight = isTamil ? 90 : 86;
  } else if (quoteLen <= 90) {
    quoteFontSize = isTamil ? 48 : 52;
    quoteLineHeight = isTamil ? 78 : 74;
  } else if (quoteLen <= 160) {
    quoteFontSize = isTamil ? 40 : 44;
    quoteLineHeight = isTamil ? 66 : 64;
  } else {
    // Long quote
    quoteFontSize = isTamil ? 34 : 36;
    quoteLineHeight = isTamil ? 56 : 52;
  }

  // Explanation sizing
  let explFontSize = isTamil ? 28 : 29;
  let explLineHeight = isTamil ? 48 : 44;

  if (explanation.length > 180) {
    explFontSize = isTamil ? 24 : 25;
    explLineHeight = isTamil ? 40 : 38;
  }

  return {
    quoteFontSize,
    quoteLineHeight,
    explFontSize,
    explLineHeight,
  };
}

/**
 * Creates the Quote overlay canvas (1080x1920 transparent PNG).
 *
 * @param {Object} params
 * @param {string} params.quote - Quote text
 * @param {Object} params.profile - Topic visual profile
 * @param {string} [params.language='en'] - 'ta' | 'en'
 * @param {boolean} [params.hasExplanation=false] - Whether an explanation follows
 * @returns {Object} { canvas, quoteBottomY, linesCount, quoteStartY }
 */
function createQuoteOverlayCanvas({
  quote,
  profile,
  language = 'en',
  hasExplanation = false,
}) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  const palette = profile.palette || {};
  const isThirukkural = profile.isThirukkural || profile.topic === 'thirukkural';
  const sizing = calculateTypographySizing({
    quote,
    language,
    isThirukkural,
    hasExplanation,
  });

  // Measure and wrap lines
  ctx.font = `${sizing.quoteFontSize}px ${FONT_FAMILY_BOLD}`;
  const lines = wrapText(ctx, quote, MAX_CONTENT_WIDTH);

  const totalQuoteHeight = lines.length * sizing.quoteLineHeight;

  // Determine vertical centering
  // If explanation is present, raise quote center so both fit comfortably in safe area
  let targetCenterY = hasExplanation ? 780 : 920;
  if (isThirukkural) {
    targetCenterY = 740;
  }

  let startY = targetCenterY - totalQuoteHeight / 2 + sizing.quoteLineHeight / 2;

  // Enforce Safe Top margin
  if (startY < SAFE_TOP + 60) {
    startY = SAFE_TOP + 60;
  }

  const quoteBottomY = startY + (lines.length - 1) * sizing.quoteLineHeight;

  // 1. Topic Accent Tag (Restrained, elegant, non-boxy)
  const tagY = startY - (sizing.quoteLineHeight / 2) - 50;
  if (tagY >= SAFE_TOP - 40) {
    const rawBadge = (profile.badge || profile.name || '').toUpperCase();
    // Space out letters for cinematic elegance (e.g., "M O T I V A T I O N")
    const spacedBadge = rawBadge.split('').join(' ');

    ctx.save();
    ctx.font = `20px ${FONT_FAMILY_BOLD}`;
    ctx.textAlign = 'center';

    // Accent dot
    const badgeMetrics = ctx.measureText(spacedBadge);
    const halfWidth = badgeMetrics.width / 2;
    const dotX = 540 - halfWidth - 16;

    ctx.fillStyle = palette.accentColor || '#00e575';
    ctx.beginPath();
    ctx.arc(dotX, tagY - 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = palette.secondaryAccent || '#94a3b8';
    ctx.fillText(spacedBadge, 540, tagY);
    ctx.restore();
  }

  // 2. Decorative Minimal Quotation Glyphs (Discreet, high-class)
  if (!isThirukkural) {
    ctx.save();
    ctx.font = `44px ${FONT_FAMILY_BOLD}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.textAlign = 'center';
    ctx.fillText('“', 540, startY - (sizing.quoteLineHeight / 2) - 10);
    ctx.restore();
  }

  // 3. Render Quote Lines with drop shadow
  ctx.save();
  ctx.font = `${sizing.quoteFontSize}px ${FONT_FAMILY_BOLD}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.quoteColor || '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * sizing.quoteLineHeight;
    ctx.fillText(lines[i], 540, y);
  }
  ctx.restore();

  return {
    canvas,
    quoteStartY: startY,
    quoteBottomY,
    totalQuoteHeight,
    linesCount: lines.length,
    fontSize: sizing.quoteFontSize,
  };
}

/**
 * Creates the Explanation overlay canvas (1080x1920 transparent PNG).
 *
 * @param {Object} params
 * @param {string} params.explanation - Explanation text
 * @param {number} params.quoteBottomY - Y coordinate where quote ends
 * @param {Object} params.profile - Topic visual profile
 * @param {string} [params.language='en'] - 'ta' | 'en'
 * @returns {Canvas} Rendered explanation canvas
 */
function createExplanationOverlayCanvas({
  explanation,
  quoteBottomY = 960,
  profile,
  language = 'en',
}) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  if (!explanation || !explanation.trim()) return canvas;

  const palette = profile.palette || {};
  const isThirukkural = profile.isThirukkural || profile.topic === 'thirukkural';
  const sizing = calculateTypographySizing({
    quote: '',
    explanation,
    language,
    isThirukkural,
    hasExplanation: true,
  });

  ctx.font = `${sizing.explFontSize}px ${FONT_FAMILY_REGULAR}`;
  const lines = wrapText(ctx, explanation, MAX_CONTENT_WIDTH - 40);

  // Position explanation cleanly with breathing room below quote
  const gap = isThirukkural ? 80 : 70;
  let startY = quoteBottomY + gap;

  // Keep within safe area
  const totalExplHeight = lines.length * sizing.explLineHeight;
  if (startY + totalExplHeight > SAFE_BOTTOM) {
    startY = SAFE_BOTTOM - totalExplHeight;
  }

  // 1. Subtle hairline separator
  ctx.save();
  const sepY = startY - (gap / 2);
  const sepColor = isThirukkural
    ? (palette.accentColor || '#fbbf24')
    : 'rgba(255, 255, 255, 0.16)';
  ctx.strokeStyle = sepColor;
  ctx.lineWidth = isThirukkural ? 1.5 : 1.0;
  ctx.beginPath();
  const sepWidth = isThirukkural ? 120 : 80;
  ctx.moveTo(540 - sepWidth, sepY);
  ctx.lineTo(540 + sepWidth, sepY);
  ctx.stroke();

  // If Thirukkural, add a microscopic center diamond
  if (isThirukkural) {
    ctx.fillStyle = palette.accentColor || '#fbbf24';
    ctx.beginPath();
    ctx.arc(540, sepY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. Render Explanation Lines
  ctx.save();
  ctx.font = `${sizing.explFontSize}px ${FONT_FAMILY_REGULAR}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.explanationColor || '#cbd5e1';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * sizing.explLineHeight;
    ctx.fillText(lines[i], 540, y);
  }
  ctx.restore();

  return canvas;
}

module.exports = {
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
};
