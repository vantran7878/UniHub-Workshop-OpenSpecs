const crypto = require('crypto');
const db = require('../config/db');
const { comparePassword } = require('../utils/hash');
const { signAccessToken } = require('../services/authService');
const { storeRefreshToken, getRefreshToken, deleteRefreshToken, blacklistAccessToken } = require('../services/sessionService');

/**
 * Handle user login.
 */
async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      'SELECT id, fullName, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    if (!user.is_active) {
      return res.status(401).json({ code: 'USER_INACTIVE' });
    }

    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      jti
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    await storeRefreshToken(refreshToken, user.id, user.role);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Handle token refresh.
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;

  try {
    const session = await getRefreshToken(refreshToken);
    if (!session) {
      return res.status(401).json({ code: 'REFRESH_TOKEN_EXPIRED' });
    }

    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({
      sub: session.userId,
      role: session.role,
      jti
    });

    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Handle user logout.
 */
async function logout(req, res) {
  const { refreshToken } = req.body;
  const jti = req.jwtPayload.jti;
  const exp = req.jwtPayload.exp;

  try {
    await deleteRefreshToken(refreshToken);
    
    if (jti && exp) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = exp - now;
      if (remaining > 0) {
        await blacklistAccessToken(jti, remaining);
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

module.exports = {
  login,
  refresh,
  logout
};
