/**
 * Video Rendering Engine for Daily Quote Video (Phase 4 Cinematic Visual Engine)
 *
 * Consumes the Video Preparation Specification and renders a real 9:16 vertical MP4
 * (1080x1920, 30fps, H.264, AAC when audio present, yuv420p) using FFmpeg,
 * procedural canvas generation, and topic-aware cinematic visual profiles.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const db = require('../db');
const { getQuoteJobById } = require('./videoPreparation');

// Import Phase 4 Visual Subsystem
const visual = require('./visual');
const {
  resolveTopicVisualProfile,
  renderProceduralBackground,
  createQuoteOverlayCanvas: renderQuoteCanvas,
  createExplanationOverlayCanvas: renderExplanationCanvas,
  buildFilterComplex,
  prepareVisualComposition,
} = visual;

// Base storage directory
const STORAGE_BASE = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(__dirname, '../../storage');

/**
 * Backward-compatible helper for legacy test calls.
 */
function generateBackgroundCanvas(style = 'dark_atmospheric', topicMeta = {}) {
  const profile = resolveTopicVisualProfile({
    topic: topicMeta.id || topicMeta.topic || 'motivation',
    visualStyle: style,
  });
  return renderProceduralBackground(profile, { width: 1080, height: 1920 });
}

/**
 * Backward-compatible helper for legacy test calls.
 */
function createQuoteOverlayCanvas(params) {
  const profile = params.profile || resolveTopicVisualProfile({
    topic: params.topicLabel || 'motivation',
    language: params.language,
  });
  const res = renderQuoteCanvas({
    quote: params.quote,
    profile,
    language: params.language,
    hasExplanation: params.hasExplanation,
  });
  return { canvas: res.canvas, quoteBottomY: res.quoteBottomY };
}

/**
 * Backward-compatible helper for legacy test calls.
 */
function createExplanationOverlayCanvas(params) {
  const profile = params.profile || resolveTopicVisualProfile({
    language: params.language,
  });
  return renderExplanationCanvas({
    explanation: params.explanation,
    quoteBottomY: params.quoteBottomY,
    profile,
    language: params.language,
  });
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
 * @param {Object} [options] - Optional override flags (e.g. { force: boolean, visualStyle: string })
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
  db.prepare("UPDATE quote_video_jobs SET render_status = 'rendering', job_status = 'rendering', review_status = 'rendering', error_message = NULL, updated_at = datetime('now') WHERE id = ?")
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
    // 1. Prepare Complete Phase 4 Visual Composition Plan
    const renderPlan = prepareVisualComposition(job, options);
    const profile = renderPlan.profile;
    const hasExplanation = renderPlan.hasExplanation;
    const hasBgMotion = profile.motion?.driftPx > 0;

    // 2. Generate Visual Background Canvas
    // If background motion enabled, render 1140x2026 canvas to allow FFmpeg smooth camera drift
    const bgDims = hasBgMotion ? { width: 1140, height: 2026 } : { width: 1080, height: 1920 };
    const bgCanvas = renderProceduralBackground(profile, bgDims);
    fs.writeFileSync(bgPath, bgCanvas.toBuffer('image/png'));

    // 3. Generate Quote Text Overlay Canvas
    const quoteRes = renderQuoteCanvas({
      quote: job.quote,
      profile,
      language: job.language || 'en',
      hasExplanation,
    });
    fs.writeFileSync(quotePath, quoteRes.canvas.toBuffer('image/png'));

    // 4. Generate Explanation Overlay Canvas (if present)
    let explCanvas = null;
    if (hasExplanation) {
      explCanvas = renderExplanationCanvas({
        explanation: job.explanation,
        quoteBottomY: quoteRes.quoteBottomY,
        profile,
        language: job.language || 'en',
      });
      fs.writeFileSync(explPath, explCanvas.toBuffer('image/png'));
    }

    // 5. Resolve Audio Track (Approved Ambient Library)
    const audioTrackPath = resolveApprovedAudio(job.audioStrategy || {});

    // 6. Construct FFmpeg Command
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

    // Generate Duration-Aware Cinematic Filter Complex
    const filterComplex = buildFilterComplex({
      timing: renderPlan.timing,
      hasExplanation,
      enableBgMotion: hasBgMotion,
    });

    ffmpegArgs.push('-filter_complex', filterComplex);
    ffmpegArgs.push('-map', '[v_out]');

    // Audio mapping and trimming if audio track exists with fade-in and fade-out
    if (audioInputIdx !== null) {
      const audioFade = renderPlan.audioFade;
      ffmpegArgs.push(
        '-af',
        `afade=t=in:st=0:d=${audioFade.fadeInDur},afade=t=out:st=${audioFade.fadeOutStart}:d=${audioFade.fadeOutDur}`
      );
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

    // 7. Verify Output MP4 Exists & Non-Empty
    if (!fs.existsSync(finalOutputPath)) {
      throw new Error(`Rendered video file not found at expected location: ${finalOutputPath}`);
    }

    const fileStats = fs.statSync(finalOutputPath);
    if (fileStats.size < 1000) {
      throw new Error(`Rendered video file is suspiciously small or corrupted (${fileStats.size} bytes)`);
    }

    // 8. Verify via ffprobe
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

    // 9. Update SQLite Database with Enhanced Visual Strategy Metadata
    const updatedStrategy = {
      ...(job.visualStrategy || {}),
      style: profile.derivedStyle,
      visualTitle: profile.visualTitle,
      backgroundType: profile.backgroundType,
      topicProfile: profile.id,
      motion: profile.motion?.type || 'static',
      safeArea: renderPlan.safeArea,
    };

    db.prepare(`
      UPDATE quote_video_jobs SET
        render_status = 'rendered',
        job_status = 'rendered',
        review_status = 'ready_for_review',
        rendered_at = datetime('now'),
        visual_strategy = ?,
        output_path = ?,
        output_url = ?,
        width = ?,
        height = ?,
        file_size = ?,
        error_message = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(updatedStrategy),
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
      reviewStatus: 'ready_for_review',
      visualTitle: profile.visualTitle,
      visualStrategy: updatedStrategy,
      renderedAt: new Date().toISOString(),
      duration: probeMetadata.duration,
      width: probeMetadata.width,
      height: probeMetadata.height,
      fileSize: fileStats.size,
      outputPath: finalOutputPath,
      outputUrl,
      videoUrl: outputUrl,
      hasAudio: !!audioTrackPath,
      renderPlan,
    };
  } catch (renderError) {
    console.error(`[videoRenderer] Failed to render job ${jobId}:`, renderError);

    // Update job status to 'render_failed'
    try {
      db.prepare(`
        UPDATE quote_video_jobs SET
          render_status = 'render_failed',
          job_status = 'render_failed',
          review_status = 'render_failed',
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
  prepareVisualComposition,
  STORAGE_BASE,
};
