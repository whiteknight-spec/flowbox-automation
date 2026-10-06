const cron = require('node-cron');
const db = require('./db');
const { executeWorkflow } = require('./engine/executor');
const { publishScheduledApprovedJob } = require('./publishing');

let scheduledTasks = [];

function stopAll() {
  for (const task of scheduledTasks) task.stop();
  scheduledTasks = [];
}

/** Re-reads all active workflows and (re)registers their cron schedules. */
function reloadSchedules() {
  stopAll();
  const rows = db.prepare('SELECT * FROM workflows WHERE active = 1').all();

  for (const row of rows) {
    const definition = JSON.parse(row.definition);
    const trigger = definition.nodes.find((n) => n.type === 'scheduleTrigger');
    if (!trigger) continue;

    const cronExpr = trigger.config?.cron;
    if (!cronExpr || !cron.validate(cronExpr)) continue;

    const task = cron.schedule(cronExpr, async () => {
      const crypto = require('crypto');
      const runId = crypto.randomUUID();
      db.prepare('INSERT INTO runs (id, workflow_id, status, trigger_type, log) VALUES (?, ?, ?, ?, ?)')
        .run(runId, row.id, 'running', 'schedule', '[]');
      const result = await executeWorkflow(
        definition,
        { triggeredAt: new Date().toISOString(), workflowId: row.id, runId },
        { workflowId: row.id, runId }
      );

      // Phase 6: Scheduler publishing integration for approved quote video jobs
      const hasQuoteVideo = (definition.nodes || []).some(
        (n) => n.type === 'quoteVideo' || n.config?.templateType === 'dailyQuoteVideo'
      );
      if (hasQuoteVideo) {
        try {
          const pubResult = await publishScheduledApprovedJob(row.id);
          if (pubResult?.publications) {
            result.log = result.log || [];
            result.log.push({
              step: 'publish_scheduled_quote_video',
              timestamp: new Date().toISOString(),
              data: {
                jobId: pubResult.jobId,
                publishStatus: pubResult.publishStatus,
                publications: pubResult.publications,
              },
            });
          }
        } catch (pubErr) {
          console.error(`[scheduler] Scheduled publishing failed for workflow ${row.id}:`, pubErr.message);
        }
      }

      db.prepare('UPDATE runs SET status = ?, log = ?, finished_at = datetime("now") WHERE id = ?')
        .run(result.status, JSON.stringify(result.log), runId);
    });
    scheduledTasks.push(task);
  }

  console.log(`[scheduler] ${scheduledTasks.length} scheduled workflow(s) active`);
}

module.exports = { reloadSchedules };
