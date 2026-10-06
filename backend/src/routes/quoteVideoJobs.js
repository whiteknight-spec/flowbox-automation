const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  getQuoteJobById,
  renderQuoteVideoJob,
  approveQuoteVideoJob,
  regenerateQuoteVideoJob,
  STORAGE_BASE,
} = require('../contentEngine');
const {
  publishQuoteVideoJob,
  getJobPublications,
  getPublishingConfiguration,
} = require('../publishing');

const router = express.Router();

/**
 * Safely streams a video file supporting HTTP Range requests.
 */
function streamVideoFile(filePath, req, res) {
  // Ensure the target file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found on disk' });
  }

  // Ensure path is inside STORAGE_BASE
  const resolvedPath = path.resolve(filePath);
  const resolvedStorage = path.resolve(STORAGE_BASE);
  if (!resolvedPath.startsWith(resolvedStorage)) {
    return res.status(403).json({ error: 'Forbidden: Access outside storage directory' });
  }

  const stat = fs.statSync(resolvedPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(resolvedPath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize,
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
    });
    fs.createReadStream(resolvedPath).pipe(res);
  }
}

/**
 * GET /api/quote-video-jobs/:jobId
 * Fetches the job status and metadata.
 */
router.get('/:jobId', (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Quote video job not found' });
  res.json({ job });
});

/**
 * POST /api/quote-video-jobs/:jobId/render
 * Renders the prepared quote video job into a real MP4.
 */
router.post('/:jobId/render', async (req, res) => {
  try {
    const result = await renderQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[render API] Failed rendering job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || (err.renderStatus === 'requires_review' ? 422 : 500);
    res.status(status).json({
      error: 'Render failed',
      renderStatus: err.renderStatus || 'render_failed',
      details: err.message,
    });
  }
});

/**
 * POST /api/quote-video-jobs/:jobId/approve
 * Approves a rendered quote video job after safety verification.
 */
router.post('/:jobId/approve', async (req, res) => {
  try {
    const result = await approveQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[approve API] Failed approving job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 400;
    res.status(status).json({
      error: 'Approval failed',
      reviewStatus: err.reviewStatus,
      message: err.message,
    });
  }
});

/**
 * POST /api/quote-video-jobs/:jobId/regenerate
 * Triggers a controlled regeneration for a quote video job, preserving history.
 */
router.post('/:jobId/regenerate', async (req, res) => {
  try {
    const result = await regenerateQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[regenerate API] Failed regenerating job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 500;
    res.status(status).json({
      error: 'Regeneration failed',
      message: err.message,
    });
  }
});

/**
 * GET /api/quote-video-jobs/:jobId/video
 * Streams the rendered MP4 video.
 */
router.get('/:jobId/video', (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Quote video job not found' });

  if (job.renderStatus !== 'rendered' || !job.outputPath) {
    return res.status(400).json({
      error: 'Video has not been rendered yet',
      renderStatus: job.renderStatus,
    });
  }

  streamVideoFile(job.outputPath, req, res);
});

/**
 * GET /api/quote-video-jobs/publishing/status
 * Returns current configuration status for publishing providers.
 */
router.get('/publishing/status', (req, res) => {
  const config = getPublishingConfiguration();
  res.json(config);
});

/**
 * POST /api/quote-video-jobs/:jobId/publish
 * Publishes an approved quote video job to social platforms.
 */
router.post('/:jobId/publish', async (req, res) => {
  try {
    const result = await publishQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[publish API] Failed publishing job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 400;
    res.status(status).json({
      error: 'Publishing failed',
      reviewStatus: err.reviewStatus,
      message: err.message,
    });
  }
});

/**
 * GET /api/quote-video-jobs/:jobId/publications
 * Retrieves multi-platform publication records and history for a job.
 */
router.get('/:jobId/publications', (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Quote video job not found' });
  const publications = getJobPublications(req.params.jobId);
  res.json({
    jobId: req.params.jobId,
    publishStatus: job.publishStatus,
    publishedAt: job.publishedAt,
    publishError: job.publishError,
    publications,
  });
});

module.exports = {
  router,
  streamVideoFile,
};
