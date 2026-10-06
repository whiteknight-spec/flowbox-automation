const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

router.post('/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { username, password } = parsed.data;

  const validUser = username === process.env.ADMIN_USERNAME;
  // Always run bcrypt.compare even on username mismatch, using a dummy hash,
  // so response timing doesn't reveal whether the username was correct.
  const hashToCheck = validUser
    ? process.env.ADMIN_PASSWORD_HASH
    : '$2a$12$invalidsaltinvalidsaltinuXwZ2QeF8g8g8g8g8g8g8g8g8g8g8';

  bcrypt.compare(password, hashToCheck, (err, matches) => {
    if (err || !validUser || !matches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: username }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, expiresIn: '12h' });
  });
});

/**
 * Resolves the canonical redirect URI for YouTube Google OAuth.
 */
function getYouTubeRedirectUri() {
  if (process.env.YOUTUBE_REDIRECT_URI) {
    return process.env.YOUTUBE_REDIRECT_URI.trim();
  }
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:4000').trim();
  return `${base.replace(/\/$/, '')}/auth/youtube/callback`;
}

/**
 * Escapes strings for safe HTML rendering to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely persists refresh token to backend/.env without ever printing or logging it.
 */
function saveRefreshTokenToEnv(refreshToken) {
  if (!refreshToken) return;
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) return;
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /YOUTUBE_REFRESH_TOKEN=.*/,
        `YOUTUBE_REFRESH_TOKEN=${refreshToken}`
      );
    } else {
      envContent = envContent.trimEnd() + `\nYOUTUBE_REFRESH_TOKEN=${refreshToken}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
  } catch (err) {
    console.error('[OAuth] Failed to save refresh token to .env:', err.message);
  }
}

/**
 * GET /auth/youtube/authorize
 * Public endpoint to start Google OAuth 2.0 flow for YouTube Shorts publishing.
 */
router.get('/youtube/authorize', (req, res) => {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>YouTube Setup Required</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 36px 40px; text-align: center; max-width: 480px;">
            <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
            <h2 style="color: #ef4444; margin: 0 0 12px 0;">YouTube Client ID Missing</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
              Please configure <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #38bdf8;">YOUTUBE_CLIENT_ID</code> and <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #38bdf8;">YOUTUBE_CLIENT_SECRET</code> in <code style="color: #38bdf8;">backend/.env</code> before starting authorization.
            </p>
          </div>
        </body>
      </html>
    `);
  }

  const redirectUri = getYouTubeRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
});

/**
 * GET /auth/youtube/callback
 * Public callback endpoint handling Google OAuth redirect.
 * Securely exchanges authorization code for refresh token without ever revealing or logging tokens.
 */
router.get('/youtube/callback', async (req, res) => {
  // 1. Check for error returned by Google (e.g. user cancelled)
  if (req.query.error) {
    const errorDescription = req.query.error_description || req.query.error;
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authorization Cancelled</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 36px 40px; text-align: center; max-width: 480px;">
            <div style="font-size: 36px; margin-bottom: 12px;">✕</div>
            <h2 style="color: #ef4444; margin: 0 0 12px 0;">YouTube Authorization Failed</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
              Google returned error: <strong>${escapeHtml(errorDescription)}</strong>
            </p>
          </div>
        </body>
      </html>
    `);
  }

  // 2. Validate authorization code
  const code = req.query.code;
  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Missing Authorization Code</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 36px 40px; text-align: center; max-width: 480px;">
            <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
            <h2 style="color: #ef4444; margin: 0 0 12px 0;">Missing Code</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
              No authorization code was received in the Google callback.
            </p>
          </div>
        </body>
      </html>
    `);
  }

  // 3. Ensure client credentials are ready
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Missing Client Credentials</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 36px 40px; text-align: center; max-width: 480px;">
            <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
            <h2 style="color: #ef4444; margin: 0 0 12px 0;">Credentials Missing</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
              YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in backend/.env to complete authorization.
            </p>
          </div>
        </body>
      </html>
    `);
  }

  const redirectUri = getYouTubeRedirectUri();

  // 4. Exchange authorization code with Google token endpoint
  try {
    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    // Safely store refresh token in runtime memory and backend/.env (NEVER logged or shown)
    if (refresh_token) {
      process.env.YOUTUBE_REFRESH_TOKEN = refresh_token;
      saveRefreshTokenToEnv(refresh_token);
    }
    if (access_token) {
      process.env.YOUTUBE_ACCESS_TOKEN = access_token;
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>YouTube Connected — Flowbox</title></head>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(0, 229, 117, 0.3); border-radius: 12px; padding: 40px; text-align: center; max-width: 460px; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
            <div style="font-size: 42px; margin-bottom: 12px;">✅</div>
            <h2 style="color: #00e575; margin: 0 0 10px 0; font-size: 22px;">YouTube Connected Successfully</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Flowbox Daily Quote Video automation is now authorized to publish to YouTube Shorts.
            </p>
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              You can safely close this window and return to Flowbox.
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    const errorMsg =
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.message;
    console.error('[OAuth] Token exchange failed:', errorMsg);

    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>YouTube Authorization Error</title></head>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1420; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: #141923; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 40px; text-align: center; max-width: 460px; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
            <div style="font-size: 42px; margin-bottom: 12px;">❌</div>
            <h2 style="color: #ef4444; margin: 0 0 10px 0; font-size: 20px;">Token Exchange Failed</h2>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
              ${escapeHtml(errorMsg)}
            </p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * GET /auth/youtube/status
 * Public health check to inspect OAuth configuration without leaking tokens.
 */
router.get('/youtube/status', (req, res) => {
  const hasClientId = Boolean(process.env.YOUTUBE_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.YOUTUBE_CLIENT_SECRET);
  const hasRefreshToken = Boolean(process.env.YOUTUBE_REFRESH_TOKEN);
  const configured = Boolean(hasClientId && hasRefreshToken);

  res.json({
    configured,
    hasClientId,
    hasClientSecret,
    hasRefreshToken,
    redirectUri: getYouTubeRedirectUri(),
  });
});

module.exports = router;

