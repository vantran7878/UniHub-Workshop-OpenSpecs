const { verifyAccessToken } = require('../services/authService');
const { isBlacklisted } = require('../services/sessionService');

/**
 * Middleware to extract and verify JWT from Authorization header.
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'MISSING_TOKEN' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.jwtPayload = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ code: 'INVALID_TOKEN' });
  }
}

/**
 * Middleware to check if the JWT jti is blacklisted in Redis.
 */
async function checkBlacklist(req, res, next) {
  const jti = req.jwtPayload.jti;
  if (!jti) return next();

  try {
    const blacklisted = await isBlacklisted(jti);
    if (blacklisted) {
      return res.status(401).json({ code: 'TOKEN_REVOKED' });
    }
    next();
  } catch (err) {
    console.error('Blacklist check error (fail-open):', err);
    next(); // Fail open as per design
  }
}

const db = require('../config/db');

/**
 * Middleware to load user from database after JWT verification.
 */
async function loadUser(req, res, next) {
  const userId = req.jwtPayload.sub;
  if (!userId) {
    return res.status(401).json({ code: 'INVALID_TOKEN_PAYLOAD' });
  }

  try {
    const result = await db.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ code: 'USER_NOT_FOUND' });
    }

    if (!user.is_active) {
      return res.status(401).json({ code: 'USER_INACTIVE' });
    }

    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (err) {
    console.error('Database error in loadUser middleware:', err);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Middleware to enforce role-based access control.
 * @param {...string} allowedRoles 
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = {
  verifyJWT,
  checkBlacklist,
  loadUser,
  requireRole
};
