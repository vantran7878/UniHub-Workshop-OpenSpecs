const express = require('express');
const { preload, processCheckin, syncOffline } = require('../controllers/checkinController');
const { verifyJWT, checkBlacklist, loadUser, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// All check-in routes require staff role
router.use(verifyJWT, checkBlacklist, loadUser, requireRole('staff'));

router.get('/preload', preload);
router.post('/', processCheckin);
router.post('/sync-offline', syncOffline);

module.exports = router;
