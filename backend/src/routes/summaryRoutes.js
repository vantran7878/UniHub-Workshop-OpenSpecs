const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadPDF, getSummary } = require('../controllers/summaryController');
const { verifyJWT, checkBlacklist, loadUser, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.PDF_UPLOAD_DIR || 'uploads/pdf';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Routes
router.post('/:id/pdf', verifyJWT, checkBlacklist, loadUser, requireRole('admin'), upload.single('pdf'), uploadPDF);
router.get('/:id/summary', verifyJWT, checkBlacklist, loadUser, getSummary);

module.exports = router;
