/**
 * Video Preparation Engine
 *
 * Orchestrates the complete Daily Quote Video internal content pipeline:
 * 1. Load automation config
 * 2. Deterministically resolve language
 * 3. Deterministically resolve topic
 * 4. Generate original content
 * 5. Run content quality check (with limited retries)
 * 6. Select visual strategy
 * 7. Select audio strategy
 * 8. Build structured video preparation specification
 * 9. Persist job state to SQLite
 *
 * STATE PROGRESSION:
 * queued -> generating_content -> validation_passed -> content_ready / ready_for_render
 * (Never marks rendered or published)
 */

const crypto = require('crypto');
const db = require('../db');
const { resolveLanguage, resolveLanguageForTopic, getLanguageMeta } = require('./languageRotation');
const { resolveTopic, getTopicMeta } = require('./topicRotation');
const { generateQuoteContent } = require('./contentGenerator');
const { validateContent } = require('./contentValidator');
const { selectVisualStrategy } = require('./visualStrategy');
const { selectAudioStrategy } = require('./audioStrategy');

// In-memory fallback for test harnesses or executions without persistent workflowId
const memoryTopicState = new Map(); // key: `${workflowId || 'local'}:${topic}` -> { last_language, occurrence_count }

/**
 * Gets the previous language used for a specific topic in a workflow.
 */
function getTopicPreviousLanguage(workflowId, topic) {
  if (!topic) return null;
  const normalizedTopic = String(topic).toLowerCase().trim();

  if (workflowId) {
    try {
      // 1. Check dedicated topic state table
      const row = db
        .prepare('SELECT last_language FROM quote_topic_state WHERE workflow_id = ? AND topic = ?')
        .get(workflowId, normalizedTopic);
      if (row?.last_language) {
        return row.last_language;
      }

      // 2. Fallback: check latest job for this specific topic in quote_video_jobs
      const jobRow = db
        .prepare('SELECT language FROM quote_video_jobs WHERE workflow_id = ? AND topic = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
        .get(workflowId, normalizedTopic);
      if (jobRow?.language) {
        return jobRow.language;
      }
    } catch (err) {
      console.error('[getTopicPreviousLanguage] DB lookup error:', err);
    }
  }

  // Fallback to in-memory store
  const memKey = `${workflowId || 'local'}:${normalizedTopic}`;
  return memoryTopicState.get(memKey)?.last_language || null;
}

/**
 * Gets the entire per-topic language state dictionary for a workflow.
 * Conceptually:
 * {
 *   motivation: "ta",
 *   love: "en",
 *   humanity: "ta",
 *   thirukkural: "en",
 *   poetry: "ta",
 *   meaningful: "en"
 * }
 */
function getTopicLanguageState(workflowId) {
  const state = {};
  if (workflowId) {
    try {
      const rows = db
        .prepare('SELECT topic, last_language, occurrence_count FROM quote_topic_state WHERE workflow_id = ?')
        .all(workflowId);
      for (const r of rows) {
        state[r.topic] = r.last_language;
      }
    } catch (err) {
      console.error('[getTopicLanguageState] DB lookup error:', err);
    }
  }

  // Merge in any in-memory state entries if not already set
  for (const [key, val] of memoryTopicState.entries()) {
    const prefix = `${workflowId || 'local'}:`;
    if (key.startsWith(prefix)) {
      const topic = key.slice(prefix.length);
      if (!state[topic]) {
        state[topic] = val.last_language;
      }
    }
  }

  return state;
}

/**
 * Persists the language state for a specific topic in a workflow.
 */
function saveTopicLanguageState(workflowId, topic, language) {
  if (!topic || !language) return;
  const normalizedTopic = String(topic).toLowerCase().trim();
  const normalizedLanguage = String(language).toLowerCase().trim();

  // Update in-memory store
  const memKey = `${workflowId || 'local'}:${normalizedTopic}`;
  const prevCount = memoryTopicState.get(memKey)?.occurrence_count || 0;
  memoryTopicState.set(memKey, {
    last_language: normalizedLanguage,
    occurrence_count: prevCount + 1,
  });

  // Persist to SQLite (if workflow exists in database)
  if (workflowId) {
    try {
      const wfExists = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflowId);
      if (wfExists) {
        db.prepare(`
          INSERT INTO quote_topic_state (workflow_id, topic, last_language, occurrence_count, updated_at)
          VALUES (?, ?, ?, 1, datetime('now'))
          ON CONFLICT(workflow_id, topic) DO UPDATE SET
            last_language = excluded.last_language,
            occurrence_count = quote_topic_state.occurrence_count + 1,
            updated_at = datetime('now')
        `).run(workflowId, normalizedTopic, normalizedLanguage);
      }
    } catch (err) {
      console.error('[saveTopicLanguageState] DB persist error:', err);
    }
  }
}

/**
 * Gets the most recent quote video job for a workflow.
 */
function getLatestQuoteJob(workflowId) {
  if (!workflowId) return null;
  const row = db
    .prepare('SELECT * FROM quote_video_jobs WHERE workflow_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(workflowId);
  if (!row) return null;
  return parseJobRow(row);
}

/**
 * Lists past quote video jobs for a workflow.
 */
function listQuoteJobs(workflowId, limit = 20) {
  if (!workflowId) return [];
  const rows = db
    .prepare('SELECT * FROM quote_video_jobs WHERE workflow_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .all(workflowId, Math.max(1, limit));
  return rows.map(parseJobRow);
}

/**
 * Gets count of past quote jobs for a workflow.
 */
function getQuoteJobCount(workflowId) {
  if (!workflowId) return 0;
  const row = db
    .prepare('SELECT COUNT(*) as count FROM quote_video_jobs WHERE workflow_id = ?')
    .get(workflowId);
  return row?.count || 0;
}

/**
 * Gets a specific quote video job by its ID.
 */
function getQuoteJobById(jobId) {
  if (!jobId) return null;
  const row = db.prepare('SELECT * FROM quote_video_jobs WHERE id = ?').get(jobId);
  if (!row) return null;
  return parseJobRow(row);
}

/**
 * Helper to parse SQLite row into JSON objects and standard fields.
 */
function parseJobRow(row) {
  return {
    ...row,
    hashtags: JSON.parse(row.hashtags || '[]'),
    visualStrategy: JSON.parse(row.visual_strategy || '{}'),
    audioStrategy: JSON.parse(row.audio_strategy || '{}'),
    platforms: JSON.parse(row.platforms || '[]'),
    validation: JSON.parse(row.validation || '{}'),
    spec: JSON.parse(row.spec || '{}'),
    renderStatus: row.render_status,
    jobStatus: row.job_status,
    renderedAt: row.rendered_at || null,
    outputPath: row.output_path || null,
    outputUrl: row.output_url || null,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    errorMessage: row.error_message || null,
  };
}

/**
 * Executes the Content Preparation Pipeline.
 *
 * @param {Object} params
 * @param {string} params.workflowId - Target workflow ID
 * @param {Object} params.config - Daily Quote Video configuration
 * @param {string} [params.runId] - Associated workflow run ID if triggered by executor/scheduler
 * @param {Object} [params.options] - Overrides or manual test flags
 * @returns {Promise<Object>} The created preparation job and spec
 */
async function prepareDailyQuoteVideo({
  workflowId,
  config = {},
  runId = null,
  options = {},
} = {}) {
  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // 1. Fetch historical execution context for deterministic rotation
  const lastJob = workflowId ? getLatestQuoteJob(workflowId) : null;
  const jobCount = workflowId ? getQuoteJobCount(workflowId) : 0;

  // 2. Topic Determination (Topic is resolved FIRST so we know which topic's language state to check)
  const resolvedTopic = options.topic || resolveTopic({
    topicMode: config.topicMode || 'rotate',
    selectedTopic: config.selectedTopic || 'motivation',
    selectedTopics: config.selectedTopics || null,
    lastTopic: lastJob?.topic || null,
    runCount: jobCount,
  });
  const topicMeta = getTopicMeta(resolvedTopic);

  // Position in rotation list for deterministic initial seed if needed
  const topicsList = Array.isArray(config.selectedTopics) && config.selectedTopics.length > 0
    ? config.selectedTopics
    : ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'];
  const topicIndex = Math.max(0, topicsList.indexOf(resolvedTopic));

  // 3. Language Determination (Per-topic independent alternation)
  const previousTopicLanguage = getTopicPreviousLanguage(workflowId, resolvedTopic);
  const resolvedLanguage = options.language || resolveLanguageForTopic({
    languageConfig: config.language || 'alternate',
    topic: resolvedTopic,
    previousLanguage: previousTopicLanguage,
    topicIndex,
  });
  const languageMeta = getLanguageMeta(resolvedLanguage);

  // 4. Video length & formatting
  const duration = parseInt(config.duration || options.duration || 15, 10);
  const platforms = Array.isArray(config.platforms) && config.platforms.length > 0
    ? config.platforms
    : ['instagram', 'youtube_shorts'];

  // 5. Content Generation with Retry Loop (up to 3 tries)
  const MAX_RETRIES = 3;
  let attempt = 0;
  let content = null;
  let validation = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    content = await generateQuoteContent({
      language: resolvedLanguage,
      topic: resolvedTopic,
      duration,
      context: {
        runIndex: jobCount + attempt - 1,
        theme: topicMeta.category,
      },
    });

    validation = validateContent(content, {
      expectedLanguage: resolvedLanguage,
      expectedTopic: resolvedTopic,
      expectedDuration: duration,
    });

    if (validation.valid) {
      break;
    }
  }

  // If still invalid after retries, mark for review or validation failure
  let jobStatus = 'ready_for_render';
  if (!validation.valid) {
    jobStatus = validation.tamilQuality?.requiresReview ? 'requires_review' : 'validation_failed';
  }

  // 6. Visual Strategy Selection
  const visualStrategy = selectVisualStrategy({
    topic: resolvedTopic,
    language: resolvedLanguage,
    visualStyle: config.visualStyle || 'auto',
    mood: topicMeta.mood,
  });

  // 7. Audio Strategy Selection
  const audioStrategy = selectAudioStrategy({
    audioPreference: config.audioPreference || 'approved_library',
    topic: resolvedTopic,
    duration,
  });

  // 8. Persist Per-Topic Language State
  saveTopicLanguageState(workflowId, resolvedTopic, resolvedLanguage);
  const currentTopicState = getTopicLanguageState(workflowId);

  // 9. Build Video Preparation Specification
  const videoSpec = {
    jobId,
    workflowId: workflowId || 'manual-preview',
    runId,
    jobStatus,
    renderStatus: 'not_rendered',
    duration,
    aspectRatio: '9:16',
    language: {
      code: resolvedLanguage,
      name: languageMeta.name,
      flag: languageMeta.flag,
      rotationMode: config.language || 'alternate',
      previousForThisTopic: previousTopicLanguage,
    },
    topic: {
      id: resolvedTopic,
      label: topicMeta.label,
      emoji: topicMeta.emoji,
      mood: topicMeta.mood,
      rotationMode: config.topicMode || 'rotate',
    },
    topicLanguageState: currentTopicState,
    content: {
      title: content.title,
      quote: content.quote,
      explanation: content.explanation,
      caption: content.caption,
      hashtags: content.hashtags,
      isThirukkural: !!content.isThirukkural,
      kuralNumber: content.kuralNumber || null,
      chapter: content.chapter || null,
    },
    visual: visualStrategy,
    audio: audioStrategy,
    platforms,
    validation,
    pipeline: {
      generatedAt: startedAt,
      engineVersion: '2.0.0',
      nextScheduledStep: 'video_renderer_dispatch',
    },
  };

  // 10. Persist Job to SQLite (if workflow exists in database)
  if (workflowId) {
    try {
      const wfExists = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflowId);
      if (wfExists) {
        db.prepare(`
          INSERT INTO quote_video_jobs (
          id, workflow_id, run_id, language, topic, duration,
          title, quote, explanation, caption, hashtags,
          visual_strategy, audio_strategy, platforms,
          render_status, job_status, validation, spec, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        jobId,
        workflowId,
        runId,
        resolvedLanguage,
        resolvedTopic,
        duration,
        content.title || '',
        content.quote,
        content.explanation || '',
        content.caption || '',
        JSON.stringify(content.hashtags || []),
        JSON.stringify(visualStrategy),
        JSON.stringify(audioStrategy),
        JSON.stringify(platforms),
        'not_rendered',
        jobStatus,
        JSON.stringify(validation),
        JSON.stringify(videoSpec)
      );
      }
    } catch (err) {
      console.error('[contentEngine] Failed to save quote_video_job to SQLite', err);
    }
  }

  return {
    jobId,
    workflowId,
    jobStatus,
    renderStatus: 'not_rendered',
    language: resolvedLanguage,
    topic: resolvedTopic,
    topicLanguageState: currentTopicState,
    quote: content.quote,
    explanation: content.explanation,
    duration,
    platforms,
    visualStatus: visualStrategy.status,
    audioStatus: audioStrategy.status,
    spec: videoSpec,
    validation,
  };
}

module.exports = {
  prepareDailyQuoteVideo,
  getLatestQuoteJob,
  getQuoteJobById,
  listQuoteJobs,
  getQuoteJobCount,
  getTopicPreviousLanguage,
  getTopicLanguageState,
  saveTopicLanguageState,
};
