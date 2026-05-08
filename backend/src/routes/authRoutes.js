const express = require('express');
const { login, refresh, logout } = require('../controllers/authController');
const { verifyJWT, checkBlacklist } = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/login', rateLimit('login', 5, 0.083), login);
router.post('/refresh', refresh);
router.post('/logout', verifyJWT, checkBlacklist, logout);

module.exports = router;
