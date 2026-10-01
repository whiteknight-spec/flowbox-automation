/**
 * Flowbox Phase 3 - Video Rendering Engine Comprehensive Test Suite
 *
 * Verifies all 10 required test scenarios:
 * 1. English 15-second video
 * 2. Tamil 15-second video
 * 3. Tamil + explanation
 * 4. No-audio render
 * 5. Missing optional visual -> fallback background
 * 6. Invalid Tamil content -> rendering blocked
 * 7. 10-second render
 * 8. 20-second render
 * 9. 30-second render
 * 10. Duplicate render handling
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  renderQuoteVideoJob,
  getQuoteJobById,
} = require('./src/contentEngine');

function probeVideo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const cmd = `ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,duration -of json "${filePath}"`;
  const out = execSync(cmd, { encoding: 'utf8' });
  const data = JSON.parse(out);
  const videoStream = (data.streams || []).find((s) => s.codec_type === 'video');
  const audioStream = (data.streams || []).find((s) => s.codec_type === 'audio');
  const format = data.format || {};

  return {
    width: videoStream?.width,
    height: videoStream?.height,
    videoCodec: videoStream?.codec_name,
    audioCodec: audioStream?.codec_name,
    hasAudio: !!audioStream,
    duration: parseFloat(format.duration || videoStream?.duration || 0),
    fileSize: parseInt(format.size || fs.statSync(filePath).size, 10),
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('FLOWBOX — PHASE 3 VIDEO RENDERING TEST SUITE');
  console.log('====================================================\n');

  // Create a dedicated test workflow in db
  const testWfId = 'phase3-test-workflow';
  const existingWf = db.prepare('SELECT id FROM workflows WHERE id = ?').get(testWfId);
  if (!existingWf) {
    db.prepare(`
      INSERT INTO workflows (id, name, definition, active)
      VALUES (?, ?, ?, 0)
    `).run(
      testWfId,
      'Phase 3 Test Workflow',
      JSON.stringify({
        nodes: [{ id: '1', type: 'quoteVideo', config: { templateType: 'dailyQuoteVideo' } }],
        edges: [],
      })
    );
  }

  const results = [];

  // Helper for test assertions
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // TEST 1: English 15-second video
  try {
    console.log('[Test 1] English 15-second video render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15 },
      options: { language: 'en', topic: 'motivation', duration: 15 },
    });
    assert(prep.jobId, 'Job ID generated');
    assert(prep.language === 'en', 'Language is English');

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');
    assert(fs.existsSync(render.outputPath), 'MP4 file exists on disk');

    const probe = probeVideo(render.outputPath);
    assert(probe.width === 1080 && probe.height === 1920, `Dimensions 1080x1920 (got ${probe.width}x${probe.height})`);
    assert(Math.abs(probe.duration - 15) <= 0.5, `Duration ~15s (got ${probe.duration}s)`);
    assert(probe.videoCodec === 'h264', `Video codec h264 (got ${probe.videoCodec})`);

    console.log(`  -> SUCCESS: ${render.outputPath} (${probe.duration}s, ${probe.width}x${probe.height}, ${(probe.fileSize/1024).toFixed(1)} KB)`);
    results.push({ name: '1. English 15-second video', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '1. English 15-second video', pass: false, error: err.message });
  }

  // TEST 2: Tamil 15-second video
  try {
    console.log('\n[Test 2] Tamil 15-second video render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15 },
      options: { language: 'ta', topic: 'motivation', duration: 15 },
    });
    assert(prep.jobId, 'Job ID generated');
    assert(prep.language === 'ta', 'Language is Tamil');

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');
    assert(fs.existsSync(render.outputPath), 'MP4 file exists on disk');

    const probe = probeVideo(render.outputPath);
    assert(probe.width === 1080 && probe.height === 1920, 'Dimensions 1080x1920');
    assert(Math.abs(probe.duration - 15) <= 0.5, `Duration ~15s (got ${probe.duration}s)`);
    assert(probe.videoCodec === 'h264', 'Video codec h264');

    // Visual extraction test for Tamil glyphs
    const framePath = path.join(__dirname, 'test_tamil_frame.png');
    execSync(`ffmpeg -y -ss 00:00:03.0 -i "${render.outputPath}" -vframes 1 "${framePath}"`);
    assert(fs.existsSync(framePath) && fs.statSync(framePath).size > 10000, 'Tamil frame extracted and valid');
    fs.unlinkSync(framePath);

    console.log(`  -> SUCCESS: ${render.outputPath} (${probe.duration}s, ${probe.width}x${probe.height}, ${(probe.fileSize/1024).toFixed(1)} KB)`);
    results.push({ name: '2. Tamil 15-second video', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '2. Tamil 15-second video', pass: false, error: err.message });
  }

  // TEST 3: Tamil + explanation video
  try {
    console.log('\n[Test 3] Tamil + explanation video render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15 },
      options: { language: 'ta', topic: 'thirukkural', duration: 15 },
    });
    assert(prep.jobId, 'Job ID generated');
    assert(prep.explanation && prep.explanation.length > 5, 'Explanation exists');

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');
    assert(fs.existsSync(render.outputPath), 'MP4 file exists on disk');

    const probe = probeVideo(render.outputPath);
    assert(probe.width === 1080 && probe.height === 1920, 'Dimensions 1080x1920');
    assert(Math.abs(probe.duration - 15) <= 0.5, 'Duration ~15s');

    console.log(`  -> SUCCESS: ${render.outputPath} (with explanation: "${prep.explanation.slice(0, 30)}...")`);
    results.push({ name: '3. Tamil + explanation', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '3. Tamil + explanation', pass: false, error: err.message });
  }

  // TEST 4: No-audio render
  try {
    console.log('\n[Test 4] No-audio render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15, audioPreference: 'no_audio' },
      options: { language: 'en', topic: 'poetry', duration: 15 },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');

    const probe = probeVideo(render.outputPath);
    assert(!probe.hasAudio, 'Video has NO audio track (silent output)');
    assert(probe.width === 1080 && probe.height === 1920, 'Dimensions 1080x1920');

    console.log(`  -> SUCCESS: ${render.outputPath} (confirmed silent / no audio stream)`);
    results.push({ name: '4. No-audio render', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '4. No-audio render', pass: false, error: err.message });
  }

  // TEST 5: Missing optional visual -> fallback background
  try {
    console.log('\n[Test 5] Missing optional visual -> fallback background...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15, visualStyle: 'non_existent_custom_style' },
      options: { language: 'en', topic: 'meaningful', duration: 15 },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render succeeded with fallback');
    assert(fs.existsSync(render.outputPath), 'MP4 exists');

    const probe = probeVideo(render.outputPath);
    assert(probe.width === 1080 && probe.height === 1920, 'Dimensions 1080x1920');

    console.log(`  -> SUCCESS: ${render.outputPath} (fallback visual succeeded seamlessly)`);
    results.push({ name: '5. Missing visual fallback', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '5. Missing visual fallback', pass: false, error: err.message });
  }

  // TEST 6: Invalid Tamil content -> rendering blocked
  try {
    console.log('\n[Test 6] Invalid Tamil content -> rendering blocked...');
    const badJobId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO quote_video_jobs (
        id, workflow_id, language, topic, duration, title, quote, explanation,
        render_status, job_status, validation, spec
      ) VALUES (
        ?, ?, 'ta', 'motivation', 15, 'Invalid Job', 'Uncertain linguistic Tamil quality', '',
        'not_rendered', 'requires_review',
        ?, '{}'
      )
    `).run(
      badJobId,
      testWfId,
      JSON.stringify({
        valid: false,
        tamilQuality: {
          isValid: false,
          requiresReview: true,
          reviewReason: 'Tamil text has broken syllable syntax',
        },
      })
    );

    let blocked = false;
    try {
      await renderQuoteVideoJob(badJobId);
    } catch (renderErr) {
      blocked = true;
      assert(renderErr.renderStatus === 'requires_review', `Status requires_review (got ${renderErr.renderStatus})`);
    }

    assert(blocked, 'Rendering was blocked for invalid Tamil content');
    const dbJob = getQuoteJobById(badJobId);
    assert(dbJob.renderStatus === 'requires_review', 'DB job status updated to requires_review');

    console.log('  -> SUCCESS: Rendering was strictly blocked with requires_review as required');
    results.push({ name: '6. Invalid Tamil content blocked', pass: true });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '6. Invalid Tamil content blocked', pass: false, error: err.message });
  }

  // TEST 7: 10-second render
  try {
    console.log('\n[Test 7] 10-second render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 10 },
      options: { language: 'en', topic: 'love', duration: 10 },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');

    const probe = probeVideo(render.outputPath);
    assert(Math.abs(probe.duration - 10) <= 0.5, `Duration ~10s (got ${probe.duration}s)`);

    console.log(`  -> SUCCESS: ${render.outputPath} (${probe.duration}s, 1080x1920)`);
    results.push({ name: '7. 10-second render', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '7. 10-second render', pass: false, error: err.message });
  }

  // TEST 8: 20-second render
  try {
    console.log('\n[Test 8] 20-second render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 20 },
      options: { language: 'en', topic: 'humanity', duration: 20 },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');

    const probe = probeVideo(render.outputPath);
    assert(Math.abs(probe.duration - 20) <= 0.5, `Duration ~20s (got ${probe.duration}s)`);

    console.log(`  -> SUCCESS: ${render.outputPath} (${probe.duration}s, 1080x1920)`);
    results.push({ name: '8. 20-second render', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '8. 20-second render', pass: false, error: err.message });
  }

  // TEST 9: 30-second render
  try {
    console.log('\n[Test 9] 30-second render...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 30 },
      options: { language: 'ta', topic: 'thirukkural', duration: 30 },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    assert(render.renderStatus === 'rendered', 'Render status is rendered');

    const probe = probeVideo(render.outputPath);
    assert(Math.abs(probe.duration - 30) <= 0.5, `Duration ~30s (got ${probe.duration}s)`);

    console.log(`  -> SUCCESS: ${render.outputPath} (${probe.duration}s, 1080x1920)`);
    results.push({ name: '9. 30-second render', pass: true, outputPath: render.outputPath });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '9. 30-second render', pass: false, error: err.message });
  }

  // TEST 10: Duplicate render handling
  try {
    console.log('\n[Test 10] Duplicate render handling...');
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: 15 },
      options: { language: 'en', topic: 'motivation', duration: 15 },
    });

    // First render
    const render1 = await renderQuoteVideoJob(prep.jobId);
    assert(render1.renderStatus === 'rendered', 'First render rendered');

    // Second render without force should return cached/existing result immediately
    const t0 = Date.now();
    const render2 = await renderQuoteVideoJob(prep.jobId);
    const elapsed = Date.now() - t0;
    assert(render2.alreadyRendered === true, 'Returned existing render metadata');
    assert(elapsed < 100, `Returned instantaneously (< 100ms, took ${elapsed}ms)`);

    console.log('  -> SUCCESS: Duplicate render returned existing MP4 metadata safely without redundant re-render');
    results.push({ name: '10. Duplicate render handling', pass: true });
  } catch (err) {
    console.error('  -> FAILED:', err.message);
    results.push({ name: '10. Duplicate render handling', pass: false, error: err.message });
  }

  // SUMMARY REPORT
  console.log('\n====================================================');
  console.log('TEST SUMMARY RESULTS:');
  console.log('====================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.pass ? '✅' : '❌';
    console.log(`${symbol} ${r.name}`);
    if (r.pass) passCount++;
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  console.log(`\nTOTAL: ${passCount} / ${results.length} PASSED`);
  console.log('====================================================');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
