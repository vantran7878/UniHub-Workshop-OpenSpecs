const express = require('express');
const { updateFCMToken, deleteFCMToken } = require('../controllers/userController');
const { verifyJWT, checkBlacklist, loadUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/me/fcm-token', verifyJWT, checkBlacklist, loadUser, updateFCMToken);
router.delete('/me/fcm-token', verifyJWT, checkBlacklist, loadUser, deleteFCMToken);

module.exports = router;
