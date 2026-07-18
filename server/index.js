'use strict';

const path = require('path');
const express = require('express');

require('./db'); // initialize DB + seeds

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/criteria', require('./routes/criteria'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Static PWA frontend
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// SPA fallback (non-API routes → index.html)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Multer / generic error handler (returns JSON)
app.use((err, req, res, next) => {
  if (err) {
    const status = err.status || 400;
    return res.status(status).json({ error: err.message || 'حدث خطأ غير متوقع' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`تطبيق تقييم المخيمات يعمل على المنفذ ${PORT}`);
});
