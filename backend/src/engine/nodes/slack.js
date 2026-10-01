const axios = require('axios');
const db = require('../../db');
const { decrypt } = require('../../crypto');

async function run(config, context) {
  const row = db.prepare('SELECT type, data_encrypted FROM credentials WHERE id = ?').get(config.credentialId);
  if (!row || row.type !== 'slack') {
    throw new Error('Slack node requires a valid "slack" credential (Incoming Webhook URL)');
  }
  const { webhookUrl } = JSON.parse(decrypt(row.data_encrypted));

  const text = context.interpolate(config.message || '');
  const response = await axios.post(webhookUrl, { text }, { timeout: 10000 });
  return { status: response.status, sent: text };
}

module.exports = { run };
