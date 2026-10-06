/**
 * FLOWBOX — PHASE 5 REGENERATION LANGUAGE & TOPIC ROTATION REGRESSION SUITE
 *
 * Verifies all required regression tests:
 * Test A: Thirukkural English -> regenerate -> Thirukkural Tamil
 * Test B: Thirukkural Tamil -> regenerate -> Thirukkural English
 * Test C: Love Tamil -> regenerate -> Love English
 * Test D: Love English -> regenerate -> Love Tamil
 * Test E: Motivation Tamil -> regenerate -> Motivation English
 * Test F: Regenerating Love must NOT advance the topic state to Humanity
 * Test G: Regenerating Thirukkural must NOT affect Love's language state
 * Test H: Multiple regenerations of the same topic: Tamil -> English -> Tamil -> English
 * Test I / Req 9: Scheduled rotation sequence remains independent:
 *   Motivation -> Love -> Humanity -> Thirukkural -> Poetry -> Meaningful -> repeat
 *   while each topic independently alternates its language.
 *
 * Safety: Production workflow e1365ac8-e429-4ef9-92f5-cb4a8979aaeb remains completely untouched.
 */

const axios = require('axios');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  getTopicLanguageState,
} = require('./src/contentEngine');

const API_BASE = 'http://localhost:4000';
const HEADERS = {
  Authorization: 'Bearer dev-local-user',
  'Content-Type': 'application/json',
};

const PROD_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';
const TEST_WF_ID = 'regen-rotation-test-wf';

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

async function setupTestWorkflow() {
  // Ensure test workflow exists
  db.prepare(`
    INSERT INTO workflows (id, name, definition, active)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET active = 0
  `).run(
    TEST_WF_ID,
    'Regeneration Rotation Test Workflow',
    JSON.stringify({
      nodes: [
        {
          id: 'quote-video-config',
          type: 'setData',
          config: {
            templateType: 'dailyQuoteVideo',
            language: 'alternate',
            topicMode: 'rotate',
            selectedTopics: ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'],
            duration: 15,
          },
        },
      ],
      edges: [],
    })
  );

  // Clean previous test data for this workflow
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);
}

async function cleanupTestWorkflow() {
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM workflows WHERE id = ?').run(TEST_WF_ID);
}

async function runRegressionSuite() {
  console.log('====================================================');
  console.log('STARTING REGENERATION LANGUAGE & TOPIC ROTATION SUITE');
  console.log('====================================================\n');

  // Verify production workflow safety
  console.log('--- PRODUCTION SAFETY CHECK ---');
  const prodWf = db.prepare('SELECT id, name, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(prodWf !== undefined, 'Production workflow e1365ac8-e429-4ef9-92f5-cb4a8979aaeb exists');
  assert(prodWf.active === 1, 'Production workflow active is 1 (true)');
  const parsedDef = JSON.parse(prodWf.definition);
  const cron = parsedDef.nodes?.find((n) => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(cron === '0 19 * * *', 'Production schedule is 0 19 * * *');
  console.log('Production workflow is safe and intact.\n');

  await setupTestWorkflow();

  // Test A: Thirukkural English -> regenerate -> Thirukkural Tamil
  console.log('--- TEST A: Thirukkural English -> regenerate -> Thirukkural Tamil ---');
  const prepA = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'thirukkural', language: 'en' },
  });
  assert(prepA.topic === 'thirukkural' && prepA.language === 'en', 'Initial job A is Thirukkural English');

  const regenResA = await axios.post(`${API_BASE}/api/quote-video-jobs/${prepA.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const jobA2 = regenResA.data.job;
  assert(jobA2.topic === 'thirukkural', `Test A: Topic preserved as thirukkural (got: ${jobA2.topic})`);
  assert(jobA2.language === 'ta', `Test A: Language alternated to ta (got: ${jobA2.language})`);
  assert(jobA2.version === 2, `Test A: Version incremented to 2 (got: ${jobA2.version})`);
  assert(jobA2.parentJobId === prepA.jobId, `Test A: Lineage parentJobId matches old job (${jobA2.parentJobId})`);

  // Test B: Thirukkural Tamil -> regenerate -> Thirukkural English
  console.log('\n--- TEST B: Thirukkural Tamil -> regenerate -> Thirukkural English ---');
  const prepB = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'thirukkural', language: 'ta' },
  });
  assert(prepB.topic === 'thirukkural' && prepB.language === 'ta', 'Initial job B is Thirukkural Tamil');

  const regenResB = await axios.post(`${API_BASE}/api/quote-video-jobs/${prepB.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const jobB2 = regenResB.data.job;
  assert(jobB2.topic === 'thirukkural', `Test B: Topic preserved as thirukkural (got: ${jobB2.topic})`);
  assert(jobB2.language === 'en', `Test B: Language alternated to en (got: ${jobB2.language})`);
  assert(jobB2.version === 2, `Test B: Version incremented to 2 (got: ${jobB2.version})`);
  assert(jobB2.parentJobId === prepB.jobId, `Test B: Lineage parentJobId matches old job (${jobB2.parentJobId})`);

  // Test C: Love Tamil -> regenerate -> Love English
  console.log('\n--- TEST C: Love Tamil -> regenerate -> Love English ---');
  const prepC = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'love', language: 'ta' },
  });
  assert(prepC.topic === 'love' && prepC.language === 'ta', 'Initial job C is Love Tamil');

  const regenResC = await axios.post(`${API_BASE}/api/quote-video-jobs/${prepC.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const jobC2 = regenResC.data.job;
  assert(jobC2.topic === 'love', `Test C: Topic preserved as love (got: ${jobC2.topic})`);
  assert(jobC2.language === 'en', `Test C: Language alternated to en (got: ${jobC2.language})`);
  assert(jobC2.version === 2, `Test C: Version incremented to 2 (got: ${jobC2.version})`);

  // Test D: Love English -> regenerate -> Love Tamil
  console.log('\n--- TEST D: Love English -> regenerate -> Love Tamil ---');
  const prepD = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'love', language: 'en' },
  });
  assert(prepD.topic === 'love' && prepD.language === 'en', 'Initial job D is Love English');

  const regenResD = await axios.post(`${API_BASE}/api/quote-video-jobs/${prepD.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const jobD2 = regenResD.data.job;
  assert(jobD2.topic === 'love', `Test D: Topic preserved as love (got: ${jobD2.topic})`);
  assert(jobD2.language === 'ta', `Test D: Language alternated to ta (got: ${jobD2.language})`);
  assert(jobD2.version === 2, `Test D: Version incremented to 2 (got: ${jobD2.version})`);

  // Test E: Motivation Tamil -> regenerate -> Motivation English
  console.log('\n--- TEST E: Motivation Tamil -> regenerate -> Motivation English ---');
  const prepE = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'motivation', language: 'ta' },
  });
  assert(prepE.topic === 'motivation' && prepE.language === 'ta', 'Initial job E is Motivation Tamil');

  const regenResE = await axios.post(`${API_BASE}/api/quote-video-jobs/${prepE.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const jobE2 = regenResE.data.job;
  assert(jobE2.topic === 'motivation', `Test E: Topic preserved as motivation (got: ${jobE2.topic})`);
  assert(jobE2.language === 'en', `Test E: Language alternated to en (got: ${jobE2.language})`);
  assert(jobE2.version === 2, `Test E: Version incremented to 2 (got: ${jobE2.version})`);

  // Test F: Regenerating Love must NOT advance the topic state to Humanity
  console.log('\n--- TEST F: Regenerating Love must NOT advance topic state to Humanity ---');
  // Clean jobs and setup fresh state
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);

  // Create a root scheduled job for Love
  const rootLove = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: {
      templateType: 'dailyQuoteVideo',
      topicMode: 'rotate',
      selectedTopics: ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'],
    },
    options: { topic: 'love', language: 'ta' },
  });
  assert(rootLove.topic === 'love', 'Root scheduled job is Love');

  // Regenerate Love
  const regenLove = await axios.post(`${API_BASE}/api/quote-video-jobs/${rootLove.jobId}/regenerate`, {
    autoRender: false,
  }, { headers: HEADERS });
  const loveV2 = regenLove.data.job;
  assert(loveV2.topic === 'love', `Test F: Regenerated job topic is Love (NOT Humanity, got: ${loveV2.topic})`);
  assert(loveV2.language === 'en', `Test F: Regenerated job language is English (got: ${loveV2.language})`);

  // Now trigger the next scheduled run - it should cleanly advance to Humanity
  const nextScheduled = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: {
      templateType: 'dailyQuoteVideo',
      topicMode: 'rotate',
      selectedTopics: ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'],
    },
  });
  assert(nextScheduled.topic === 'humanity', `Test F: Subsequent scheduled run resolves to humanity (got: ${nextScheduled.topic})`);

  // Test G: Regenerating Thirukkural must NOT affect Love's language state
  console.log("\n--- TEST G: Regenerating Thirukkural must NOT affect Love's language state ---");
  // Set Love's state to 'ta' explicitly
  const loveStateBefore = db.prepare('SELECT last_language FROM quote_topic_state WHERE workflow_id = ? AND topic = ?').get(TEST_WF_ID, 'love');
  const expectedLoveLang = loveStateBefore?.last_language || 'ta';

  // Prepare and regenerate Thirukkural multiple times
  const kuralJob = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'thirukkural', language: 'en' },
  });
  await axios.post(`${API_BASE}/api/quote-video-jobs/${kuralJob.jobId}/regenerate`, { autoRender: false }, { headers: HEADERS });

  const loveStateAfter = db.prepare('SELECT last_language FROM quote_topic_state WHERE workflow_id = ? AND topic = ?').get(TEST_WF_ID, 'love');
  assert(
    loveStateAfter?.last_language === expectedLoveLang,
    `Test G: Love's state unchanged by Thirukkural regeneration (${loveStateAfter?.last_language} === ${expectedLoveLang})`
  );

  // Test H: Multiple regenerations of the same topic: Tamil -> English -> Tamil -> English
  console.log('\n--- TEST H: Multiple regenerations of same topic: Tamil -> English -> Tamil -> English ---');
  const v1Job = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'motivation', language: 'ta' },
  });
  assert(v1Job.version === 1 && v1Job.language === 'ta', 'v1 is Tamil (ta)');

  // v1 -> v2 (English)
  const resV2 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v1Job.jobId}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v2 = resV2.data.job;
  assert(v2.version === 2 && v2.language === 'en' && v2.topic === 'motivation', `v2 is English (got: ${v2.language}, version: ${v2.version})`);
  assert(v2.parentJobId === v1Job.jobId, `v2 parent is v1 (${v2.parentJobId} === ${v1Job.jobId})`);

  // v2 -> v3 (Tamil)
  const resV3 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v2.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v3 = resV3.data.job;
  assert(v3.version === 3 && v3.language === 'ta' && v3.topic === 'motivation', `v3 is Tamil (got: ${v3.language}, version: ${v3.version})`);
  assert(v3.parentJobId === v2.id, `v3 parent is v2 (${v3.parentJobId} === ${v2.id})`);

  // v3 -> v4 (English)
  const resV4 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v3.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v4 = resV4.data.job;
  assert(v4.version === 4 && v4.language === 'en' && v4.topic === 'motivation', `v4 is English (got: ${v4.language}, version: ${v4.version})`);
  assert(v4.parentJobId === v3.id, `v4 parent is v3 (${v4.parentJobId} === ${v3.id})`);

  // Verify DB state for all 4 versions
  const rows = db.prepare('SELECT id, version, language, topic, review_status, parent_job_id FROM quote_video_jobs WHERE id IN (?, ?, ?, ?) ORDER BY version ASC').all(v1Job.jobId, v2.id, v3.id, v4.id);
  assert(rows.length === 4, 'All 4 job versions exist in database');
  assert(rows[0].review_status === 'regenerate_requested', 'v1 status is regenerate_requested');
  assert(rows[1].review_status === 'regenerate_requested', 'v2 status is regenerate_requested');
  assert(rows[2].review_status === 'regenerate_requested', 'v3 status is regenerate_requested');
  assert(rows[3].review_status === 'not_rendered' || rows[3].review_status === 'ready_for_review', 'v4 status is valid candidate status');

  // Test I / Requirement 9: Scheduled rotation sequence remains independent
  console.log('\n--- TEST I / REQ 9: Scheduled rotation sequence remains independent ---');
  // Reset test workflow jobs and state to test pure scheduled rotation
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);

  const expectedTopicSequence = [
    'motivation',
    'love',
    'humanity',
    'thirukkural',
    'poetry',
    'meaningful',
    'motivation', // Cycle 2 starts
  ];

  const schedConfig = {
    templateType: 'dailyQuoteVideo',
    topicMode: 'rotate',
    language: 'alternate',
    selectedTopics: ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'],
    duration: 15,
  };

  const scheduledResults = [];
  for (let i = 0; i < expectedTopicSequence.length; i++) {
    const sJob = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: schedConfig,
    });
    scheduledResults.push(sJob);
    assert(
      sJob.topic === expectedTopicSequence[i],
      `Scheduled step ${i + 1} produced topic '${sJob.topic}' (expected: '${expectedTopicSequence[i]}')`
    );
  }

  // Verify that during cycle 2, the repeated topic (motivation) alternated its language independently
  const motJob1 = scheduledResults[0];
  const motJob2 = scheduledResults[6];
  assert(motJob1.topic === 'motivation' && motJob2.topic === 'motivation', 'Both jobs are motivation');
  assert(
    motJob1.language !== motJob2.language,
    `Motivation alternated language across cycles (${motJob1.language} -> ${motJob2.language})`
  );

  // Clean up test workflow
  await cleanupTestWorkflow();

  // Final check on production workflow
  console.log('\n--- FINAL PRODUCTION SAFETY CHECK ---');
  const finalProd = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(finalProd.active === 1, 'Production workflow is still active=1');
  const finalDef = JSON.parse(finalProd.definition);
  const finalCron = finalDef.nodes?.find((n) => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(finalCron === '0 19 * * *', 'Production workflow schedule is still 0 19 * * *');

  console.log('\n====================================================');
  console.log(`REGENERATION ROTATION SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runRegressionSuite().catch((err) => {
  console.error('\n❌ REGENERATION ROTATION SUITE FAILED:', err.message);
  if (err.response?.data) {
    console.error('Server response data:', err.response.data);
  }
  process.exit(1);
});
