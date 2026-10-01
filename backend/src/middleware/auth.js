const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Temporary development bypass: disabled when AUTH_ENABLED=false
  if (process.env.AUTH_ENABLED === 'false') {
    req.user = { sub: process.env.ADMIN_USERNAME || 'dev-user', dev: true };
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, tokenFromHeader] = header.split(' ');
  const token = (scheme === 'Bearer' ? tokenFromHeader : null) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header or token query' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
