const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const privateKey = fs.readFileSync(path.join(__dirname, '../../', process.env.JWT_PRIVATE_KEY_PATH), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, '../../', process.env.JWT_PUBLIC_KEY_PATH), 'utf8');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';

/**
 * Sign an access token.
 * @param {object} payload 
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: ACCESS_TTL
  });
}

/**
 * Verify an access token.
 * @param {string} token 
 * @returns {object}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256']
  });
}

module.exports = {
  signAccessToken,
  verifyAccessToken
};
