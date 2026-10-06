/**
 * FLOWBOX — PHASE 5 TEST SUITE: VIDEO PREVIEW + APPROVAL SYSTEM
 *
 * Verifies:
 * 1. Not rendered state: reviewStatus is 'not_rendered'
 * 2. Rendered video -> ready_for_review
 * 3. Valid approval: reviewStatus -> 'approved', reviewed_at timestamp set
 * 4. Approval blocked without video: rejects with HTTP 400
 * 5. Approval blocked while rendering: rejects with HTTP 400
 * 6. Approval blocked after render failure: rejects with HTTP 400
 * 7. Regeneration flow: triggers new version
 * 8. Old version preserved: old job remains in DB and old MP4 remains on disk
 * 9. New version becomes current candidate: version=2, parent_job_id set
 * 10. Video playback URL still works: HTTP range streaming returns 200/206
 * 11. Existing Phase 3 renderer compatibility
 * 12. Existing Phase 4 visual enhancement compatibility
 *
 * Safety: Uses isolated test workflow 'phase3-test-workflow'.
 * Production workflow e1365ac8-e429-4ef9-92f5-cb4a8979aaeb remains untouched.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('./src/db');

const API_BASE = 'http://localhost:4000';
const HEADERS = {
  Authorization: 'Bearer dev-local-user',
  'Content-Type': 'application/json',
};

const TEST_WORKFLOW_ID = 'phase3-test-workflow';
const PROD_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase5Tests() {
  console.log('\n==================================================');
  console.log('STARTING FLOWBOX PHASE 5 TEST SUITE');
  console.log('==================================================\n');

  // Verify production workflow safety first
  console.log('--- PRODUCTION SAFETY CHECK ---');
  const prodWf = db.prepare('SELECT id, name, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(prodWf !== undefined, 'Production workflow e1365ac8-e429-4ef9-92f5-cb4a8979aaeb exists');
  assert(prodWf.active === 1, 'Production workflow active is 1 (true)');
  const parsedDef = JSON.parse(prodWf.definition);
  const scheduleNode = parsedDef.nodes?.find((n) => n.type === 'scheduleTrigger' || n.type === 'schedule');
  const prodCron = scheduleNode?.config?.cron;
  assert(prodCron === '0 19 * * *', `Production workflow schedule is 0 19 * * * (got: ${prodCron})`);
  console.log('Production workflow is safe and intact.\n');

  // Test 1: Not rendered state
  console.log('--- TEST 1: Not rendered state ---');
  const prepRes = await axios.post(`${API_BASE}/api/workflows/${TEST_WORKFLOW_ID}/prepare-quote`, {}, { headers: HEADERS });
  const prepJob = prepRes.data;
  const jobId = prepJob.jobId || prepJob.id;
  assert(jobId !== undefined, `Preparation job created with ID: ${jobId}`);
  assert(prepJob.renderStatus === 'not_rendered', `renderStatus is not_rendered (got: ${prepJob.renderStatus})`);
  assert(prepJob.reviewStatus === 'not_rendered', `reviewStatus is not_rendered (got: ${prepJob.reviewStatus})`);

  // Test 4: Approval blocked without video
  console.log('\n--- TEST 4: Approval blocked without video ---');
  let blockedNoVideo = false;
  try {
    await axios.post(`${API_BASE}/api/quote-video-jobs/${jobId}/approve`, {}, { headers: HEADERS });
  } catch (err) {
    if (err.response && err.response.status === 400) {
      blockedNoVideo = true;
    }
  }
  assert(blockedNoVideo, 'Approval rejected with HTTP 400 when video has not been rendered');

  // Test 5: Approval blocked while rendering
  console.log('\n--- TEST 5: Approval blocked while rendering ---');
  // Temporarily set render_status = 'rendering' in DB to test guard
  db.prepare("UPDATE quote_video_jobs SET render_status = 'rendering', review_status = 'rendering' WHERE id = ?").run(jobId);
  let blockedRendering = false;
  try {
    await axios.post(`${API_BASE}/api/quote-video-jobs/${jobId}/approve`, {}, { headers: HEADERS });
  } catch (err) {
    if (err.response && err.response.status === 400) {
      blockedRendering = true;
    }
  }
  assert(blockedRendering, 'Approval rejected with HTTP 400 when status is rendering');

  // Test 6: Approval blocked after render failure
  console.log('\n--- TEST 6: Approval blocked after render failure ---');
  // Temporarily set render_status = 'render_failed', review_status = 'render_failed' in DB to test guard
  db.prepare("UPDATE quote_video_jobs SET render_status = 'render_failed', review_status = 'render_failed' WHERE id = ?").run(jobId);
  let blockedFailed = false;
  try {
    await axios.post(`${API_BASE}/api/quote-video-jobs/${jobId}/approve`, {}, { headers: HEADERS });
  } catch (err) {
    if (err.response && err.response.status === 400) {
      blockedFailed = true;
    }
  }
  assert(blockedFailed, 'Approval rejected with HTTP 400 when status is render_failed');

  // Reset back to not_rendered
  db.prepare("UPDATE quote_video_jobs SET render_status = 'not_rendered', review_status = 'not_rendered' WHERE id = ?").run(jobId);

  // Test 2: Rendered video -> ready_for_review
  console.log('\n--- TEST 2: Rendered video -> ready_for_review ---');
  console.log(`Rendering video for job ${jobId}...`);
  const renderRes = await axios.post(`${API_BASE}/api/workflows/${TEST_WORKFLOW_ID}/quote-jobs/${jobId}/render`, {}, { headers: HEADERS });
  const renderedJob = renderRes.data;
  assert(renderedJob.renderStatus === 'rendered', `renderStatus is rendered (got: ${renderedJob.renderStatus})`);
  assert(renderedJob.reviewStatus === 'ready_for_review', `reviewStatus transitioned to ready_for_review (got: ${renderedJob.reviewStatus})`);
  assert(renderedJob.videoUrl !== undefined || renderedJob.outputUrl !== undefined, 'videoUrl or outputUrl is present');
  assert(fs.existsSync(renderedJob.outputPath), `Video file physically exists at ${renderedJob.outputPath}`);
  const oldOutputPath = renderedJob.outputPath;

  // Test 10: Video playback URL still works via HTTP Range streaming
  console.log('\n--- TEST 10: Video playback URL streaming ---');
  const streamRes = await axios.get(`${API_BASE}/api/quote-video-jobs/${jobId}/video`, {
    headers: { ...HEADERS, Range: 'bytes=0-1024' },
    validateStatus: (status) => status === 200 || status === 206,
  });
  assert(streamRes.status === 206 || streamRes.status === 200, `Video stream returned HTTP ${streamRes.status}`);
  assert(streamRes.headers['content-type'] === 'video/mp4', `Content-Type is video/mp4 (got: ${streamRes.headers['content-type']})`);

  // Test 3: Valid approval
  console.log('\n--- TEST 3: Valid approval ---');
  const approveRes = await axios.post(`${API_BASE}/api/quote-video-jobs/${jobId}/approve`, {
    reviewedBy: 'dev-reviewer',
  }, { headers: HEADERS });
  const approvedJob = approveRes.data.job;
  assert(approvedJob.reviewStatus === 'approved', `reviewStatus is approved (got: ${approvedJob.reviewStatus})`);
  assert(approvedJob.reviewedAt !== null, `reviewedAt timestamp is recorded (got: ${approvedJob.reviewedAt})`);
  assert(approvedJob.reviewedBy === 'dev-reviewer', `reviewedBy is recorded (got: ${approvedJob.reviewedBy})`);

  // Verify DB state for approved job
  const approvedRow = db.prepare('SELECT review_status, reviewed_at, reviewed_by FROM quote_video_jobs WHERE id = ?').get(jobId);
  assert(approvedRow.review_status === 'approved', 'DB review_status is approved');
  assert(approvedRow.reviewed_at !== null, 'DB reviewed_at is not null');

  // Test 7 & 8 & 9: Regeneration flow, old version preserved, new candidate created
  console.log('\n--- TEST 7, 8, 9: Regeneration flow ---');
  const regenRes = await axios.post(`${API_BASE}/api/quote-video-jobs/${jobId}/regenerate`, {
    reviewedBy: 'dev-reviewer',
  }, { headers: HEADERS });
  const regenData = regenRes.data;
  assert(regenData.success === true, 'Regeneration API returned success');
  const newJob = regenData.job;
  assert(newJob.id !== jobId, `New job ID generated (${newJob.id} !== ${jobId})`);
  assert(newJob.version === 2, `New job version incremented to 2 (got: ${newJob.version})`);
  assert(newJob.parentJobId === jobId, `New job parentJobId links to old job (got: ${newJob.parentJobId})`);
  assert(newJob.topic === prepJob.topic, `Topic preserved on regeneration (${newJob.topic} === ${prepJob.topic})`);
  const expectedLang = (prepJob.language === 'ta' || prepJob.language === 'tamil') ? 'en' : 'ta';
  assert(newJob.language === expectedLang, `Language alternated on regeneration (${newJob.language} === ${expectedLang})`);
  assert(newJob.renderStatus === 'rendered', `New job rendered automatically`);
  assert(newJob.reviewStatus === 'ready_for_review', `New job reviewStatus is ready_for_review`);
  assert(fs.existsSync(newJob.outputPath), `New MP4 video exists at ${newJob.outputPath}`);

  // Test 8: Old version preserved
  console.log('\n--- TEST 8: Old version preserved check ---');
  const oldRow = db.prepare('SELECT id, render_status, review_status, output_path, version FROM quote_video_jobs WHERE id = ?').get(jobId);
  assert(oldRow !== undefined, 'Old job record still exists in database');
  assert(oldRow.review_status === 'regenerate_requested', `Old job marked as regenerate_requested (got: ${oldRow.review_status})`);
  assert(fs.existsSync(oldOutputPath), `Old MP4 video file still exists at ${oldOutputPath}`);

  // Verify GET /api/quote-video-jobs/:jobId endpoint returns full review metadata
  console.log('\n--- VERIFY GET /api/quote-video-jobs/:jobId ---');
  const getJobRes = await axios.get(`${API_BASE}/api/quote-video-jobs/${newJob.id}`, { headers: HEADERS });
  const fetchedJob = getJobRes.data.job;
  assert(fetchedJob.id === newJob.id, 'Fetched correct job ID');
  assert(fetchedJob.reviewStatus === 'ready_for_review', 'Fetched job reviewStatus matches');
  assert(fetchedJob.version === 2, 'Fetched job version is 2');
  assert(fetchedJob.parentJobId === jobId, `Fetched job parentJobId matches (${fetchedJob.parentJobId} === ${jobId})`);

  // Verify workflow latest quote job returns the new candidate
  const latestRes = await axios.get(`${API_BASE}/api/workflows/${TEST_WORKFLOW_ID}/quote-jobs/latest`, { headers: HEADERS });
  assert(latestRes.data.job.id === newJob.id, `Workflow latest quote job is the new version candidate (${latestRes.data.job.id})`);

  // Final check on production workflow
  console.log('\n--- FINAL PRODUCTION SAFETY CHECK ---');
  const finalProd = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(finalProd.active === 1, 'Production workflow is still active=1');
  const finalDef = JSON.parse(finalProd.definition);
  const finalCron = finalDef.nodes?.find((n) => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(finalCron === '0 19 * * *', 'Production workflow schedule is still 0 19 * * *');

  console.log('\n==================================================');
  console.log(`PHASE 5 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err.message);
  if (err.response?.data) {
    console.error('Server response data:', err.response.data);
  }
  process.exit(1);
});
