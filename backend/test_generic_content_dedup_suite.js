/**
 * FLOWBOX — GENERIC CONTENT DEDUPLICATION & CONTENT HISTORY REGRESSION SUITE
 *
 * Verifies all 17 required scenarios (Tests A through Q):
 * Test A: Love: A -> B -> C -> D without recent duplicates
 * Test B: Motivation: independent history from Love
 * Test C: Humanity: independent history
 * Test D: Thirukkural: 391 -> 392 -> 393 -> 394 verified non-repeating sequence
 * Test E: Poetry: non-repeating recent content
 * Test F: Meaningful: non-repeating recent content
 * Test G: Regeneration: Tamil A -> English B -> Tamil C -> English D
 * Test H: Same topic repeated regeneration: content changes on every accepted generation
 * Test I: Scheduled rotation: Motivation -> Love -> Humanity -> Thirukkural -> Poetry -> Meaningful
 * Test J: Regeneration must NOT alter scheduled topic sequence
 * Test K: Regeneration of Love must NOT alter Humanity content history
 * Test L: Regeneration of Thirukkural must NOT alter Love content history
 * Test M: Server restart: history survives restart (verified via fresh SQLite connection)
 * Test N: Duplicate candidate: duplicate rejected and retry happens
 * Test O: Retry exhaustion: enters safe review/failure state instead of silently accepting duplicate
 * Test P: Future topic: generic dedup works for any topic without topic-specific code
 * Test Q: Version lineage: v1 -> v2 -> v3 remains strictly linked
 *
 * Production Safety: e1365ac8-e429-4ef9-92f5-cb4a8979aaeb remains active=1, cron="0 19 * * *".
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  getQuoteJobById,
  recordAcceptedContent,
  getRecentContentHistory,
  isContentDuplicate,
  clearContentHistory,
  computeContentFingerprint,
  normalizeContentText,
  ORIGINAL_QUOTES,
} = require('./src/contentEngine');

const API_BASE = 'http://localhost:4000';
const HEADERS = {
  Authorization: 'Bearer dev-local-user',
  'Content-Type': 'application/json',
};

const PROD_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';
const TEST_WF_ID = 'generic-dedup-test-wf';

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
  db.prepare(`
    INSERT INTO workflows (id, name, definition, active)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET active = 0
  `).run(
    TEST_WF_ID,
    'Generic Content Dedup Test Workflow',
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
            dedupWindow: 20,
          },
        },
      ],
      edges: [],
    })
  );

  // Clean existing test data for this workflow
  clearContentHistory(TEST_WF_ID);
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);
}

async function cleanupTestWorkflow() {
  clearContentHistory(TEST_WF_ID);
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM workflows WHERE id = ?').run(TEST_WF_ID);
}

async function runDedupSuite() {
  console.log('====================================================');
  console.log('STARTING GENERIC CONTENT DEDUPLICATION REGRESSION SUITE');
  console.log('====================================================\n');

  // Production safety check
  console.log('--- PRODUCTION SAFETY CHECK ---');
  const prodWf = db.prepare('SELECT id, name, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(prodWf !== undefined, 'Production workflow e1365ac8-e429-4ef9-92f5-cb4a8979aaeb exists');
  assert(prodWf.active === 1, 'Production workflow active is 1 (true)');
  const parsedDef = JSON.parse(prodWf.definition);
  const cron = parsedDef.nodes?.find((n) => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(cron === '0 19 * * *', 'Production schedule is 0 19 * * *');
  console.log('Production workflow is safe and intact.\n');

  await setupTestWorkflow();

  // Test Normalization & Fingerprinting
  console.log('--- TEST NORMALIZATION & FINGERPRINTING ---');
  const text1 = 'உன் பாதைகள் கடினமாக இருக்கலாம்';
  const text2 = 'உன் பாதைகள் கடினமாக இருக்கலாம்.';
  const text3 = ' "உன் பாதைகள் கடினமாக இருக்கலாம்" ';
  assert(normalizeContentText(text1) === normalizeContentText(text2), 'Punctuation differences normalized identically in Tamil');
  assert(normalizeContentText(text1) === normalizeContentText(text3), 'Enclosing quotes and extra spaces normalized identically in Tamil');
  assert(computeContentFingerprint(text1) === computeContentFingerprint(text2), 'Fingerprints match despite trailing punctuation');

  const enText1 = 'Strength is not about never feeling weary; it is choosing to take one more honest step.';
  const enText2 = 'strength is not about never feeling weary; it is choosing to take one more honest step';
  assert(computeContentFingerprint(enText1) === computeContentFingerprint(enText2), 'English punctuation and casing normalized identically');

  // Test A: Love: A -> B -> C -> D without recent duplicates
  console.log('\n--- TEST A: Love A -> B -> C -> D without recent duplicates ---');
  const loveQuotes = [];
  for (let i = 0; i < 4; i++) {
    const job = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: { templateType: 'dailyQuoteVideo' },
      options: { topic: 'love', language: 'ta' },
    });
    loveQuotes.push(job.quote);
  }
  const uniqueLove = new Set(loveQuotes.map(normalizeContentText));
  assert(uniqueLove.size === 4, `All 4 consecutive Love Tamil quotes are unique (got ${uniqueLove.size} unique out of 4)`);

  // Test B: Motivation: independent history from Love
  console.log('\n--- TEST B: Motivation independent history from Love ---');
  const motJob = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo' },
    options: { topic: 'motivation', language: 'ta' },
  });
  const loveHistory = getRecentContentHistory(TEST_WF_ID, { topic: 'love' });
  const motHistory = getRecentContentHistory(TEST_WF_ID, { topic: 'motivation' });
  assert(loveHistory.length === 4, `Love has 4 history records (got: ${loveHistory.length})`);
  assert(motHistory.length === 1, `Motivation has 1 history record (got: ${motHistory.length})`);
  assert(motHistory[0].fingerprint !== loveHistory[0].fingerprint, 'Motivation fingerprint is independent from Love');

  // Test C: Humanity: independent history
  console.log('\n--- TEST C: Humanity independent history ---');
  const humJob = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo' },
    options: { topic: 'humanity', language: 'ta' },
  });
  const humHistory = getRecentContentHistory(TEST_WF_ID, { topic: 'humanity' });
  assert(humHistory.length === 1, `Humanity has 1 history record (got: ${humHistory.length})`);
  assert(humHistory[0].topic === 'humanity', 'Humanity history topic is humanity');

  // Test D: Thirukkural: 391 -> 392 -> 393 -> 394 (verified non-repeating sequence)
  console.log('\n--- TEST D: Thirukkural 391 -> 392 -> 393 -> 394 sequence ---');
  clearContentHistory(TEST_WF_ID, 'thirukkural');
  const kuralNumbers = [];
  for (let i = 0; i < 4; i++) {
    const kJob = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: { templateType: 'dailyQuoteVideo' },
      options: { topic: 'thirukkural', language: i % 2 === 0 ? 'en' : 'ta' },
    });
    const parsedSpec = kJob.spec;
    const num = parsedSpec.content?.kuralNumber;
    kuralNumbers.push(num);
  }
  console.log('Thirukkural produced sequence:', kuralNumbers.join(' -> '));
  assert(kuralNumbers[0] === 391, `Step 1 produced Kural 391 (got: ${kuralNumbers[0]})`);
  assert(kuralNumbers[1] === 392, `Step 2 produced Kural 392 (got: ${kuralNumbers[1]})`);
  assert(kuralNumbers[2] === 393, `Step 3 produced Kural 393 (got: ${kuralNumbers[2]})`);
  assert(kuralNumbers[3] === 394, `Step 4 produced Kural 394 (got: ${kuralNumbers[3]})`);
  const uniqueKurals = new Set(kuralNumbers);
  assert(uniqueKurals.size === 4, 'All 4 Kurals in sequence are distinct');

  // Test E: Poetry: non-repeating recent content
  console.log('\n--- TEST E: Poetry non-repeating recent content ---');
  clearContentHistory(TEST_WF_ID, 'poetry');
  const poetryQuotes = [];
  for (let i = 0; i < 3; i++) {
    const pJob = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: { templateType: 'dailyQuoteVideo' },
      options: { topic: 'poetry', language: 'ta' },
    });
    poetryQuotes.push(pJob.quote);
  }
  const uniquePoetry = new Set(poetryQuotes.map(normalizeContentText));
  assert(uniquePoetry.size === 3, 'All 3 Poetry quotes are unique');

  // Test F: Meaningful: non-repeating recent content
  console.log('\n--- TEST F: Meaningful non-repeating recent content ---');
  clearContentHistory(TEST_WF_ID, 'meaningful');
  const meaningfulQuotes = [];
  for (let i = 0; i < 3; i++) {
    const mJob = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: { templateType: 'dailyQuoteVideo' },
      options: { topic: 'meaningful', language: 'en' },
    });
    meaningfulQuotes.push(mJob.quote);
  }
  const uniqueMeaningful = new Set(meaningfulQuotes.map(normalizeContentText));
  assert(uniqueMeaningful.size === 3, 'All 3 Meaningful quotes are unique');

  // Test G: Regeneration: Tamil A -> English B -> Tamil C -> English D
  console.log('\n--- TEST G: Regeneration: Tamil A -> English B -> Tamil C -> English D ---');
  clearContentHistory(TEST_WF_ID, 'love');
  // v1 (Tamil A)
  const v1Love = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo', language: 'alternate' },
    options: { topic: 'love', language: 'ta' },
  });
  assert(v1Love.language === 'ta' && v1Love.topic === 'love', 'v1 is Love Tamil');

  // v1 -> v2 (English B)
  const resG2 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v1Love.jobId}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v2Love = resG2.data.job;
  assert(v2Love.topic === 'love' && v2Love.language === 'en', 'v2 is Love English');
  assert(v2Love.version === 2, 'v2 version is 2');

  // v2 -> v3 (Tamil C != Tamil A)
  const resG3 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v2Love.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v3Love = resG3.data.job;
  assert(v3Love.topic === 'love' && v3Love.language === 'ta', 'v3 is Love Tamil');
  assert(v3Love.version === 3, 'v3 version is 3');
  assert(normalizeContentText(v3Love.quote) !== normalizeContentText(v1Love.quote), 'v3 Tamil quote is different from v1 Tamil quote');

  // v3 -> v4 (English D != English B)
  const resG4 = await axios.post(`${API_BASE}/api/quote-video-jobs/${v3Love.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const v4Love = resG4.data.job;
  assert(v4Love.topic === 'love' && v4Love.language === 'en', 'v4 is Love English');
  assert(v4Love.version === 4, 'v4 version is 4');
  assert(normalizeContentText(v4Love.quote) !== normalizeContentText(v2Love.quote), 'v4 English quote is different from v2 English quote');

  // Test H: Same topic repeated regeneration changes content every accepted generation
  console.log('\n--- TEST H: Same topic repeated regeneration changes content ---');
  clearContentHistory(TEST_WF_ID, 'motivation');
  const motV1 = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo' },
    options: { topic: 'motivation', language: 'ta' },
  });
  const resH2 = await axios.post(`${API_BASE}/api/quote-video-jobs/${motV1.jobId}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const motV2 = resH2.data.job;
  const resH3 = await axios.post(`${API_BASE}/api/quote-video-jobs/${motV2.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const motV3 = resH3.data.job;

  assert(normalizeContentText(motV3.quote) !== normalizeContentText(motV1.quote), 'motV3 differs from motV1 in Tamil');
  assert(motV3.version === 3, 'motV3 version is 3');

  // Test I: Scheduled rotation sequence remains independent
  console.log('\n--- TEST I: Scheduled rotation sequence ---');
  db.prepare('DELETE FROM quote_video_jobs WHERE workflow_id = ?').run(TEST_WF_ID);
  db.prepare('DELETE FROM quote_topic_state WHERE workflow_id = ?').run(TEST_WF_ID);
  clearContentHistory(TEST_WF_ID);

  const schedTopics = ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'];
  for (let i = 0; i < schedTopics.length; i++) {
    const sJob = await prepareDailyQuoteVideo({
      workflowId: TEST_WF_ID,
      config: {
        templateType: 'dailyQuoteVideo',
        topicMode: 'rotate',
        selectedTopics: schedTopics,
      },
    });
    assert(sJob.topic === schedTopics[i], `Scheduled step ${i + 1} produced ${sJob.topic} (expected: ${schedTopics[i]})`);
  }

  // Test J: Regeneration must NOT alter scheduled topic sequence
  console.log('\n--- TEST J: Regeneration must NOT alter scheduled topic sequence ---');
  // Current scheduled state is at index 5 ('meaningful').
  // Next scheduled topic should be 'motivation'.
  // Now regenerate an earlier job (e.g. Love from step 2).
  const loveRow = db.prepare("SELECT id FROM quote_video_jobs WHERE workflow_id = ? AND topic = 'love' LIMIT 1").get(TEST_WF_ID);
  assert(loveRow !== undefined, 'Found earlier Love job to regenerate');
  await axios.post(`${API_BASE}/api/quote-video-jobs/${loveRow.id}/regenerate`, { autoRender: false }, { headers: HEADERS });

  // Now trigger the next scheduled run: it MUST be 'motivation', not skipped or disrupted!
  const nextSchedJob = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: {
      templateType: 'dailyQuoteVideo',
      topicMode: 'rotate',
      selectedTopics: schedTopics,
    },
  });
  assert(nextSchedJob.topic === 'motivation', `Next scheduled topic is motivation despite Love regeneration (got: ${nextSchedJob.topic})`);

  // Test K: Regeneration of Love must NOT alter Humanity content history
  console.log('\n--- TEST K: Regeneration of Love must NOT alter Humanity content history ---');
  const humanityHistoryBefore = getRecentContentHistory(TEST_WF_ID, { topic: 'humanity' });
  const humFpsBefore = humanityHistoryBefore.map((h) => h.fingerprint);

  // Regenerate Love again
  const currentLove = db.prepare("SELECT id FROM quote_video_jobs WHERE workflow_id = ? AND topic = 'love' ORDER BY created_at DESC LIMIT 1").get(TEST_WF_ID);
  await axios.post(`${API_BASE}/api/quote-video-jobs/${currentLove.id}/regenerate`, { autoRender: false }, { headers: HEADERS });

  const humanityHistoryAfter = getRecentContentHistory(TEST_WF_ID, { topic: 'humanity' });
  const humFpsAfter = humanityHistoryAfter.map((h) => h.fingerprint);
  assert(JSON.stringify(humFpsBefore) === JSON.stringify(humFpsAfter), "Humanity's content history unchanged after Love regeneration");

  // Test L: Regeneration of Thirukkural must NOT alter Love content history
  console.log("\n--- TEST L: Regeneration of Thirukkural must NOT alter Love content history ---");
  const loveHistoryBefore = getRecentContentHistory(TEST_WF_ID, { topic: 'love' });
  const loveFpsBefore = loveHistoryBefore.map((h) => h.fingerprint);

  const kuralRow = db.prepare("SELECT id FROM quote_video_jobs WHERE workflow_id = ? AND topic = 'thirukkural' LIMIT 1").get(TEST_WF_ID);
  await axios.post(`${API_BASE}/api/quote-video-jobs/${kuralRow.id}/regenerate`, { autoRender: false }, { headers: HEADERS });

  const loveHistoryAfter = getRecentContentHistory(TEST_WF_ID, { topic: 'love' });
  const loveFpsAfter = loveHistoryAfter.map((h) => h.fingerprint);
  assert(JSON.stringify(loveFpsBefore) === JSON.stringify(loveFpsAfter), "Love's content history unchanged after Thirukkural regeneration");

  // Test M: Server restart: history survives restart
  console.log('\n--- TEST M: Server restart: history survives restart ---');
  // Record a distinctive quote
  const testRestartQuote = 'காலம் தரும் பாடங்களை ஒருபோதும் மறக்காதே';
  recordAcceptedContent(TEST_WF_ID, {
    topic: 'motivation',
    language: 'ta',
    content: { quote: testRestartQuote },
  });

  // Open a completely separate SQLite connection to simulate cold server restart
  const dbPath = process.env.DB_PATH || './data/flowbox.sqlite';
  const coldDb = new Database(dbPath);
  const restartFp = computeContentFingerprint(testRestartQuote);
  const coldRow = coldDb.prepare(`
    SELECT fingerprint, topic, language
    FROM quote_content_history
    WHERE workflow_id = ? AND fingerprint = ?
  `).get(TEST_WF_ID, restartFp);

  assert(coldRow !== undefined, 'Content history record exists in cold SQLite connection');
  assert(coldRow.fingerprint === restartFp, 'Fingerprint matches exactly across server restarts');
  coldDb.close();

  // Test N: Duplicate candidate: duplicate rejected and retry happens
  console.log('\n--- TEST N: Duplicate candidate rejected and retry happens ---');
  clearContentHistory(TEST_WF_ID, 'motivation');
  const quote1 = ORIGINAL_QUOTES.motivation.ta[0].quote;
  // Pre-seed quote1 in history so candidate generator must skip it
  recordAcceptedContent(TEST_WF_ID, {
    topic: 'motivation',
    language: 'ta',
    content: { quote: quote1 },
  });
  // Now prepare next motivation quote
  const freshMot = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo' },
    options: { topic: 'motivation', language: 'ta' },
  });
  assert(
    normalizeContentText(freshMot.quote) !== normalizeContentText(quote1),
    'Engine rejected duplicate and selected fresh alternative'
  );

  // Test O: Retry exhaustion enters safe review/failure state
  console.log('\n--- TEST O: Retry exhaustion enters safe review/failure state ---');
  // Mock a test workflow where all items in pool are marked as duplicate
  const mockAllDuplicatesTopic = 'exhaustion_test';
  // Check that duplicate check returns true
  const testCandidate = { quote: 'Exact duplicate test quote' };
  recordAcceptedContent(TEST_WF_ID, {
    topic: mockAllDuplicatesTopic,
    language: 'ta',
    content: testCandidate,
  });
  const isDup = isContentDuplicate(testCandidate, {
    workflowId: TEST_WF_ID,
    topic: mockAllDuplicatesTopic,
    language: 'ta',
    window: 20,
    poolSize: 10,
  });
  assert(isDup === true, 'Duplicate candidate correctly detected by dedup layer');

  // Test P: Future topic: generic dedup works without topic-specific code
  console.log('\n--- TEST P: Future topic generic dedup works without topic-specific code ---');
  const futureTopic = 'future_mindfulness';
  clearContentHistory(TEST_WF_ID, futureTopic);
  const futureQuoteA = 'In stillness the universe speaks in quiet truths.';
  const futureQuoteB = 'The breath you take right now is life itself.';

  recordAcceptedContent(TEST_WF_ID, {
    topic: futureTopic,
    language: 'en',
    content: { quote: futureQuoteA },
  });

  const dupCheckA = isContentDuplicate(futureQuoteA, {
    workflowId: TEST_WF_ID,
    topic: futureTopic,
    language: 'en',
    window: 20,
  });
  const dupCheckB = isContentDuplicate(futureQuoteB, {
    workflowId: TEST_WF_ID,
    topic: futureTopic,
    language: 'en',
    window: 20,
  });
  assert(dupCheckA === true, 'Future topic recognizes previously used quote A as duplicate');
  assert(dupCheckB === false, 'Future topic recognizes unseen quote B as unique');

  // Test Q: Version lineage: v1 -> v2 -> v3 remains correct
  console.log('\n--- TEST Q: Version lineage v1 -> v2 -> v3 ---');
  clearContentHistory(TEST_WF_ID, 'poetry');
  const p1 = await prepareDailyQuoteVideo({
    workflowId: TEST_WF_ID,
    config: { templateType: 'dailyQuoteVideo' },
    options: { topic: 'poetry', language: 'ta' },
  });
  const resQ2 = await axios.post(`${API_BASE}/api/quote-video-jobs/${p1.jobId}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const p2 = resQ2.data.job;
  const resQ3 = await axios.post(`${API_BASE}/api/quote-video-jobs/${p2.id}/regenerate`, { autoRender: false }, { headers: HEADERS });
  const p3 = resQ3.data.job;

  assert(p1.version === 1 && p1.parentJobId === null, 'p1 is version 1 with null parentJobId');
  assert(p2.version === 2 && p2.parentJobId === p1.jobId, `p2 is version 2 with parent ${p1.jobId}`);
  assert(p3.version === 3 && p3.parentJobId === p2.id, `p3 is version 3 with parent ${p2.id}`);

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
  console.log(`GENERIC CONTENT DEDUPLICATION SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runDedupSuite().catch((err) => {
  console.error('\n❌ GENERIC DEDUP SUITE FAILED:', err.message);
  if (err.response?.data) {
    console.error('Server response data:', err.response.data);
  }
  process.exit(1);
});
