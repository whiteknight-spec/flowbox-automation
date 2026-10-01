const express = require('express');
const fs = require('fs');
const path = require('path');
const { getQuoteJobById, renderQuoteVideoJob, STORAGE_BASE } = require('../contentEngine');

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

module.exports = {
  router,
  streamVideoFile,
};
