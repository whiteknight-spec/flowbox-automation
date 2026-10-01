require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const REQUIRED_ENV = ['JWT_SECRET', 'ENCRYPTION_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}. See .env.example.`);
    process.exit(1);
  }
}

const { requireAuth } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const workflowRoutes = require('./routes/workflows');
const credentialRoutes = require('./routes/credentials');
const webhookRoutes = require('./routes/webhooks');
const { reloadSchedules } = require('./scheduler');

const app = express();

// Security headers on every response (allow cross-origin for video media)
app.use(helmet({ crossOriginResourcePolicy: false }));

// Lock CORS to the configured frontend origin(s) only
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

// Public routes
app.use('/auth', authRoutes);
app.use('/webhooks', webhookRoutes); // has its own per-workflow secret check, not JWT

const quoteVideoJobRoutes = require('./routes/quoteVideoJobs').router;

// Everything else requires a valid JWT + general rate limiting
app.use('/api/workflows', apiLimiter, requireAuth, workflowRoutes);
app.use('/api/credentials', apiLimiter, requireAuth, credentialRoutes);
app.use('/api/quote-video-jobs', apiLimiter, requireAuth, quoteVideoJobRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Central error handler — never leak stack traces to clients
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Flowbox backend listening on port ${PORT}`);
  reloadSchedules();
});
