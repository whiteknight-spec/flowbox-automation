const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { safeEqual } = require('../crypto');
const { executeWorkflow } = require('../engine/executor');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public endpoint — protected by a per-workflow secret instead of JWT,
// since external services (not you) call this. Never log the secret.
router.post('/:workflowId', webhookLimiter, express.json({ limit: '1mb' }), async (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.workflowId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.active) return res.status(403).json({ error: 'Workflow is not active' });

  const providedSecret = req.header('X-Webhook-Secret') || req.query.secret;
  if (!providedSecret || !safeEqual(providedSecret, row.webhook_secret)) {
    return res.status(401).json({ error: 'Invalid or missing webhook secret' });
  }

  const definition = JSON.parse(row.definition);
  const runId = crypto.randomUUID();
  db.prepare('INSERT INTO runs (id, workflow_id, status, trigger_type, log) VALUES (?, ?, ?, ?, ?)')
    .run(runId, row.id, 'running', 'webhook', '[]');

  // Respond immediately so the caller isn't blocked on the full workflow run,
  // then execute asynchronously and record the result.
  res.status(202).json({ received: true, runId });

  executeWorkflow(definition, { headers: req.headers, query: req.query, body: req.body })
    .then((result) => {
      db.prepare("UPDATE runs SET status = ?, log = ?, finished_at = datetime('now') WHERE id = ?")
        .run(result.status, JSON.stringify(result.log), runId);
    })
    .catch((err) => {
      db.prepare("UPDATE runs SET status = ?, log = ?, finished_at = datetime('now') WHERE id = ?")
        .run('error', JSON.stringify([{ event: 'fatal', message: err.message }]), runId);
    });
});

module.exports = router;
