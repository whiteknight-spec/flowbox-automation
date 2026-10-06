/**
 * Flowbox Phase 4 - Visual QA Script
 *
 * Renders representative videos for all 7 primary topics and extracts
 * representative PNG frames at t=5.0s to allow manual visual inspection.
 *
 * Topics inspected:
 * A. Tamil Motivation
 * B. English Motivation
 * C. Tamil Love
 * D. One-Sided Love
 * E. Thirukkural + explanation
 * F. Poetry
 * G. Meaningful
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const db = require('./src/db');
const {
  prepareDailyQuoteVideo,
  renderQuoteVideoJob,
} = require('./src/contentEngine');

const QA_DIR = path.resolve(__dirname, 'qa_frames');
if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

const QA_TARGETS = [
  { code: 'A', id: 'tamil_motivation', topic: 'motivation', language: 'ta', duration: 15, label: 'Tamil Motivation' },
  { code: 'B', id: 'english_motivation', topic: 'motivation', language: 'en', duration: 15, label: 'English Motivation' },
  { code: 'C', id: 'tamil_love', topic: 'love', language: 'ta', duration: 15, label: 'Tamil Love' },
  { code: 'D', id: 'one_sided_love', topic: 'one_sided_love', language: 'ta', duration: 15, label: 'One-Sided Love' },
  { code: 'E', id: 'thirukkural', topic: 'thirukkural', language: 'ta', duration: 15, label: 'Thirukkural + Explanation' },
  { code: 'F', id: 'poetry', topic: 'poetry', language: 'ta', duration: 15, label: 'Poetry' },
  { code: 'G', id: 'meaningful', topic: 'meaningful', language: 'en', duration: 15, label: 'Meaningful' },
];

async function runVisualQA() {
  console.log('====================================================');
  console.log('FLOWBOX — PHASE 4 VISUAL QA FRAME GENERATOR');
  console.log('====================================================\n');

  const testWfId = 'phase3-test-workflow';
  const frames = [];

  for (const item of QA_TARGETS) {
    console.log(`[QA ${item.code}] Preparing & rendering ${item.label}...`);
    const prep = await prepareDailyQuoteVideo({
      workflowId: testWfId,
      config: { duration: item.duration },
      options: {
        topic: item.topic,
        language: item.language,
        duration: item.duration,
      },
    });

    const render = await renderQuoteVideoJob(prep.jobId);
    console.log(`  Rendered MP4: ${render.outputPath}`);

    // Extract frame at 5.0 seconds
    const framePath = path.join(QA_DIR, `qa_${item.code}_${item.id}_frame.png`);
    const cmd = `ffmpeg -y -ss 00:00:05.000 -i "${render.outputPath}" -vframes 1 -q:v 2 "${framePath}"`;
    execSync(cmd, { stdio: 'ignore' });

    console.log(`  Extracted frame: ${framePath}`);
    frames.push({
      code: item.code,
      label: item.label,
      videoPath: render.outputPath,
      framePath,
      visualTitle: render.visualTitle,
      backgroundType: render.visualStrategy?.backgroundType,
    });
  }

  console.log('\n====================================================');
  console.log('VISUAL QA FRAMES EXTRACTED SUCCESSFULLY:');
  console.log('====================================================');
  frames.forEach((f) => {
    console.log(`[${f.code}] ${f.label} (${f.visualTitle}) -> ${f.framePath}`);
  });

  return frames;
}

if (require.main === module) {
  runVisualQA().catch((err) => {
    console.error('Visual QA run failed:', err);
    process.exit(1);
  });
}

module.exports = { runVisualQA };
