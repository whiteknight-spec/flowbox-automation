const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set in .env as a 64-char hex string (32 bytes). ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext string (e.g. JSON-stringified credential data).
 * Returns a single base64 string: iv + authTag + ciphertext, so it stores
 * as one opaque blob in the database.
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Reverses encrypt(). Throws if the data was tampered with (auth tag check).
 */
function decrypt(blobBase64) {
  const key = getKey();
  const raw = Buffer.from(blobBase64, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Constant-time string compare, used for webhook secret checks. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** HMAC-SHA256 signature, used to verify inbound webhook payloads. */
function hmacSign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

module.exports = { encrypt, decrypt, safeEqual, hmacSign };
