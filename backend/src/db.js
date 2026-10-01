const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data/flowbox.sqlite';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,       -- JSON: { nodes: [...], edges: [...] }
  active INTEGER NOT NULL DEFAULT 0,
  webhook_secret TEXT,            -- per-workflow secret for webhook trigger auth
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,             -- 'httpHeader' | 'slack' | 'smtp' | 'googleServiceAccount'
  data_encrypted TEXT NOT NULL,   -- AES-256-GCM blob, never stored in plaintext
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL,           -- 'running' | 'success' | 'error'
  trigger_type TEXT NOT NULL,     -- 'manual' | 'webhook' | 'schedule'
  log TEXT NOT NULL DEFAULT '[]', -- JSON array of step log entries
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS quote_video_jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  run_id TEXT,
  language TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration INTEGER NOT NULL,
  title TEXT,
  quote TEXT NOT NULL,
  explanation TEXT,
  caption TEXT,
  hashtags TEXT NOT NULL DEFAULT '[]',
  visual_strategy TEXT NOT NULL DEFAULT '{}',
  audio_strategy TEXT NOT NULL DEFAULT '{}',
  platforms TEXT NOT NULL DEFAULT '[]',
  render_status TEXT NOT NULL DEFAULT 'not_rendered',
  job_status TEXT NOT NULL DEFAULT 'content_ready',
  validation TEXT NOT NULL DEFAULT '{}',
  spec TEXT NOT NULL DEFAULT '{}',
  rendered_at TEXT,
  output_path TEXT,
  output_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quote_jobs_wf ON quote_video_jobs(workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_topic_state (
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  last_language TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workflow_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_quote_topic_state ON quote_topic_state(workflow_id);
`);

// Safe migrations for newly added columns on existing SQLite databases
const quoteJobColumns = [
  ['rendered_at', 'TEXT'],
  ['output_path', 'TEXT'],
  ['output_url', 'TEXT'],
  ['width', 'INTEGER'],
  ['height', 'INTEGER'],
  ['file_size', 'INTEGER'],
  ['error_message', 'TEXT'],
];
for (const [col, colType] of quoteJobColumns) {
  try {
    db.prepare(`ALTER TABLE quote_video_jobs ADD COLUMN ${col} ${colType}`).run();
  } catch (_) {
    // Column already exists
  }
}

module.exports = db;
