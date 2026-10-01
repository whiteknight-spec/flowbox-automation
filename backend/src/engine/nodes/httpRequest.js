const axios = require('axios');
const db = require('../../db');
const { decrypt } = require('../../crypto');

// Blocks requests to internal/private network ranges to reduce SSRF risk
// when a workflow's URL is built from untrusted webhook input.
function isBlockedHost(hostname) {
  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./, // link-local / cloud metadata endpoint range
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return blocked.some((re) => re.test(hostname));
}

async function run(config, context) {
  const url = context.interpolate(config.url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`Requests to internal/private hosts are blocked: ${parsed.hostname}`);
  }

  const headers = {};
  if (config.credentialId) {
    const row = db.prepare('SELECT type, data_encrypted FROM credentials WHERE id = ?').get(config.credentialId);
    if (row && row.type === 'httpHeader') {
      const data = JSON.parse(decrypt(row.data_encrypted));
      headers[data.headerName] = data.headerValue;
    }
  }
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) headers[k] = context.interpolate(v);
  }

  const body = config.body ? JSON.parse(context.interpolate(JSON.stringify(config.body))) : undefined;

  const response = await axios({
    method: config.method || 'GET',
    url,
    headers,
    data: body,
    timeout: 15000,
    maxRedirects: 3,
    validateStatus: () => true, // we handle non-2xx ourselves so workflows can branch on it
  });

  if (config.failOnError !== false && response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data).slice(0, 500)}`);
  }

  return { status: response.status, headers: response.headers, body: response.data };
}

module.exports = { run };
