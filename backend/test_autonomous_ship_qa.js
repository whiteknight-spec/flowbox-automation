const assert = require('assert');
const axios = require('axios');
const path = require('path');
const Database = require('better-sqlite3');

const API = 'http://localhost:4000';
const dbPath = path.resolve(__dirname, 'data/flowbox.sqlite');
const db = new Database(dbPath);

const PRODUCTION_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';

async function runShipSprintQA() {
  console.log('====================================================');
  console.log('FLOWBOX AUTONOMOUS FINAL SHIP SPRINT — QA SUITE');
  console.log('====================================================');

  // Verify production workflow exists and is untouched
  const prodWf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(PRODUCTION_WORKFLOW_ID);
  assert(prodWf, 'Production workflow must exist in database');
  assert(prodWf.active === 1, 'Production workflow must be active');
  console.log(`✅ Production workflow verified: ${PRODUCTION_WORKFLOW_ID} (Active: ${prodWf.active})`);

  // --- TEST A: Approve -> Publish with credentials absent ---
  console.log('\n--- TEST A: Approve -> Publish with credentials absent ---');
  // Prepare and render a fresh test job
  const prepRes = await axios.post(`${API}/api/workflows/${PRODUCTION_WORKFLOW_ID}/prepare-quote`, {
    topic: 'poetry',
    language: 'en',
    duration: 10,
  });
  const testJobId = prepRes.data.jobId;
  assert(testJobId, 'JobId generated');
  await axios.post(`${API}/api/workflows/${PRODUCTION_WORKFLOW_ID}/quote-jobs/${testJobId}/render`);
  await axios.post(`${API}/api/quote-video-jobs/${testJobId}/approve`, { reviewedBy: 'qa-tester' });

  // Publish with no credentials
  const pubA = await axios.post(`${API}/api/quote-video-jobs/${testJobId}/publish`, {});
  assert(pubA.data.publishStatus === 'publish_failed', 'Status is publish_failed');
  assert(pubA.data.publications.length === 2, '2 publications evaluated');

  const igPubA = pubA.data.publications.find((p) => p.platform === 'instagram');
  const ytPubA = pubA.data.publications.find((p) => p.platform === 'youtube');
  assert(igPubA && igPubA.status === 'publish_failed', 'Instagram failure visible');
  assert(ytPubA && ytPubA.status === 'publish_failed', 'YouTube failure visible');
  assert(
    (igPubA.error || igPubA.errorMessage).includes('Missing Instagram credentials'),
    'Instagram failure clearly states missing credentials'
  );
  assert(
    (ytPubA.error || ytPubA.errorMessage).includes('Missing YouTube credentials'),
    'YouTube failure clearly states missing credentials'
  );
  console.log('✅ TEST A PASSED: Both Instagram and YouTube failures visible with exact missing-credentials reasons.');

  // --- TEST B: Retry Instagram ---
  console.log('\n--- TEST B: Retry Instagram ---');
  const retryIg = await axios.post(`${API}/api/quote-video-jobs/${testJobId}/publish`, {
    platforms: ['instagram'],
  });
  assert(retryIg.data.publications.length === 1, 'Only Instagram retried in this action');
  assert(retryIg.data.publications[0].platform === 'instagram', 'Platform is instagram');
  assert(retryIg.data.publications[0].status === 'publish_failed', 'Instagram retry recorded failure');

  // Verify total job publications now contains 3 records (2 from initial + 1 from retry)
  const pubsAfterB = await axios.get(`${API}/api/quote-video-jobs/${testJobId}/publications`);
  assert(pubsAfterB.data.publications.length === 3, 'Total 3 publication records persisted in history');
  const igRecordsB = pubsAfterB.data.publications.filter((p) => p.platform === 'instagram');
  const ytRecordsB = pubsAfterB.data.publications.filter((p) => p.platform === 'youtube');
  assert(igRecordsB.length === 2, '2 Instagram failure records persisted');
  assert(ytRecordsB.length === 1, 'YouTube failure record STILL PERSISTS after Instagram retry');
  console.log('✅ TEST B PASSED: Instagram retry recorded, and YouTube failure record correctly persists.');

  // --- TEST C: Retry YouTube ---
  console.log('\n--- TEST C: Retry YouTube ---');
  const retryYt = await axios.post(`${API}/api/quote-video-jobs/${testJobId}/publish`, {
    platforms: ['youtube'],
  });
  assert(retryYt.data.publications.length === 1, 'Only YouTube retried in this action');
  assert(retryYt.data.publications[0].platform === 'youtube', 'Platform is youtube');
  assert(retryYt.data.publications[0].status === 'publish_failed', 'YouTube retry recorded failure');

  const pubsAfterC = await axios.get(`${API}/api/quote-video-jobs/${testJobId}/publications`);
  assert(pubsAfterC.data.publications.length === 4, 'Total 4 publication records persisted in history');
  const igRecordsC = pubsAfterC.data.publications.filter((p) => p.platform === 'instagram');
  const ytRecordsC = pubsAfterC.data.publications.filter((p) => p.platform === 'youtube');
  assert(igRecordsC.length === 2, 'Instagram records intact');
  assert(ytRecordsC.length === 2, '2 YouTube records intact — NO DISAPPEARING HISTORY');
  console.log('✅ TEST C PASSED: YouTube retry failure produced persistent record with no disappearing history.');

  // --- TEST D: Refresh page (GET /publications & GET /quote-jobs/:id) ---
  console.log('\n--- TEST D: Refresh page (API simulation) ---');
  const refreshPubs = await axios.get(`${API}/api/quote-video-jobs/${testJobId}/publications`);
  const refreshJob = await axios.get(`${API}/api/quote-video-jobs/${testJobId}`);
  assert(refreshPubs.data.publications.length === 4, 'All 4 records exist on refresh');
  assert(
    refreshPubs.data.publications.some((p) => p.platform === 'instagram' && p.status === 'publish_failed'),
    'Instagram failure still exists'
  );
  assert(
    refreshPubs.data.publications.some((p) => p.platform === 'youtube' && p.status === 'publish_failed'),
    'YouTube failure still exists'
  );
  assert(refreshJob.data.job.publishStatus === 'publish_failed', 'Job status is publish_failed');
  assert(refreshJob.data.job.publishError.includes('youtube'), 'Job publishError retains YouTube failure');
  console.log('✅ TEST D PASSED: On page refresh, both Instagram and YouTube failure records still exist.');

  // --- TEST E: Close and reopen Review Quote Video ---
  console.log('\n--- TEST E: Close and reopen Review Quote Video ---');
  // Re-fetch latest quote job for workflow, then fetch publications (identical to reopening modal)
  const latestWfJob = await axios.get(`${API}/api/workflows/${PRODUCTION_WORKFLOW_ID}/quote-jobs/latest`);
  assert(latestWfJob.data.job.id === testJobId, 'Modal targets the newly published job');
  const reopenPubs = await axios.get(`${API}/api/quote-video-jobs/${latestWfJob.data.job.id}/publications`);
  assert(reopenPubs.data.publications.length >= 2, 'Reopened modal loads persistent publications');
  const reopenedYt = reopenPubs.data.publications.find((p) => p.platform === 'youtube');
  const reopenedIg = reopenPubs.data.publications.find((p) => p.platform === 'instagram');
  assert(reopenedYt && reopenedYt.status === 'publish_failed', 'Reopened modal has YouTube failure');
  assert(reopenedIg && reopenedIg.status === 'publish_failed', 'Reopened modal has Instagram failure');
  assert(
    (reopenedYt.error || reopenedYt.errorMessage).includes('Missing YouTube credentials'),
    'Reopened modal shows actual YouTube failure reason'
  );
  console.log('✅ TEST E PASSED: Closing and reopening review modal retains both failure records and failure reasons.');

  // --- TEST F: Simulation / Dry-run Mode ---
  console.log('\n--- TEST F: Existing Simulation / Dry-run Mode ---');
  // Test simulation flag in publish options
  const simJobPrep = await axios.post(`${API}/api/workflows/${PRODUCTION_WORKFLOW_ID}/prepare-quote`, {
    topic: 'meaningful',
    language: 'en',
    duration: 10,
  });
  const simJobId = simJobPrep.data.jobId;
  await axios.post(`${API}/api/workflows/${PRODUCTION_WORKFLOW_ID}/quote-jobs/${simJobId}/render`);
  await axios.post(`${API}/api/quote-video-jobs/${simJobId}/approve`, { reviewedBy: 'qa-tester' });

  // Publish with simulation credentials
  const simPub = await axios.post(`${API}/api/quote-video-jobs/${simJobId}/publish`, {
    credentials: { simulated: true },
  });
  assert(simPub.data.success === true, 'Simulation publish succeeds');
  assert(simPub.data.publishStatus === 'simulated', 'Job status is simulated');

  const simIg = simPub.data.publications.find((p) => p.platform === 'instagram');
  const simYt = simPub.data.publications.find((p) => p.platform === 'youtube');
  assert(simIg && simIg.status === 'simulated' && simIg.url.includes('instagram.com/reel/'), 'Instagram simulation works');
  assert(simYt && simYt.status === 'simulated' && simYt.url.includes('youtube.com/shorts/'), 'YouTube simulation works');

  // Verify simulation records persist in database
  const simDbPubs = await axios.get(`${API}/api/quote-video-jobs/${simJobId}/publications`);
  assert(simDbPubs.data.publications.length === 2, '2 simulated records persisted');
  assert(simDbPubs.data.publications.every((p) => p.status === 'simulated'), 'All records persisted as simulated');
  console.log('✅ TEST F PASSED: Instagram and YouTube simulated publishing works and records cleanly persist.');

  // --- FINAL WORKFLOW INTEGRITY VERIFICATION ---
  console.log('\n--- VERIFYING PRODUCTION WORKFLOW INTEGRITY ---');
  const finalWf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(PRODUCTION_WORKFLOW_ID);
  assert(finalWf.id === PRODUCTION_WORKFLOW_ID, 'Workflow ID must remain e1365ac8-e429-4ef9-92f5-cb4a8979aaeb');
  assert(finalWf.active === 1, 'Workflow must remain active: 1');
  const parsedDef = JSON.parse(finalWf.definition);
  const triggerNode = parsedDef.nodes.find((n) => n.type === 'scheduleTrigger' || n.type === 'triggerSchedule');
  const cronExpr = triggerNode?.config?.cron || triggerNode?.data?.cron;
  assert(cronExpr === '0 19 * * *', 'Schedule must remain 0 19 * * * (7:00 PM daily)');
  console.log(`✅ PRODUCTION WORKFLOW INTACT: ID=${finalWf.id}, Active=${finalWf.active}, Cron=${cronExpr}`);

  console.log('\n====================================================');
  console.log('ALL AUTONOMOUS SHIP SPRINT QA TESTS PASSED (TESTS A-F)');
  console.log('====================================================');
}

runShipSprintQA().catch((err) => {
  console.error('\n❌ SHIP SPRINT QA FAILED:', err.response?.data || err.message);
  process.exit(1);
});
