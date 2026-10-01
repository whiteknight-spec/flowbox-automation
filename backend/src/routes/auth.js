const express = require('express');
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

module.exports = router;
