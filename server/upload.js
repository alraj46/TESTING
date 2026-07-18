'use strict';

const path = require('path');
const multer = require('multer');
const { UPLOAD_DIR } = require('./db');

// A simple counter-free unique name: timestamp is not available deterministically
// here, so we rely on multer's random suffix via fieldname + random bytes.
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
]);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('نوع الملف غير مدعوم. المسموح: صور أو PDF'));
  },
});

module.exports = { upload };
