const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');
const { encrypt } = require('../crypto');

const router = express.Router();

const credentialSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['httpHeader', 'slack', 'smtp', 'googleServiceAccount']),
  data: z.record(z.any()), // shape depends on type; validated further per-type below
});

function validateDataForType(type, data) {
  switch (type) {
    case 'httpHeader':
      return z.object({ headerName: z.string().min(1), headerValue: z.string().min(1) }).safeParse(data);
    case 'slack':
      return z.object({ webhookUrl: z.string().url() }).safeParse(data);
    case 'smtp':
      return z.object({
        host: z.string().min(1),
        port: z.number().int().positive(),
        secure: z.boolean(),
        user: z.string().min(1),
        pass: z.string().min(1),
      }).safeParse(data);
    case 'googleServiceAccount':
      return z.object({ serviceAccountJson: z.string().min(1) }).safeParse(data);
    default:
      return { success: false };
  }
}

// List credentials (metadata only — never returns decrypted secret data)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name, type, created_at FROM credentials ORDER BY created_at DESC').all();
  res.json(rows);
});

// Create a credential
router.post('/', (req, res) => {
  const parsed = credentialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credential payload' });

  const { name, type, data } = parsed.data;
  const typeCheck = validateDataForType(type, data);
  if (!typeCheck.success) {
    return res.status(400).json({ error: `Invalid data for credential type "${type}"` });
  }

  const id = crypto.randomUUID();
  const encrypted = encrypt(JSON.stringify(typeCheck.data));
  db.prepare('INSERT INTO credentials (id, name, type, data_encrypted) VALUES (?, ?, ?, ?)')
    .run(id, name, type, encrypted);

  res.status(201).json({ id, name, type });
});

// Delete a credential
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
