/**
 * Video Preview & Approval System (Phase 5 Review Manager)
 *
 * Implements strict review workflows for Daily Quote Videos:
 * - Review states: not_rendered, rendering, ready_for_review, approved, regenerate_requested, render_failed
 * - Approve safety checks: prevents false approval when unrendered, failed, or in-flight
 * - Controlled regeneration: preserves version lineage (parent_job_id, version increment)
 *   without mutating or deleting old MP4s in history
 */

const fs = require('fs');
const db = require('../db');
const { getQuoteJobById, prepareDailyQuoteVideo } = require('./videoPreparation');
const { renderQuoteVideoJob } = require('./videoRenderer');
const { getOppositeLanguage } = require('./languageRotation');

/**
 * Approves a rendered quote video job after safety validation.
 *
 * @param {string} jobId - UUID of the quote video job
 * @param {Object} [options]
 * @param {string} [options.reviewedBy='user'] - Reviewer identifier
 * @returns {Object} Updated job record
 */
async function approveQuoteVideoJob(jobId, options = {}) {
  const job = getQuoteJobById(jobId);
  if (!job) {
    const err = new Error('Quote video job not found');
    err.statusCode = 404;
    throw err;
  }

  // 1. Safety Check: Is it currently rendering?
  if (job.renderStatus === 'rendering' || job.jobStatus === 'rendering') {
    const err = new Error('Video is still rendering. Please wait until rendering completes before approving.');
    err.statusCode = 400;
    err.reviewStatus = 'rendering';
    throw err;
  }

  // 2. Safety Check: Did render fail?
  if (job.renderStatus === 'render_failed' || job.jobStatus === 'render_failed') {
    const err = new Error('Video rendering failed. Please re-render or regenerate before approving.');
    err.statusCode = 400;
    err.reviewStatus = 'render_failed';
    throw err;
  }

  // 3. Safety Check: Has it been rendered and does the file physically exist on disk?
  if (job.renderStatus !== 'rendered' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    const err = new Error('Cannot approve video: video has not been rendered yet.');
    err.statusCode = 400;
    err.reviewStatus = 'not_rendered';
    throw err;
  }

  // 4. Update review status to approved
  const reviewedBy = options.reviewedBy || 'user';
  db.prepare(`
    UPDATE quote_video_jobs SET
      review_status = 'approved',
      reviewed_at = datetime('now'),
      reviewed_by = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(reviewedBy, jobId);

  const updatedJob = getQuoteJobById(jobId);
  return {
    success: true,
    message: 'Video approved successfully. Ready for the next publishing phase.',
    job: updatedJob,
  };
}

/**
 * Triggers a controlled regeneration for a quote video job.
 * Preserves the previous version in history and marks it as regenerate_requested.
 *
 * PRODUCT REQUIREMENTS:
 * 1. Must PRESERVE the current topic (never advance global topic rotation).
 * 2. Must ALTERNATE language independently for this topic ('ta' <-> 'en').
 * 3. Lineage tracking: parent_job_id = oldJob.id, version = oldJob.version + 1.
 *
 * @param {string} jobId - UUID of the existing job to regenerate from
 * @param {Object} [options]
 * @param {boolean} [options.autoRender=true] - Whether to immediately render the new version
 * @param {string} [options.reviewedBy='user']
 * @returns {Promise<Object>} The new quote video job and lineage metadata
 */
async function regenerateQuoteVideoJob(jobId, options = {}) {
  const oldJob = getQuoteJobById(jobId);
  if (!oldJob) {
    const err = new Error('Quote video job not found');
    err.statusCode = 404;
    throw err;
  }

  // 1. Mark existing job as regenerate_requested (preserving its history & MP4)
  db.prepare(`
    UPDATE quote_video_jobs SET
      review_status = 'regenerate_requested',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(jobId);

  // 2. Resolve workflow configuration
  let wfConfig = {};
  if (oldJob.workflow_id) {
    const wfRow = db.prepare('SELECT definition FROM workflows WHERE id = ?').get(oldJob.workflow_id);
    if (wfRow) {
      try {
        const def = JSON.parse(wfRow.definition || '{}');
        const qvNode = (def.nodes || []).find(
          (n) => n.type === 'quoteVideo' || n.config?.templateType === 'dailyQuoteVideo'
        );
        if (qvNode && qvNode.config) {
          wfConfig = qvNode.config;
        }
      } catch (_) {}
    }
  }

  // 3. Determine topic and language for regeneration:
  // - Topic MUST NOT change (preserved from oldJob)
  // - Language MUST alternate for this specific topic ('ta' <-> 'en')
  const targetTopic = oldJob.topic || 'motivation';
  const targetLanguage = getOppositeLanguage(oldJob.language);
  const nextVersion = (oldJob.version || 1) + 1;

  // 4. Prepare the new version with lineage tracking
  const newPrep = await prepareDailyQuoteVideo({
    workflowId: oldJob.workflow_id,
    config: wfConfig,
    options: {
      parentJobId: oldJob.id,
      version: nextVersion,
      topic: targetTopic,
      language: targetLanguage,
      duration: oldJob.duration || 15,
    },
  });

  let finalJob = getQuoteJobById(newPrep.jobId);

  // 4. Optionally render the newly prepared video immediately
  const shouldRender = options.autoRender !== false;
  if (shouldRender) {
    try {
      await renderQuoteVideoJob(newPrep.jobId);
      finalJob = getQuoteJobById(newPrep.jobId);
    } catch (renderErr) {
      console.warn(`[regenerateQuoteVideoJob] Auto-render failed for new job ${newPrep.jobId}:`, renderErr.message);
      finalJob = getQuoteJobById(newPrep.jobId);
    }
  }

  const updatedOldJob = getQuoteJobById(jobId);

  return {
    success: true,
    message: 'New version prepared successfully.',
    previousJobId: oldJob.id,
    previousJob: updatedOldJob,
    job: finalJob,
  };
}

module.exports = {
  approveQuoteVideoJob,
  regenerateQuoteVideoJob,
};
