'use strict';

const path = require('path');
const express = require('express');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

// منصة الحج الذكية (لوحة القيادة التنفيذية + إدارة المشروع) — للمدير فقط.
// الملف خارج مجلد public حتى لا يُخدَم دون تسجيل دخول.
const PLATFORM_FILE = path.join(__dirname, '..', 'private', 'hajj-platform.html');

router.get('/', authRequired, requireRole('manager'), (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(PLATFORM_FILE);
});

module.exports = router;
