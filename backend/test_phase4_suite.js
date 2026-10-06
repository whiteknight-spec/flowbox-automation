/**
 * Flowbox Phase 4 - Cinematic Visual Enhancement Comprehensive Test Suite
 *
 * Verifies all 18 required scenarios:
 * 1. English motivation
 * 2. Tamil motivation
 * 3. Tamil love
 * 4. English love
 * 5. One-sided love
 * 6. Humanity
 * 7. Thirukkural + explanation
 * 8. Poetry
 * 9. Meaningful
 * 10. 10 sec
 * 11. 15 sec
 * 12. 20 sec
 * 13. 30 sec
 * 14. Long Tamil quote
 * 15. Long English quote
 * 16. No audio
 * 17. Plain black fallback
 * 18. Existing invalid Tamil rejection
 *
 * Verifications per render:
 * - 1080x1920 portrait dimensions
 * - Valid duration within +/-0.6s of target
 * - Codecs: h264 video, aac audio (or silent if no audio)
 * - Safe-area bounds compliance
 * - Non-empty valid MP4 file
 * - Topic-aware visual profile and visualTitle
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('FLOWBOX — PHASE 4 CINEMATIC VISUAL ENHANCEMENT TEST SUITE');
  console.log('====================================================\n');

  const testWfId = 'phase3-test-workflow';
  const existingWf = db.prepare('SELECT id FROM workflows WHERE id = ?').get(testWfId);
  if (!existingWf) {
    db.prepare(`
      INSERT INTO workflows (id, name, definition, active)
      VALUES (?, ?, ?, 0)
    `).run(
      testWfId,
      'Phase 4 Test Workflow',
      JSON.stringify({
        nodes: [{ id: '1', type: 'quoteVideo', config: { templateType: 'dailyQuoteVideo' } }],
        edges: [],
      })
    );
  }

  const results = [];

  const testCases = [
    {
      id: 1,
      name: 'English motivation',
      opts: { topic: 'motivation', language: 'en', duration: 15 },
      expectedTitleIncludes: 'Motivation',
      expectedBg: 'cinematic_gradient_depth',
    },
    {
      id: 2,
      name: 'Tamil motivation',
      opts: { topic: 'motivation', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'Motivation',
      expectedBg: 'cinematic_gradient_depth',
    },
    {
      id: 3,
      name: 'Tamil love',
      opts: { topic: 'love', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'Love',
      expectedBg: 'soft_fog_glow',
    },
    {
      id: 4,
      name: 'English love',
      opts: { topic: 'love', language: 'en', duration: 15 },
      expectedTitleIncludes: 'Love',
      expectedBg: 'soft_fog_glow',
    },
    {
      id: 5,
      name: 'One-sided love',
      opts: { topic: 'one_sided_love', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'One-Sided Love',
      expectedBg: 'atmospheric_light_beam',
    },
    {
      id: 6,
      name: 'Humanity',
      opts: { topic: 'humanity', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'Humanity',
      expectedBg: 'abstract_organic_waves',
    },
    {
      id: 7,
      name: 'Thirukkural + explanation',
      opts: { topic: 'thirukkural', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'Thirukkural',
      expectedBg: 'subtle_grain_vignette',
    },
    {
      id: 8,
      name: 'Poetry',
      opts: { topic: 'poetry', language: 'ta', duration: 15 },
      expectedTitleIncludes: 'Poetry',
      expectedBg: 'soft_fog_glow',
    },
    {
      id: 9,
      name: 'Meaningful',
      opts: { topic: 'meaningful', language: 'en', duration: 15 },
      expectedTitleIncludes: 'Meaningful',
      expectedBg: 'minimal_light_field',
    },
    {
      id: 10,
      name: '10 sec duration',
      opts: { topic: 'motivation', language: 'en', duration: 10 },
      targetDuration: 10,
    },
    {
      id: 11,
      name: '15 sec duration',
      opts: { topic: 'motivation', language: 'ta', duration: 15 },
      targetDuration: 15,
    },
    {
      id: 12,
      name: '20 sec duration',
      opts: { topic: 'humanity', language: 'ta', duration: 20 },
      targetDuration: 20,
    },
    {
      id: 13,
      name: '30 sec duration',
      opts: { topic: 'thirukkural', language: 'ta', duration: 30 },
      targetDuration: 30,
    },
    {
      id: 14,
      name: 'Long Tamil quote',
      customQuote: {
        topic: 'motivation',
        language: 'ta',
        quote: 'விடாமுயற்சியும் தன்னம்பிக்கையும் உங்களை எந்த உயரத்திற்கும் கொண்டு செல்லும்; கடின உழைப்புக்கு ஈடு இணை எதுவும் இல்லை இந்த உலகத்தில்.',
        explanation: 'விடாமுயற்சியும் தன்னம்பிக்கையும் மனிதனை எப்போதும் சிகரத்திற்கு உயர்த்தும் மாபெரும் சக்திகள்.',
      },
      opts: { duration: 15 },
    },
    {
      id: 15,
      name: 'Long English quote',
      customQuote: {
        topic: 'meaningful',
        language: 'en',
        quote: 'Do not go where the path may lead, go instead where there is no path and leave a trail for those who follow you with courage and conviction.',
        explanation: 'True leadership and enduring wisdom require forging new paths rather than passively following familiar trails.',
      },
      opts: { duration: 15 },
    },
    {
      id: 16,
      name: 'No audio render',
      opts: { topic: 'meaningful', language: 'en', duration: 10 },
      audioPreference: 'none',
      expectNoAudio: true,
    },
    {
      id: 17,
      name: 'Plain black fallback',
      opts: { topic: 'poetry', language: 'ta', duration: 10, visualStyle: 'plain_black' },
      expectedBg: 'plain_black',
      expectedTitleIncludes: 'Plain Black',
    },
  ];

  for (const tc of testCases) {
    try {
      console.log(`[Test ${tc.id}] ${tc.name}...`);
      let prep;

      if (tc.customQuote) {
        // Direct insertion / preparation with custom quote
        prep = await prepareDailyQuoteVideo({
          workflowId: testWfId,
          config: { duration: tc.opts.duration || 15, visualStyle: tc.opts.visualStyle },
          options: {
            topic: tc.customQuote.topic,
            language: tc.customQuote.language,
            duration: tc.opts.duration || 15,
          },
        });
        // Override the quote text in the db job record to test long text layout
        db.prepare(`
          UPDATE quote_video_jobs
          SET quote = ?, explanation = ?
          WHERE id = ?
        `).run(tc.customQuote.quote, tc.customQuote.explanation, prep.jobId);
      } else {
        prep = await prepareDailyQuoteVideo({
          workflowId: testWfId,
          config: { duration: tc.opts.duration || 15, visualStyle: tc.opts.visualStyle },
          options: {
            topic: tc.opts.topic,
            language: tc.opts.language,
            duration: tc.opts.duration || 15,
            visualStyle: tc.opts.visualStyle,
          },
        });
      }

      if (tc.audioPreference === 'none') {
        db.prepare(`
          UPDATE quote_video_jobs
          SET audio_strategy = ?
          WHERE id = ?
        `).run(JSON.stringify({ preference: 'none', status: 'resolved' }), prep.jobId);
      }

      const render = await renderQuoteVideoJob(prep.jobId);
      assert(render.renderStatus === 'rendered', `Render status is rendered (got ${render.renderStatus})`);
      assert(fs.existsSync(render.outputPath), 'MP4 file exists on disk');

      const probe = probeVideo(render.outputPath);
      assert(probe.width === 1080 && probe.height === 1920, `Dimensions 1080x1920 (got ${probe.width}x${probe.height})`);
      assert(probe.videoCodec === 'h264', `Video codec is h264 (got ${probe.videoCodec})`);

      const targetDur = tc.targetDuration || tc.opts.duration || 15;
      assert(Math.abs(probe.duration - targetDur) <= 0.6, `Duration ~${targetDur}s (got ${probe.duration}s)`);

      if (tc.expectNoAudio) {
        assert(!probe.hasAudio, 'Video correctly has no audio track');
      } else {
        assert(probe.hasAudio && probe.audioCodec === 'aac', `Audio codec is aac (got ${probe.audioCodec})`);
      }

      if (tc.expectedTitleIncludes) {
        assert(
          render.visualTitle && render.visualTitle.includes(tc.expectedTitleIncludes),
          `Visual title contains '${tc.expectedTitleIncludes}' (got '${render.visualTitle}')`
        );
      }

      if (tc.expectedBg) {
        assert(
          render.visualStrategy?.backgroundType === tc.expectedBg,
          `Background type is ${tc.expectedBg} (got ${render.visualStrategy?.backgroundType})`
        );
      }

      // Verify safe-area metadata in renderPlan
      if (render.renderPlan?.safeArea) {
        const sa = render.renderPlan.safeArea;
        assert(sa.top === 320, `Safe top is 320 (got ${sa.top})`);
        assert(sa.bottom === 1540, `Safe bottom is 1540 (got ${sa.bottom})`);
        assert(sa.maxContentWidth <= 840, `Safe content width <= 840 (got ${sa.maxContentWidth})`);
      }

      console.log(`  -> PASSED: ${probe.duration.toFixed(1)}s, ${render.visualTitle}, ${(probe.fileSize / 1024).toFixed(1)} KB`);
      results.push({ id: tc.id, name: tc.name, passed: true, outputPath: render.outputPath, visualTitle: render.visualTitle });
    } catch (err) {
      console.error(`  -> FAILED: ${err.message}`);
      results.push({ id: tc.id, name: tc.name, passed: false, error: err.message });
    }
  }

  // TEST 18: Existing invalid Tamil rejection
  try {
    console.log('[Test 18] Existing invalid Tamil rejection...');
    const invalidJobId = 'test-invalid-tamil-phase4';
    db.prepare(`
      INSERT OR REPLACE INTO quote_video_jobs (
        id, workflow_id, language, topic, duration, title, quote, explanation,
        render_status, job_status, validation, spec
      ) VALUES (
        ?, ?, 'ta', 'motivation', 15, 'Invalid Job', 'Uncertain linguistic Tamil quality', '',
        'not_rendered', 'requires_review',
        ?, '{}'
      )
    `).run(
      invalidJobId,
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

    let threw = false;
    try {
      await renderQuoteVideoJob(invalidJobId);
    } catch (e) {
      threw = true;
      assert(
        e.message.includes('requires_review') || e.message.includes('review') || e.message.includes('validation') || e.message.includes('quality'),
        `Error message mentions quality rejection (got: ${e.message})`
      );
    }
    assert(threw, 'Invalid Tamil was rejected before rendering');
    console.log('  -> PASSED: Invalid Tamil was strictly rejected');
    results.push({ id: 18, name: 'Existing invalid Tamil rejection', passed: true });
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
    results.push({ id: 18, name: 'Existing invalid Tamil rejection', passed: false, error: err.message });
  }

  console.log('\n====================================================');
  console.log('TEST SUMMARY');
  console.log('====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);

  return results;
}

if (require.main === module) {
  runPhase4Tests().then((res) => {
    const failed = res.filter((r) => !r.passed);
    if (failed.length > 0) {
      process.exit(1);
    }
    process.exit(0);
  });
}

module.exports = { runPhase4Tests };
