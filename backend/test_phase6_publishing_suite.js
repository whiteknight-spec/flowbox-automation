const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  renderQuoteVideoJob,
  approveQuoteVideoJob,
  getQuoteJobById,
} = require('./src/contentEngine');
const {
  publishQuoteVideoJob,
  getJobPublications,
  publishScheduledApprovedJob,
  getPublishingConfiguration,
  InstagramProvider,
  YouTubeProvider,
  PLATFORMS,
  PUBLISH_STATUS,
} = require('./src/publishing');

const PROD_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';
const TEST_WORKFLOW_ID = 'phase6-test-workflow';

async function runPublishingTests() {
  console.log('====================================================');
  console.log('STARTING FLOWBOX PHASE 6: PUBLISHING / DELIVERY FOUNDATION SUITE');
  console.log('====================================================');

  // 1. Initial Production Safety Check
  console.log('\n--- PRODUCTION SAFETY CHECK ---');
  const prodWf = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(prodWf, `Production workflow ${PROD_WORKFLOW_ID} exists`);
  assert(prodWf.active === 1, 'Production workflow is active (1)');
  const prodDef = JSON.parse(prodWf.definition || '{}');
  const prodSchedule = prodDef.nodes?.find(n => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(prodSchedule === '0 19 * * *', `Production schedule is 0 19 * * * (got: ${prodSchedule})`);
  const initialJobCount = db.prepare('SELECT count(*) as count FROM quote_video_jobs').get().count;
  console.log(`✅ PASSED: Production workflow safe. (Total existing jobs in DB: ${initialJobCount})`);

  // Setup test workflow
  db.prepare(`
    INSERT OR REPLACE INTO workflows (id, name, definition, active, updated_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `).run(
    TEST_WORKFLOW_ID,
    'Phase 6 Test Workflow',
    JSON.stringify({
      nodes: [
        {
          id: 'qv-node',
          type: 'quoteVideo',
          config: {
            templateType: 'dailyQuoteVideo',
            topic: 'motivation',
            duration: 10,
            platforms: ['instagram', 'youtube'],
          },
        },
      ],
      edges: [],
    })
  );

  // --- REQUIREMENT 1: Unapproved job CANNOT publish ---
  console.log('\n--- TEST 1: Unapproved Job Blocked from Publishing ---');
  const prep = await prepareDailyQuoteVideo({
    workflowId: TEST_WORKFLOW_ID,
    config: { templateType: 'dailyQuoteVideo', topic: 'motivation', duration: 10 },
  });
  assert(prep && prep.jobId, 'Preparation job created');

  // Test 1a: not_rendered cannot publish
  let unapprovedRejected = false;
  try {
    await publishQuoteVideoJob(prep.jobId);
  } catch (err) {
    unapprovedRejected = true;
    assert(err.statusCode === 400, `Rejected with 400 (got: ${err.statusCode})`);
    assert(err.message.includes('Only approved quote videos can be published'), 'Error states only approved jobs can publish');
  }
  assert(unapprovedRejected, 'Unrendered/unapproved job publishing strictly blocked');
  console.log('✅ PASSED: Unrendered unapproved job blocked from publishing.');

  // Render the job -> review_status becomes 'ready_for_review'
  await renderQuoteVideoJob(prep.jobId);
  const readyJob = getQuoteJobById(prep.jobId);
  assert(readyJob.reviewStatus === 'ready_for_review', 'Job reviewStatus is ready_for_review');

  // Test 1b: ready_for_review cannot publish
  let readyForReviewRejected = false;
  try {
    await publishQuoteVideoJob(prep.jobId);
  } catch (err) {
    readyForReviewRejected = true;
    assert(err.statusCode === 400, 'Rejected with 400');
    assert(err.message.includes('Only approved quote videos can be published'), 'Error specifies approval required');
  }
  assert(readyForReviewRejected, 'ready_for_review job publishing strictly blocked');
  console.log('✅ PASSED: ready_for_review job strictly blocked from publishing.');

  // --- REQUIREMENT 2 & 7: Missing credentials report unconfigured (Never fake success) ---
  console.log('\n--- TEST 2 & 7: Missing Credentials Report Unconfigured (No Fake Success) ---');
  // First approve the job
  await approveQuoteVideoJob(prep.jobId, { reviewedBy: 'test-qa' });
  const approvedJob = getQuoteJobById(prep.jobId);
  assert(approvedJob.reviewStatus === 'approved', 'Job is now approved');

  // Ensure env credentials are empty for this test
  const oldMetaToken = process.env.META_ACCESS_TOKEN;
  const oldMetaUser = process.env.META_IG_USER_ID;
  const oldYtClient = process.env.YOUTUBE_CLIENT_ID;
  const oldYtSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const oldYtRefresh = process.env.YOUTUBE_REFRESH_TOKEN;
  const oldSimulated = process.env.PUBLISHING_SIMULATED;

  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_IG_USER_ID;
  delete process.env.YOUTUBE_CLIENT_ID;
  delete process.env.YOUTUBE_CLIENT_SECRET;
  delete process.env.YOUTUBE_REFRESH_TOKEN;
  process.env.PUBLISHING_SIMULATED = 'false';

  const unconfiguredResult = await publishQuoteVideoJob(prep.jobId);
  assert(unconfiguredResult.success === false, 'Publishing without credentials returns success: false');
  assert(unconfiguredResult.publishStatus === PUBLISH_STATUS.PUBLISH_FAILED, 'Overall status is publish_failed');
  assert(unconfiguredResult.publications.length === 2, 'Evaluated both platforms');

  for (const pub of unconfiguredResult.publications) {
    assert(pub.success === false, `${pub.platform} reports success: false`);
    assert(pub.status === PUBLISH_STATUS.PUBLISH_FAILED, `${pub.platform} status is publish_failed`);
    assert(pub.error.includes('Publishing is not configured'), `${pub.platform} error clearly states "Publishing is not configured"`);
  }
  console.log('✅ PASSED: Missing credentials report "Publishing is not configured" and never fake success.');

  // --- REQUIREMENT 4: Publishing failure is persisted ---
  console.log('\n--- TEST 4: Publishing Failure is Persisted ---');
  const failedJobInDb = getQuoteJobById(prep.jobId);
  assert(failedJobInDb.publishStatus === PUBLISH_STATUS.PUBLISH_FAILED, 'Job publishStatus in DB is publish_failed');
  assert(failedJobInDb.publishError.includes('Publishing is not configured'), 'Job publishError in DB recorded');

  const failedPubs = getJobPublications(prep.jobId);
  assert(failedPubs.length === 2, '2 publication rows persisted in quote_video_publications');
  assert(failedPubs.every(p => p.status === 'publish_failed'), 'All rows recorded as publish_failed');
  console.log('✅ PASSED: Failure state accurately persisted in DB tables.');

  // --- REQUIREMENT 3: Publishing Success is Persisted (Simulated / Local Mode) ---
  console.log('\n--- TEST 3: Publishing Success is Persisted ---');
  // Enable simulated mode for local development verification
  process.env.PUBLISHING_SIMULATED = 'true';

  // Prepare a new approved job for success test
  const prepSuccess = await prepareDailyQuoteVideo({
    workflowId: TEST_WORKFLOW_ID,
    config: { templateType: 'dailyQuoteVideo', topic: 'love', duration: 10 },
  });
  await renderQuoteVideoJob(prepSuccess.jobId);
  await approveQuoteVideoJob(prepSuccess.jobId, { reviewedBy: 'test-approver' });

  const successResult = await publishQuoteVideoJob(prepSuccess.jobId);
  assert(successResult.success === true, 'Publishing in simulated mode succeeds');
  assert(successResult.publishStatus === PUBLISH_STATUS.SIMULATED, 'Overall status is simulated');
  assert(successResult.publications.length === 2, 'Both platforms processed');

  const igPub = successResult.publications.find(p => p.platform === 'instagram');
  const ytPub = successResult.publications.find(p => p.platform === 'youtube');

  assert(igPub && igPub.success === true, 'Instagram publication succeeded');
  assert(igPub.externalPostId.startsWith('sim_ig_'), `Instagram external post ID generated (${igPub.externalPostId})`);
  assert(igPub.url.includes('instagram.com/reel/'), 'Instagram URL is populated');

  assert(ytPub && ytPub.success === true, 'YouTube publication succeeded');
  assert(ytPub.externalPostId.startsWith('sim_yt_'), `YouTube external post ID generated (${ytPub.externalPostId})`);
  assert(ytPub.url.includes('youtube.com/shorts/'), 'YouTube Shorts URL is populated');

  // Verify persistence in DB
  const successJobInDb = getQuoteJobById(prepSuccess.jobId);
  assert(successJobInDb.publishStatus === PUBLISH_STATUS.SIMULATED, 'Job publishStatus persisted as simulated');
  assert(successJobInDb.publishedAt !== null, 'Job publishedAt timestamp recorded');

  const successPubs = getJobPublications(prepSuccess.jobId);
  assert(successPubs.length === 2, '2 publication records in quote_video_publications');
  assert(successPubs.every(p => p.status === 'simulated'), 'All publication records stored as simulated');
  console.log('✅ PASSED: Publishing success and external metadata cleanly persisted.');

  // --- REQUIREMENT 5: Duplicate Publish Prevention (Retry Safety) ---
  console.log('\n--- TEST 5: Duplicate Publish Prevention ---');
  // Mark one record as actually 'published' in database
  db.prepare("UPDATE quote_video_publications SET status = 'published' WHERE job_id = ? AND platform = 'instagram'")
    .run(prepSuccess.jobId);

  // Call publish again on the same job
  const dupResult = await publishQuoteVideoJob(prepSuccess.jobId, { platforms: ['instagram'] });
  assert(dupResult.publications[0].alreadyPublished === true, 'Already published flag is true');
  assert(dupResult.publications[0].error === 'Already published.', 'Error message is "Already published."');
  console.log('✅ PASSED: Duplicate publish request safely prevented.');

  // --- REQUIREMENT 6: Independent Multi-Platform Execution ---
  console.log('\n--- TEST 6: Independent Multi-Platform Execution ---');
  // Test Instagram and YouTube independently
  const prepIndep = await prepareDailyQuoteVideo({
    workflowId: TEST_WORKFLOW_ID,
    config: { templateType: 'dailyQuoteVideo', topic: 'humanity', duration: 10 },
  });
  await renderQuoteVideoJob(prepIndep.jobId);
  await approveQuoteVideoJob(prepIndep.jobId);

  // Publish only to YouTube Shorts
  const ytOnlyResult = await publishQuoteVideoJob(prepIndep.jobId, { platforms: ['youtube'] });
  assert(ytOnlyResult.publications.length === 1, 'Only 1 platform processed');
  assert(ytOnlyResult.publications[0].platform === 'youtube', 'Processed platform is youtube');

  const indepPubs = getJobPublications(prepIndep.jobId);
  assert(indepPubs.length === 1 && indepPubs[0].platform === 'youtube', 'Only YouTube recorded');

  // Now publish only to Instagram
  const igOnlyResult = await publishQuoteVideoJob(prepIndep.jobId, { platforms: ['instagram'] });
  assert(igOnlyResult.publications.length === 1, 'Only 1 platform processed');
  assert(igOnlyResult.publications[0].platform === 'instagram', 'Processed platform is instagram');

  const allIndepPubs = getJobPublications(prepIndep.jobId);
  assert(allIndepPubs.length === 2, 'Both platforms recorded independently');
  console.log('✅ PASSED: Instagram and YouTube platforms execute and persist results independently.');

  // --- REQUIREMENT 8: Scheduler Integration ---
  console.log('\n--- TEST 8: Scheduler Integration for Approved Quote Video ---');
  // Test 8a: When approved job exists
  const schedResult = await publishScheduledApprovedJob(TEST_WORKFLOW_ID);
  assert(schedResult !== null, 'Scheduler found and processed approved job');

  // Test 8b: When NO approved job exists (workflow with no approved jobs)
  const emptyWfId = 'empty-test-wf';
  db.prepare('INSERT OR REPLACE INTO workflows (id, name, definition, active) VALUES (?, ?, ?, 0)').run(
    emptyWfId, 'Empty WF', JSON.stringify({ nodes: [{ type: 'quoteVideo', config: {} }] })
  );
  const emptySchedResult = await publishScheduledApprovedJob(emptyWfId);
  assert(emptySchedResult.published === false, 'Did not publish when no approved job exists');
  assert(emptySchedResult.message.includes('No approved quote video available for publishing'), 'Logged safe message');
  console.log('✅ PASSED: Scheduler integration cleanly handles approved jobs and skips when none exist.');

  // Restore env
  if (oldMetaToken) process.env.META_ACCESS_TOKEN = oldMetaToken;
  if (oldMetaUser) process.env.META_IG_USER_ID = oldMetaUser;
  if (oldYtClient) process.env.YOUTUBE_CLIENT_ID = oldYtClient;
  if (oldYtSecret) process.env.YOUTUBE_CLIENT_SECRET = oldYtSecret;
  if (oldYtRefresh) process.env.YOUTUBE_REFRESH_TOKEN = oldYtRefresh;
  if (oldSimulated !== undefined) process.env.PUBLISHING_SIMULATED = oldSimulated;
  else delete process.env.PUBLISHING_SIMULATED;

  // --- REQUIREMENT 8 & 9: Production Workflow & Jobs Safety ---
  console.log('\n--- FINAL PRODUCTION SAFETY CHECK ---');
  const finalProd = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(finalProd.active === 1, 'Production workflow is still active=1');
  const finalDef = JSON.parse(finalProd.definition || '{}');
  const finalCron = finalDef.nodes?.find(n => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(finalCron === '0 19 * * *', 'Production schedule is still 0 19 * * *');
  const finalJobCount = db.prepare('SELECT count(*) as count FROM quote_video_jobs').get().count;
  assert(finalJobCount >= initialJobCount, `No quote video jobs deleted (initial: ${initialJobCount}, final: ${finalJobCount})`);
  console.log('✅ PASSED: Production workflow and database records completely intact.');

  console.log('\n====================================================');
  console.log('PHASE 6 PUBLISHING SUITE: ALL TESTS PASSED');
  console.log('====================================================');
}

runPublishingTests().catch((err) => {
  console.error('\n❌ PUBLISHING TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
