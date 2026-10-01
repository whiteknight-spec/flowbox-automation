/**
 * Video Rendering Engine for Daily Quote Video
 *
 * Consumes the Video Preparation Specification and renders a real 9:16 vertical MP4
 * (1080x1920, 30fps, H.264, AAC when audio present, yuv420p) using FFmpeg and @napi-rs/canvas.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const db = require('../db');
const { getQuoteJobById } = require('./videoPreparation');

// Register high-quality fonts for Tamil and English
const FONTS_DIR = path.join(__dirname, '../../assets/fonts');
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

// Register macOS system font fallbacks
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

// Font family fallbacks
const FONT_FAMILY_BOLD = 'NotoSansTamilBold, NotoSansBold, "Tamil Sangam MN", "Tamil MN", Arial, sans-serif';
const FONT_FAMILY_REGULAR = 'NotoSansTamilRegular, NotoSansRegular, "Tamil Sangam MN", "Tamil MN", Arial, sans-serif';

// Base storage directory
const STORAGE_BASE = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(__dirname, '../../storage');

/**
 * Splits text into wrapped lines fitting within maxWidth in pixels.
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
 * Generates an aesthetic background image (1080x1920) based on visual style.
 */
function generateBackgroundCanvas(style = 'dark_atmospheric', topicMeta = {}) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');
  const normStyle = String(style || 'dark_atmospheric').toLowerCase().trim();

  if (normStyle === 'plain_black') {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, 1080, 1920);
    return canvas;
  }

  if (normStyle === 'cinematic') {
    // Cinematic: Twilight charcoal with warm amber rim light and subtle vignette
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#090d16');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Warm golden ambient highlight at upper corner
    const amberGlow = ctx.createRadialGradient(250, 350, 50, 250, 350, 750);
    amberGlow.addColorStop(0, 'rgba(217, 119, 6, 0.18)');
    amberGlow.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = amberGlow;
    ctx.fillRect(0, 0, 1080, 1920);

    // Subtle cyan backlight at bottom
    const cyanGlow = ctx.createRadialGradient(850, 1600, 50, 850, 1600, 800);
    cyanGlow.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
    cyanGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, 1080, 1920);
  } else if (normStyle === 'minimal') {
    // Minimal: Studio matte dark slate with ultra-clean diffuse glow
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, '#11141c');
    grad.addColorStop(0.5, '#0a0d14');
    grad.addColorStop(1, '#05070a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const centerGlow = ctx.createRadialGradient(540, 960, 100, 540, 960, 600);
    centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, 1080, 1920);
  } else if (normStyle === 'nature') {
    // Nature: Deep misty forest emerald and organic dawn earth tones
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#061a14');
    grad.addColorStop(0.5, '#030f0c');
    grad.addColorStop(1, '#010504');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const emeraldGlow = ctx.createRadialGradient(540, 600, 80, 540, 600, 700);
    emeraldGlow.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
    emeraldGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = emeraldGlow;
    ctx.fillRect(0, 0, 1080, 1920);
  } else {
    // dark_atmospheric (default)
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#090d1a');
    grad.addColorStop(0.5, '#030712');
    grad.addColorStop(1, '#02040a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Deep sapphire / indigo nebula glow
    const nebulaGlow = ctx.createRadialGradient(540, 800, 60, 540, 800, 750);
    nebulaGlow.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    nebulaGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.08)');
    nebulaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebulaGlow;
    ctx.fillRect(0, 0, 1080, 1920);
  }

  // Cinematic vignette around borders
  const vignette = ctx.createRadialGradient(540, 960, 500, 540, 960, 1100);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1080, 1920);

  return canvas;
}

/**
 * Creates the Quote overlay canvas (1080x1920 transparent PNG).
 */
function createQuoteOverlayCanvas({
  quote,
  topicLabel,
  topicEmoji,
  language = 'en',
  hasExplanation = false,
}) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  const MAX_WIDTH = 880;
  const quoteLen = quote.length;

  // Adapt font size to text length so it fits balanced in the vertical frame
  let fontSize = 52;
  let lineHeight = 78;

  if (quoteLen <= 50) {
    fontSize = 60;
    lineHeight = 90;
  } else if (quoteLen <= 110) {
    fontSize = 50;
    lineHeight = 76;
  } else if (quoteLen <= 180) {
    fontSize = 42;
    lineHeight = 64;
  } else {
    fontSize = 35;
    lineHeight = 54;
  }

  // Thirukkural Couplet formatting: Thirukkurals have 2 specific lines
  ctx.font = `${fontSize}px ${FONT_FAMILY_BOLD}`;
  const lines = wrapText(ctx, quote, MAX_WIDTH);

  // Calculate vertical center positioning
  const totalTextHeight = lines.length * lineHeight;
  // If explanation is present, position quote slightly higher to maintain balanced harmony
  const targetCenterY = hasExplanation ? 800 : 920;
  let startY = targetCenterY - totalTextHeight / 2 + lineHeight / 2;

  // Safe area bounds check (safe top: 280px, safe bottom: 1550px)
  if (startY < 340) startY = 340;

  // 1. Topic Pill / Badge above quote
  const badgeY = startY - 100;
  if (badgeY >= 240) {
    const badgeText = (topicLabel || 'DAILY QUOTE').toUpperCase();
    ctx.font = `24px ${FONT_FAMILY_BOLD}`;
    const badgeMetrics = ctx.measureText(badgeText);
    const badgeWidth = badgeMetrics.width + 48;
    const badgeHeight = 44;
    const badgeX = 540 - badgeWidth / 2;

    // Glassmorphic badge background
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - 30, badgeWidth, badgeHeight, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8'; // Soft sky blue accent
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, 540, badgeY);
    ctx.restore();
  }

  // 2. Quote Mark / Indicator
  ctx.save();
  ctx.font = `64px ${FONT_FAMILY_BOLD}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('“', 540, startY - 30);
  ctx.restore();

  // 3. Render Quote Text Lines with drop shadow for strong contrast
  ctx.save();
  ctx.font = `${fontSize}px ${FONT_FAMILY_BOLD}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.fillText(lines[i], 540, y);
  }
  ctx.restore();

  return { canvas, quoteBottomY: startY + lines.length * lineHeight };
}

/**
 * Creates the Explanation overlay canvas (1080x1920 transparent PNG).
 */
function createExplanationOverlayCanvas({
  explanation,
  quoteBottomY = 960,
  language = 'en',
}) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  if (!explanation) return canvas;

  const MAX_WIDTH = 840;
  const explLen = explanation.length;

  let fontSize = 32;
  let lineHeight = 50;

  if (explLen > 180) {
    fontSize = 28;
    lineHeight = 44;
  }

  ctx.font = `${fontSize}px ${FONT_FAMILY_REGULAR}`;
  const lines = wrapText(ctx, explanation, MAX_WIDTH);

  // Position explanation cleanly below the quote with breathing room
  let startY = Math.max(quoteBottomY + 70, 1080);
  const totalExplHeight = lines.length * lineHeight;

  // Prevent bottom cutoff (Instagram/Shorts safe margin is 1600)
  if (startY + totalExplHeight > 1580) {
    startY = 1580 - totalExplHeight;
  }

  // Subtle separator line
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(540 - 80, startY - 35);
  ctx.lineTo(540 + 80, startY - 35);
  ctx.stroke();
  ctx.restore();

  // Render explanation lines
  ctx.save();
  ctx.font = `${fontSize}px ${FONT_FAMILY_REGULAR}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1'; // Soft slate / readable silver
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.fillText(lines[i], 540, y);
  }
  ctx.restore();

  return canvas;
}

/**
 * Resolves an approved audio track path if available and configured.
 */
function resolveApprovedAudio(audioStrategy = {}) {
  const pref = String(audioStrategy.preference || 'approved_library').toLowerCase().trim();
  if (pref === 'none' || pref === 'no_audio' || pref === 'platform_supported') {
    return null;
  }

  const audioDir = path.join(__dirname, '../../assets/audio');
  if (!fs.existsSync(audioDir)) return null;

  // Candidate approved files
  const candidates = [
    'approved_ambient_calm.m4a',
    'approved_ambient_calm.mp3',
    'approved_ambient.m4a',
    'approved_ambient.mp3',
  ];

  for (const c of candidates) {
    const candidatePath = path.join(audioDir, c);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

/**
 * Validates a job before rendering.
 * Returns { canRender: boolean, reason?: string, status?: string }
 */
function validateJobForRender(job) {
  if (!job) {
    return { canRender: false, reason: 'Job not found', status: 'not_found' };
  }

  // 1. Check if already rendering (concurrency lock)
  if (job.renderStatus === 'rendering' || job.render_status === 'rendering') {
    return { canRender: false, reason: 'Render is already in progress for this job', status: 'already_rendering' };
  }

  // 2. Validate quote text exists
  if (!job.quote || typeof job.quote !== 'string' || job.quote.trim().length === 0) {
    return { canRender: false, reason: 'Job quote content is empty', status: 'invalid_quote' };
  }

  // 3. Validate duration bounds
  const dur = parseInt(job.duration || 15, 10);
  if (isNaN(dur) || dur < 5 || dur > 60) {
    return { canRender: false, reason: `Invalid duration: ${job.duration}s. Must be between 5 and 60 seconds.`, status: 'invalid_duration' };
  }

  // 4. Check validation status & Tamil quality
  const val = typeof job.validation === 'string' ? JSON.parse(job.validation || '{}') : (job.validation || {});

  if (val.tamilQuality?.requiresReview) {
    return {
      canRender: false,
      reason: `Tamil quality validation requires human review: ${val.tamilQuality.reviewReason || 'Linguistic quality uncertain'}`,
      status: 'requires_review',
    };
  }

  if (val.valid === false && (!val.issues || val.issues.length > 0)) {
    const issueList = (val.issues || []).join('; ');
    return {
      canRender: false,
      reason: `Content validation failed: ${issueList || 'Unspecified validation error'}`,
      status: 'validation_failed',
    };
  }

  return { canRender: true, duration: dur };
}

/**
 * Main Rendering function for a prepared Quote Video Job.
 *
 * @param {string} jobId - UUID of the quote_video_jobs record
 * @param {Object} [options] - Optional override flags (e.g. { force: boolean })
 * @returns {Promise<Object>} Render result with metadata and output path
 */
async function renderQuoteVideoJob(jobId, options = {}) {
  const job = getQuoteJobById(jobId);
  if (!job) {
    const err = new Error(`Quote video job not found: ${jobId}`);
    err.statusCode = 404;
    throw err;
  }

  // If already rendered and output file exists, return existing metadata unless force re-render requested
  if (job.renderStatus === 'rendered' && job.outputPath && fs.existsSync(job.outputPath) && !options.force) {
    const stats = fs.statSync(job.outputPath);
    return {
      jobId,
      workflowId: job.workflow_id,
      renderStatus: 'rendered',
      jobStatus: 'rendered',
      duration: job.duration,
      width: job.width || 1080,
      height: job.height || 1920,
      outputPath: job.outputPath,
      outputUrl: job.outputUrl || `/api/quote-video-jobs/${jobId}/video`,
      fileSize: stats.size,
      renderedAt: job.renderedAt,
      alreadyRendered: true,
    };
  }

  // Pre-render validation
  const validationCheck = validateJobForRender(job);
  if (!validationCheck.canRender) {
    const err = new Error(validationCheck.reason);
    err.statusCode = validationCheck.status === 'already_rendering' ? 409 : 422;
    err.renderStatus = validationCheck.status;

    // If requires_review, update db status accordingly
    if (validationCheck.status === 'requires_review') {
      try {
        db.prepare("UPDATE quote_video_jobs SET render_status = 'requires_review', job_status = 'requires_review', error_message = ?, updated_at = datetime('now') WHERE id = ?")
          .run(validationCheck.reason, jobId);
      } catch (_) {}
    }
    throw err;
  }

  const duration = validationCheck.duration || 15;
  const workflowId = job.workflow_id || 'manual-preview';

  // Set status to 'rendering'
  db.prepare("UPDATE quote_video_jobs SET render_status = 'rendering', job_status = 'rendering', error_message = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(jobId);

  // Setup storage and temp workspace
  const workflowStorageDir = path.join(STORAGE_BASE, 'quote-videos', workflowId);
  fs.mkdirSync(workflowStorageDir, { recursive: true });
  const finalOutputPath = path.join(workflowStorageDir, `${jobId}.mp4`);

  const tempDir = path.join(os.tmpdir(), `flowbox-render-${jobId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const bgPath = path.join(tempDir, 'bg.png');
  const quotePath = path.join(tempDir, 'quote.png');
  const explPath = path.join(tempDir, 'expl.png');

  try {
    // 1. Generate Visual Background Canvas
    const visualStrategy = job.visualStrategy || {};
    const topicMeta = job.spec?.topic || {};
    const bgCanvas = generateBackgroundCanvas(visualStrategy.style || 'dark_atmospheric', topicMeta);
    fs.writeFileSync(bgPath, bgCanvas.toBuffer('image/png'));

    // 2. Generate Quote Text Overlay Canvas
    const hasExplanation = !!(job.explanation && job.explanation.trim().length > 0);
    const { canvas: quoteCanvas, quoteBottomY } = createQuoteOverlayCanvas({
      quote: job.quote,
      topicLabel: topicMeta.label || job.topic,
      topicEmoji: topicMeta.emoji || '✨',
      language: job.language || 'en',
      hasExplanation,
    });
    fs.writeFileSync(quotePath, quoteCanvas.toBuffer('image/png'));

    // 3. Generate Explanation Overlay Canvas (if present)
    let explCanvas = null;
    if (hasExplanation) {
      explCanvas = createExplanationOverlayCanvas({
        explanation: job.explanation,
        quoteBottomY,
        language: job.language || 'en',
      });
      fs.writeFileSync(explPath, explCanvas.toBuffer('image/png'));
    }

    // 4. Resolve Audio Track
    const audioTrackPath = resolveApprovedAudio(job.audioStrategy || {});

    // 5. Construct FFmpeg Command
    // Inputs:
    // 0: bg.png (loop)
    // 1: quote.png (loop)
    // 2: expl.png (loop) [if explanation exists]
    // (next): audio track [if audio exists]
    const ffmpegArgs = ['-y'];

    ffmpegArgs.push('-loop', '1', '-i', bgPath);
    ffmpegArgs.push('-loop', '1', '-i', quotePath);

    let nextInputIdx = 2;
    let explInputIdx = null;

    if (hasExplanation) {
      ffmpegArgs.push('-loop', '1', '-i', explPath);
      explInputIdx = 2;
      nextInputIdx = 3;
    }

    let audioInputIdx = null;
    if (audioTrackPath) {
      ffmpegArgs.push('-i', audioTrackPath);
      audioInputIdx = nextInputIdx;
      nextInputIdx++;
    }

    // Timing parameters for animation:
    // Quote: fade in from 0.5s to 1.5s with upward drift, fade out at (duration - 1.2s)
    const quoteFadeInStart = 0.5;
    const quoteFadeInDur = 1.0;
    const fadeOutStart = Math.max(1.0, duration - 1.2);
    const fadeOutDur = 1.0;

    let filterComplex = '';

    // Quote filter
    filterComplex += `[1:v]format=rgba,fade=t=in:st=${quoteFadeInStart}:d=${quoteFadeInDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOutDur}:alpha=1[txt_q];`;

    if (hasExplanation) {
      const explFadeInStart = 2.4;
      const explFadeInDur = 1.0;
      filterComplex += `[${explInputIdx}:v]format=rgba,fade=t=in:st=${explFadeInStart}:d=${explFadeInDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOutDur}:alpha=1[txt_e];`;

      // Compose: Background + Quote + Explanation
      filterComplex += `[0:v][txt_q]overlay=0:'if(lt(t,${quoteFadeInStart + quoteFadeInDur}), 30 - 30*(t-${quoteFadeInStart})/${quoteFadeInDur}, 0)'[bg_q];`;
      filterComplex += `[bg_q][txt_e]overlay=0:'if(lt(t,${explFadeInStart + explFadeInDur}), 20 - 20*(t-${explFadeInStart})/${explFadeInDur}, 0)'[v_out]`;
    } else {
      filterComplex += `[0:v][txt_q]overlay=0:'if(lt(t,${quoteFadeInStart + quoteFadeInDur}), 30 - 30*(t-${quoteFadeInStart})/${quoteFadeInDur}, 0)'[v_out]`;
    }

    ffmpegArgs.push('-filter_complex', filterComplex);
    ffmpegArgs.push('-map', '[v_out]');

    // Audio mapping and trimming if audio track exists
    if (audioInputIdx !== null) {
      const audioFadeOutStart = Math.max(0.5, duration - 1.5);
      ffmpegArgs.push('-af', `afade=t=out:st=${audioFadeOutStart}:d=1.5`);
      ffmpegArgs.push('-map', `${audioInputIdx}:a`);
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
    }

    // Video encoding settings: H.264, 30fps, 1080x1920, yuv420p
    ffmpegArgs.push(
      '-t', String(duration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      finalOutputPath
    );

    // Run FFmpeg synchronously or with child process
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderrOutput = '';

      proc.stderr.on('data', (d) => {
        stderrOutput += d.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrOutput.slice(-500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
      });
    });

    // 6. Verify Output MP4 Exists & Non-Empty
    if (!fs.existsSync(finalOutputPath)) {
      throw new Error(`Rendered video file not found at expected location: ${finalOutputPath}`);
    }

    const fileStats = fs.statSync(finalOutputPath);
    if (fileStats.size < 1000) {
      throw new Error(`Rendered video file is suspiciously small or corrupted (${fileStats.size} bytes)`);
    }

    // 7. Verify via ffprobe
    let probeMetadata = { width: 1080, height: 1920, duration };
    try {
      const probeOut = execSync(
        `ffprobe -v error -show_entries stream=width,height,duration,codec_name -of json "${finalOutputPath}"`,
        { encoding: 'utf8' }
      );
      const probeJson = JSON.parse(probeOut);
      const videoStream = (probeJson.streams || []).find((s) => s.codec_name === 'h264' || s.width);
      if (videoStream) {
        probeMetadata.width = videoStream.width || 1080;
        probeMetadata.height = videoStream.height || 1920;
        probeMetadata.duration = parseFloat(videoStream.duration || duration);
      }
    } catch (probeErr) {
      console.warn('[videoRenderer] ffprobe check non-fatal error:', probeErr.message);
    }

    const outputUrl = `/api/quote-video-jobs/${jobId}/video`;

    // 8. Update SQLite Database
    db.prepare(`
      UPDATE quote_video_jobs SET
        render_status = 'rendered',
        job_status = 'rendered',
        rendered_at = datetime('now'),
        output_path = ?,
        output_url = ?,
        width = ?,
        height = ?,
        file_size = ?,
        error_message = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      finalOutputPath,
      outputUrl,
      probeMetadata.width,
      probeMetadata.height,
      fileStats.size,
      jobId
    );

    return {
      success: true,
      jobId,
      workflowId,
      renderStatus: 'rendered',
      jobStatus: 'rendered',
      renderedAt: new Date().toISOString(),
      duration: probeMetadata.duration,
      width: probeMetadata.width,
      height: probeMetadata.height,
      fileSize: fileStats.size,
      outputPath: finalOutputPath,
      outputUrl,
      hasAudio: !!audioTrackPath,
    };
  } catch (renderError) {
    console.error(`[videoRenderer] Failed to render job ${jobId}:`, renderError);

    // Update job status to 'render_failed'
    try {
      db.prepare(`
        UPDATE quote_video_jobs SET
          render_status = 'render_failed',
          job_status = 'render_failed',
          error_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(renderError.message, jobId);
    } catch (_) {}

    throw renderError;
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = {
  renderQuoteVideoJob,
  generateBackgroundCanvas,
  createQuoteOverlayCanvas,
  createExplanationOverlayCanvas,
  validateJobForRender,
  resolveApprovedAudio,
  STORAGE_BASE,
};
