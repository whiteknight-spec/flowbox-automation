const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  renderQuoteVideoJob,
  getQuoteJobById,
  getLatestQuoteJob,
} = require('./src/contentEngine');
const { regenerateQuoteVideoJob } = require('./src/contentEngine/reviewManager');

const PROD_WORKFLOW_ID = 'e1365ac8-e429-4ef9-92f5-cb4a8979aaeb';
const TEST_WORKFLOW_ID = 'test-repeated-regeneration-wf';

async function run() {
  console.log('====================================================');
  console.log('STARTING REPEATED REGENERATION SUITE (v1 -> v2 -> v3 -> v4 -> v5 -> v6)');
  console.log('====================================================');

  // 1. Initial Production Safety Check
  console.log('\n--- PRODUCTION SAFETY CHECK ---');
  const prodWf = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(prodWf, `Production workflow ${PROD_WORKFLOW_ID} exists`);
  assert(prodWf.active === 1, 'Production workflow is active (1)');
  const prodDef = JSON.parse(prodWf.definition || '{}');
  const prodSchedule = prodDef.nodes?.find(n => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(prodSchedule === '0 19 * * *', `Production schedule is 0 19 * * * (got: ${prodSchedule})`);
  console.log('✅ PASSED: Production workflow is safe and intact.');

  // Create isolated test workflow
  db.prepare(`
    INSERT OR REPLACE INTO workflows (id, name, definition, active, updated_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `).run(
    TEST_WORKFLOW_ID,
    'Repeated Regeneration Test Workflow',
    JSON.stringify({
      nodes: [
        {
          id: 'qv-1',
          type: 'quoteVideo',
          config: {
            templateType: 'dailyQuoteVideo',
            topic: 'poetry',
            duration: 10,
          },
        },
      ],
      edges: [],
    })
  );

  // 2. Prepare and render v1
  console.log('\n--- STEP 1: Prepare & Render v1 ---');
  const prep1 = await prepareDailyQuoteVideo({
    workflowId: TEST_WORKFLOW_ID,
    config: { templateType: 'dailyQuoteVideo', topic: 'poetry', duration: 10 },
  });
  assert(prep1 && prep1.jobId, 'v1 prepared successfully');

  await renderQuoteVideoJob(prep1.jobId);
  const v1Job = getQuoteJobById(prep1.jobId);
  assert(v1Job.version === 1, `v1 version is 1 (got: ${v1Job.version})`);
  assert(v1Job.reviewStatus === 'ready_for_review', 'v1 reviewStatus is ready_for_review');
  assert(v1Job.renderStatus === 'rendered', 'v1 renderStatus is rendered');
  assert(fs.existsSync(v1Job.outputPath), 'v1 MP4 exists on disk');
  console.log(`✅ PASSED: v1 created and rendered (${v1Job.id}, language: ${v1Job.language})`);

  // 3. Chain regenerations from v1 to v6
  const versions = [v1Job];

  for (let targetVer = 2; targetVer <= 6; targetVer++) {
    const prevJob = versions[versions.length - 1];
    console.log(`\n--- STEP ${targetVer}: Regenerate v${prevJob.version} -> v${targetVer} ---`);

    const result = await regenerateQuoteVideoJob(prevJob.id, { autoRender: true });
    assert(result && result.success, `Regeneration from v${prevJob.version} to v${targetVer} succeeded`);

    const newJob = result.job;
    assert(newJob.version === targetVer, `v${targetVer} version matches ${targetVer} (got: ${newJob.version})`);
    assert(newJob.parentJobId === prevJob.id, `v${targetVer} parentJobId matches previous job ${prevJob.id}`);
    assert(newJob.reviewStatus === 'ready_for_review', `v${targetVer} is ready_for_review`);
    assert(newJob.renderStatus === 'rendered', `v${targetVer} is rendered`);
    assert(fs.existsSync(newJob.outputPath), `v${targetVer} MP4 exists at ${newJob.outputPath}`);

    // Verify previous version is preserved in DB and on disk
    const oldJobCheck = getQuoteJobById(prevJob.id);
    assert(oldJobCheck.reviewStatus === 'regenerate_requested', `Previous v${prevJob.version} is regenerate_requested`);
    assert(fs.existsSync(oldJobCheck.outputPath), `Previous v${prevJob.version} MP4 file remains intact`);

    // Verify latest quote job for workflow is the new version
    const latest = getLatestQuoteJob(TEST_WORKFLOW_ID);
    assert(latest.id === newJob.id, `Latest quote job for workflow is v${targetVer} (${latest.id})`);

    console.log(`✅ PASSED: v${targetVer} successfully prepared and rendered (topic: ${newJob.topic}, lang: ${newJob.language}, parent: ${newJob.parentJobId})`);
    versions.push(newJob);
  }

  // 4. Verify lineage integrity across all 6 versions
  console.log('\n--- VERIFY ALL 6 VERSIONS IN DATABASE ---');
  const allJobIds = versions.map(v => v.id);
  const rows = db.prepare(`
    SELECT id, version, language, topic, review_status, parent_job_id, output_path
    FROM quote_video_jobs
    WHERE workflow_id = ?
    ORDER BY version ASC
  `).all(TEST_WORKFLOW_ID);

  assert(rows.length >= 6, `At least 6 rows exist in database (got: ${rows.length})`);

  for (let i = 0; i < 6; i++) {
    const row = rows[i];
    const expectedVer = i + 1;
    assert(row.version === expectedVer, `Row ${i} version is ${expectedVer}`);
    if (i > 0) {
      assert(row.parent_job_id === rows[i - 1].id, `Row ${i} parent matches row ${i - 1} id`);
    } else {
      assert(!row.parent_job_id, 'Row 0 (v1) parent is null');
    }
    assert(fs.existsSync(row.output_path), `Row ${i} MP4 file physically preserved`);
    if (i < 5) {
      assert(row.review_status === 'regenerate_requested', `Row ${i} status is regenerate_requested`);
    } else {
      assert(row.review_status === 'ready_for_review', 'Latest row (v6) status is ready_for_review');
    }
    console.log(`✅ PASSED: v${expectedVer} DB record verified: id=${row.id}, status=${row.review_status}, parent=${row.parent_job_id || 'root'}`);
  }

  // 5. Final Production Safety Check
  console.log('\n--- FINAL PRODUCTION SAFETY CHECK ---');
  const finalProd = db.prepare('SELECT id, active, definition FROM workflows WHERE id = ?').get(PROD_WORKFLOW_ID);
  assert(finalProd.active === 1, 'Production workflow is still active=1');
  const finalDef = JSON.parse(finalProd.definition || '{}');
  const finalCron = finalDef.nodes?.find(n => n.type === 'scheduleTrigger' || n.type === 'schedule')?.config?.cron;
  assert(finalCron === '0 19 * * *', 'Production schedule is still 0 19 * * *');
  console.log('✅ PASSED: Production workflow is completely untouched.');

  console.log('\n====================================================');
  console.log('REPEATED REGENERATION SUITE: ALL TESTS PASSED (v1 -> v6)');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err.message);
  process.exit(1);
});
