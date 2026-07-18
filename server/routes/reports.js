'use strict';

const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { upload } = require('../upload');

const router = express.Router();

function saveAttachment(file) {
  const info = db
    .prepare('INSERT INTO attachments (stored_name, original_name, mimetype, size) VALUES (?, ?, ?, ?)')
    .run(file.filename, file.originalname, file.mimetype, file.size);
  return info.lastInsertRowid;
}

// رفع بلاغ (المشرف) — مثل عطل كهرباء ونحوه
router.post('/', authRequired, requireRole('supervisor'), upload.single('attachment'), (req, res) => {
  const title = (req.body.title || '').trim();
  const category = (req.body.category || '').trim();
  const description = (req.body.description || '').trim();
  if (!title || !category || !description) {
    return res.status(400).json({ error: 'العنوان والتصنيف والوصف مطلوبة' });
  }
  const attachmentId = req.file ? saveAttachment(req.file) : null;
  const info = db
    .prepare('INSERT INTO reports (user_id, title, category, description, attachment_id) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, title, category, description, attachmentId);
  res.status(201).json({ id: info.lastInsertRowid });
});

// قائمة البلاغات — المشرف يرى بلاغاته، المدير يرى الكل. فلترة اختيارية بالحالة
router.get('/', authRequired, (req, res) => {
  const isManager = req.user.role === 'manager';
  const status = req.query.status; // 'open' | 'done'
  const clauses = [];
  const params = [];
  if (!isManager) { clauses.push('r.user_id = ?'); params.push(req.user.id); }
  if (status === 'open' || status === 'done') { clauses.push('r.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT r.*, u.name AS supervisor_name, c.name AS closed_by_name
    FROM reports r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN users c ON c.id = r.closed_by
    ${where}
    ORDER BY r.id DESC`).all(...params);
  res.json({ reports: rows });
});

// تفاصيل بلاغ
router.get('/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`
    SELECT r.*, u.name AS supervisor_name, c.name AS closed_by_name
    FROM reports r JOIN users u ON u.id = r.user_id
    LEFT JOIN users c ON c.id = r.closed_by WHERE r.id = ?`).get(id);
  if (!r) return res.status(404).json({ error: 'البلاغ غير موجود' });
  if (req.user.role !== 'manager' && r.user_id !== req.user.id) {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }
  res.json({ report: r });
});

// إغلاق البلاغ / وضعه "تمت" (المدير فقط)
router.put('/:id/close', authRequired, requireRole('manager'), (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!r) return res.status(404).json({ error: 'البلاغ غير موجود' });
  if (r.status === 'done') return res.status(400).json({ error: 'البلاغ مغلق مسبقاً' });
  db.prepare("UPDATE reports SET status = 'done', closed_at = datetime('now'), closed_by = ? WHERE id = ?")
    .run(req.user.id, id);
  res.json({ report: db.prepare('SELECT * FROM reports WHERE id = ?').get(id) });
});

// إعادة فتح البلاغ (المدير فقط)
router.put('/:id/reopen', authRequired, requireRole('manager'), (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!r) return res.status(404).json({ error: 'البلاغ غير موجود' });
  db.prepare("UPDATE reports SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ?").run(id);
  res.json({ report: db.prepare('SELECT * FROM reports WHERE id = ?').get(id) });
});

module.exports = router;
