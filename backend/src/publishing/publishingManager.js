const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const { getQuoteJobById } = require('../contentEngine/videoPreparation');
const InstagramProvider = require('./providers/instagramProvider');
const YouTubeProvider = require('./providers/youtubeProvider');
const { PUBLISH_STATUS, PLATFORMS, normalizePlatform } = require('./types');

// Registered Provider Instances
const providers = {
  [PLATFORMS.INSTAGRAM]: new InstagramProvider(),
  [PLATFORMS.YOUTUBE]: new YouTubeProvider(),
};

/**
 * Returns current configuration status for all publishing providers.
 */
function getPublishingConfiguration() {
  const instagramConfigured = providers[PLATFORMS.INSTAGRAM].isConfigured();
  const youtubeConfigured = providers[PLATFORMS.YOUTUBE].isConfigured();
  const isSimulated = process.env.PUBLISHING_SIMULATED === 'true';

  return {
    isConfigured: instagramConfigured || youtubeConfigured,
    instagramConfigured,
    youtubeConfigured,
    isSimulated,
  };
}

/**
 * Fetches all publication records for a specific quote video job.
 */
function getJobPublications(jobId) {
  if (!jobId) return [];
  const rows = db
    .prepare('SELECT * FROM quote_video_publications WHERE job_id = ? ORDER BY created_at ASC')
    .all(jobId);
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    platform: r.platform,
    status: r.status,
    externalPostId: r.external_post_id,
    externalUrl: r.external_url,
    publishedAt: r.published_at,
    errorMessage: r.error_message,
    error: r.error_message,
    success: r.status === 'published' || r.status === 'simulated',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Publishes an approved quote video job to specified platforms.
 *
 * NON-NEGOTIABLE SAFETY RULES:
 * 1. Only jobs with review_status === 'approved' can be published.
 * 2. Never publish unrendered, rendering, ready_for_review, or regenerate_requested jobs.
 * 3. Never duplicate-publish if already successfully published on a platform.
 * 4. Treat each platform independently.
 *
 * @param {string} jobId - UUID of the quote video job
 * @param {Object} [options]
 * @param {string[]} [options.platforms] - Optional subset of platforms to publish to
 * @param {Object} [options.credentials] - Optional override credentials
 * @returns {Promise<Object>}
 */
async function publishQuoteVideoJob(jobId, options = {}) {
  const job = getQuoteJobById(jobId);
  if (!job) {
    const err = new Error('Quote video job not found');
    err.statusCode = 404;
    throw err;
  }

  // RULE 1: STRICT APPROVAL SAFETY CHECK
  const isApproved = job.reviewStatus === 'approved' || job.review_status === 'approved';
  if (!isApproved) {
    const currentStatus = job.reviewStatus || job.review_status || 'unknown';
    const err = new Error(
      `Only approved quote videos can be published. Current review_status is "${currentStatus}".`
    );
    err.statusCode = 400;
    err.reviewStatus = currentStatus;
    throw err;
  }

  // RULE 2: Rendered MP4 verification
  if (job.renderStatus !== 'rendered' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    const err = new Error('Quote video must be rendered with an existing MP4 before publishing.');
    err.statusCode = 400;
    throw err;
  }

  // Resolve target platforms
  let targetPlatforms = options.platforms || job.platforms || [PLATFORMS.INSTAGRAM, PLATFORMS.YOUTUBE];
  if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    targetPlatforms = [PLATFORMS.INSTAGRAM, PLATFORMS.YOUTUBE];
  }

  // Normalize platform names and filter duplicates
  const normalizedPlatforms = Array.from(
    new Set(
      targetPlatforms
        .map(normalizePlatform)
        .filter((p) => p === PLATFORMS.INSTAGRAM || p === PLATFORMS.YOUTUBE)
    )
  );

  if (normalizedPlatforms.length === 0) {
    const err = new Error('No valid publishing platforms specified.');
    err.statusCode = 400;
    throw err;
  }

  // Set job state to publishing
  db.prepare(`
    UPDATE quote_video_jobs SET
      publish_status = 'publishing',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(jobId);

  const publicationResults = [];

  for (const platform of normalizedPlatforms) {
    const provider = providers[platform];
    if (!provider) continue;

    // RULE 3: RETRY SAFETY / DUPLICATE PROTECTION
    const existingPub = db
      .prepare(
        "SELECT * FROM quote_video_publications WHERE job_id = ? AND platform = ? AND status = 'published' LIMIT 1"
      )
      .get(jobId, platform);

    if (existingPub) {
      publicationResults.push({
        success: false,
        platform,
        status: PUBLISH_STATUS.PUBLISHED,
        alreadyPublished: true,
        externalPostId: existingPub.external_post_id,
        url: existingPub.external_url,
        publishedAt: existingPub.published_at,
        error: 'Already published.',
      });
      continue;
    }

    // Call platform provider
    let result;
    try {
      result = await provider.publishQuoteVideo(job, options.credentials || {});
    } catch (providerErr) {
      result = {
        success: false,
        platform,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: providerErr.message,
      };
    }

    // Persist platform result to quote_video_publications
    const pubId = crypto.randomUUID();
    const pubStatus = result.status || (result.success ? PUBLISH_STATUS.PUBLISHED : PUBLISH_STATUS.PUBLISH_FAILED);

    db.prepare(`
      INSERT INTO quote_video_publications (
        id, job_id, platform, status, external_post_id, external_url, published_at, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      pubId,
      jobId,
      platform,
      pubStatus,
      result.externalPostId || null,
      result.url || null,
      result.publishedAt || (result.success ? new Date().toISOString() : null),
      result.error || null
    );

    publicationResults.push({
      id: pubId,
      jobId,
      errorMessage: result.error || null,
      ...result,
      error: result.error || null,
      success: result.status === PUBLISH_STATUS.PUBLISHED || result.status === PUBLISH_STATUS.SIMULATED || result.success === true,
    });
  }

  // Calculate overall job publish status across all platforms for this job
  const allJobPubs = getJobPublications(jobId);
  const latestByPlatform = new Map();
  for (const pub of allJobPubs) {
    latestByPlatform.set(pub.platform, pub);
  }
  const latestPubs = Array.from(latestByPlatform.values());

  const anyPublished = latestPubs.some((r) => r.status === PUBLISH_STATUS.PUBLISHED);
  const anySimulated = latestPubs.some((r) => r.status === PUBLISH_STATUS.SIMULATED);
  const allFailed = latestPubs.length > 0 && latestPubs.every((r) => r.status === PUBLISH_STATUS.PUBLISH_FAILED);

  let finalJobPublishStatus = PUBLISH_STATUS.NOT_SCHEDULED;
  let finalPublishError = null;
  let finalPublishedAt = null;

  if (anyPublished) {
    finalJobPublishStatus = PUBLISH_STATUS.PUBLISHED;
    finalPublishedAt = new Date().toISOString();
    const failures = latestPubs.filter((r) => r.status === PUBLISH_STATUS.PUBLISH_FAILED);
    if (failures.length > 0) {
      finalPublishError = failures.map((f) => `${f.platform}: ${f.error || f.errorMessage}`).join(' | ');
    }
  } else if (anySimulated) {
    finalJobPublishStatus = PUBLISH_STATUS.SIMULATED;
    finalPublishedAt = new Date().toISOString();
  } else if (allFailed) {
    finalJobPublishStatus = PUBLISH_STATUS.PUBLISH_FAILED;
    finalPublishError = latestPubs.map((f) => `${f.platform}: ${f.error || f.errorMessage}`).join(' | ');
  }

  db.prepare(`
    UPDATE quote_video_jobs SET
      publish_status = ?,
      published_at = COALESCE(?, published_at),
      publish_error = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(finalJobPublishStatus, finalPublishedAt, finalPublishError, jobId);

  const updatedJob = getQuoteJobById(jobId);

  return {
    success: anyPublished || anySimulated,
    jobId,
    publishStatus: finalJobPublishStatus,
    publications: publicationResults,
    job: updatedJob,
  };
}

/**
 * Scheduler Integration: Finds the latest approved quote video job for a workflow and publishes it.
 * If no approved job exists, logs safely and does not publish.
 */
async function publishScheduledApprovedJob(workflowId, options = {}) {
  if (!workflowId) return null;

  // 1. Find latest eligible APPROVED job
  const jobRow = db
    .prepare(`
      SELECT id FROM quote_video_jobs
      WHERE workflow_id = ?
        AND review_status = 'approved'
        AND (publish_status IS NULL OR publish_status NOT IN ('published', 'publishing'))
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `)
    .get(workflowId);

  if (!jobRow) {
    console.log(`[scheduler] No approved quote video available for publishing on workflow ${workflowId}.`);
    return {
      success: false,
      published: false,
      message: 'No approved quote video available for publishing.',
    };
  }

  // 2. Publish the approved job
  console.log(`[scheduler] Found approved quote video job ${jobRow.id} for workflow ${workflowId}. Proceeding with publishing...`);
  return await publishQuoteVideoJob(jobRow.id, options);
}

module.exports = {
  getPublishingConfiguration,
  getJobPublications,
  publishQuoteVideoJob,
  publishScheduledApprovedJob,
  providers,
};
