const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');
const { executeWorkflow } = require('../engine/executor');
const { reloadSchedules } = require('../scheduler');

const router = express.Router();

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.any()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
});
const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
});
const definitionSchema = z.object({
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
});
const workflowSchema = z.object({
  name: z.string().min(1).max(200),
  definition: definitionSchema,
  active: z.boolean().optional(),
});

function rowToWorkflow(row) {
  return {
    id: row.id,
    name: row.name,
    definition: JSON.parse(row.definition),
    active: !!row.active,
    webhookSecret: row.webhook_secret,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all();
  res.json(rows.map(rowToWorkflow));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToWorkflow(row));
});

router.post('/', (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow', details: parsed.error.issues });

  const id = crypto.randomUUID();
  const webhookSecret = crypto.randomBytes(24).toString('hex');
  db.prepare(
    'INSERT INTO workflows (id, name, definition, active, webhook_secret) VALUES (?, ?, ?, ?, ?)'
  ).run(id, parsed.data.name, JSON.stringify(parsed.data.definition), parsed.data.active ? 1 : 0, webhookSecret);

  reloadSchedules();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
  res.status(201).json(rowToWorkflow(row));
});

router.put('/:id', (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow', details: parsed.error.issues });

  const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    "UPDATE workflows SET name = ?, definition = ?, active = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(parsed.data.name, JSON.stringify(parsed.data.definition), parsed.data.active ? 1 : 0, req.params.id);

  reloadSchedules();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  res.json(rowToWorkflow(row));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  reloadSchedules();
  res.status(204).end();
});

const {
  prepareDailyQuoteVideo,
  getLatestQuoteJob,
  getQuoteJobById,
  listQuoteJobs,
  renderQuoteVideoJob,
  approveQuoteVideoJob,
  regenerateQuoteVideoJob,
} = require('../contentEngine');
const {
  publishQuoteVideoJob,
  getJobPublications,
} = require('../publishing');
const { streamVideoFile } = require('./quoteVideoJobs');

// Manually trigger a run (used by the "Run" button in the editor / dashboard)
router.post('/:id/run', async (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const runId = crypto.randomUUID();
  db.prepare("INSERT INTO runs (id, workflow_id, status, trigger_type, log) VALUES (?, ?, ?, ?, ?)")
    .run(runId, row.id, 'running', 'manual', '[]');

  const definition = JSON.parse(row.definition);
  const result = await executeWorkflow(
    definition,
    req.body.payload || {},
    { workflowId: row.id, runId }
  );

  db.prepare("UPDATE runs SET status = ?, log = ?, finished_at = datetime('now') WHERE id = ?")
    .run(result.status, JSON.stringify(result.log), runId);

  res.json({ runId, ...result });
});

// Manual Test / Debug Mode: "Prepare next quote"
// Executes the content preparation pipeline deterministically on-demand
router.post('/:id/prepare-quote', async (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const definition = JSON.parse(row.definition);
  const quoteNode = (definition.nodes || []).find(
    (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
  );

  const config = quoteNode?.config || {
    templateType: 'dailyQuoteVideo',
    language: 'alternate',
    topicMode: 'rotate',
    duration: 15,
  };

  try {
    const jobResult = await prepareDailyQuoteVideo({
      workflowId: row.id,
      config,
      options: req.body || {},
    });
    res.json({ success: true, ...jobResult });
  } catch (err) {
    console.error('Failed to prepare quote:', err);
    res.status(500).json({ error: 'Failed to prepare quote', details: err.message });
  }
});

// Render a specific quote job for workflow
router.post('/:id/quote-jobs/:jobId/render', async (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  try {
    const result = await renderQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[workflow render API] Failed rendering job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || (err.renderStatus === 'requires_review' ? 422 : 500);
    res.status(status).json({
      error: 'Render failed',
      renderStatus: err.renderStatus || 'render_failed',
      details: err.message,
    });
  }
});

// Approve quote job for workflow
router.post('/:id/quote-jobs/:jobId/approve', async (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  try {
    const result = await approveQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[workflow approve API] Failed approving job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 400;
    res.status(status).json({
      error: 'Approval failed',
      reviewStatus: err.reviewStatus,
      message: err.message,
    });
  }
});

// Regenerate quote job for workflow
router.post('/:id/quote-jobs/:jobId/regenerate', async (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  try {
    const result = await regenerateQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[workflow regenerate API] Failed regenerating job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 500;
    res.status(status).json({
      error: 'Regeneration failed',
      message: err.message,
    });
  }
});

// Stream rendered video MP4 for workflow job
router.get('/:id/quote-jobs/:jobId/video', (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  if (job.renderStatus !== 'rendered' || !job.outputPath) {
    return res.status(400).json({
      error: 'Video has not been rendered yet',
      renderStatus: job.renderStatus,
    });
  }
  streamVideoFile(job.outputPath, req, res);
});

// Publish approved quote job for workflow
router.post('/:id/quote-jobs/:jobId/publish', async (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  try {
    const result = await publishQuoteVideoJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    console.error(`[workflow publish API] Failed publishing job ${req.params.jobId}:`, err.message);
    const status = err.statusCode || 400;
    res.status(status).json({
      error: 'Publishing failed',
      reviewStatus: err.reviewStatus,
      message: err.message,
    });
  }
});

// Get publication history for workflow job
router.get('/:id/quote-jobs/:jobId/publications', (req, res) => {
  const job = getQuoteJobById(req.params.jobId);
  if (!job || job.workflow_id !== req.params.id) {
    return res.status(404).json({ error: 'Quote video job not found for this workflow' });
  }
  const publications = getJobPublications(req.params.jobId);
  res.json({
    jobId: req.params.jobId,
    publishStatus: job.publishStatus,
    publishedAt: job.publishedAt,
    publishError: job.publishError,
    publications,
  });
});

// Get latest quote preparation job for workflow
router.get('/:id/quote-jobs/latest', (req, res) => {
  const job = getLatestQuoteJob(req.params.id);
  res.json({ job });
});

// List quote preparation jobs history
router.get('/:id/quote-jobs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const jobs = listQuoteJobs(req.params.id, limit);
  res.json({ jobs });
});

router.get('/:id/runs', (req, res) => {
  const rows = db
    .prepare('SELECT id, status, trigger_type, started_at, finished_at FROM runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 50')
    .all(req.params.id);
  res.json(rows);
});

router.get('/:id/runs/:runId', (req, res) => {
  const row = db.prepare('SELECT * FROM runs WHERE id = ? AND workflow_id = ?').get(req.params.runId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, log: JSON.parse(row.log) });
});

module.exports = router;
