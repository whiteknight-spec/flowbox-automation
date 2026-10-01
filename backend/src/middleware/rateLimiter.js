const rateLimit = require('express-rate-limit');

// Tight limiter for login — slows down credential-stuffing/brute force attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

// Looser limiter for general API + webhook traffic.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Slow down.' },
});

// Dedicated limiter for public webhook endpoints (stricter, since unauthenticated).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
});

module.exports = { loginLimiter, apiLimiter, webhookLimiter };
