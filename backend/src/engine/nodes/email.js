const nodemailer = require('nodemailer');
const db = require('../../db');
const { decrypt } = require('../../crypto');

async function run(config, context) {
  const row = db.prepare('SELECT type, data_encrypted FROM credentials WHERE id = ?').get(config.credentialId);
  if (!row || row.type !== 'smtp') {
    throw new Error('Email node requires a valid "smtp" credential');
  }
  const smtp = JSON.parse(decrypt(row.data_encrypted));

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const info = await transporter.sendMail({
    from: smtp.user,
    to: context.interpolate(config.to),
    subject: context.interpolate(config.subject || ''),
    text: context.interpolate(config.text || ''),
    html: config.html ? context.interpolate(config.html) : undefined,
  });

  return { messageId: info.messageId, accepted: info.accepted };
}

module.exports = { run };
