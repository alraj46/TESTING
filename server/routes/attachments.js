'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { db, UPLOAD_DIR } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

// خدمة عرض/تحميل المرفق (يتطلب تسجيل دخول)
router.get('/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!att) return res.status(404).json({ error: 'المرفق غير موجود' });
  const filePath = path.join(UPLOAD_DIR, att.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود' });
  res.setHeader('Content-Type', att.mimetype);
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  const safeName = encodeURIComponent(att.original_name);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
