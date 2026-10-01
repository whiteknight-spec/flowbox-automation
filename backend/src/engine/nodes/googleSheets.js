const { google } = require('googleapis');
const db = require('../../db');
const { decrypt } = require('../../crypto');

async function getSheetsClient(credentialId) {
  const row = db.prepare('SELECT type, data_encrypted FROM credentials WHERE id = ?').get(credentialId);
  if (!row || row.type !== 'googleServiceAccount') {
    throw new Error('Google Sheets node requires a valid "googleServiceAccount" credential');
  }
  const { serviceAccountJson } = JSON.parse(decrypt(row.data_encrypted));
  const key = JSON.parse(serviceAccountJson);

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function run(config, context) {
  const sheets = await getSheetsClient(config.credentialId);
  const spreadsheetId = context.interpolate(config.spreadsheetId);
  const range = context.interpolate(config.range || 'Sheet1!A1');

  if (config.operation === 'append') {
    const values = (config.values || []).map((row) =>
      row.map((cell) => context.interpolate(String(cell)))
    );
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return { updatedRange: result.data.updates?.updatedRange };
  }

  if (config.operation === 'read') {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return { values: result.data.values || [] };
  }

  throw new Error(`Unsupported Google Sheets operation: ${config.operation}`);
}

module.exports = { run };
