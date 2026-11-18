'use strict';

const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

// عرض البنود الفعّالة (لأي مستخدم مسجّل — المشرف يحتاجها في نموذج التقييم)
router.get('/', authRequired, (req, res) => {
  const includeInactive = req.user.role === 'manager' && req.query.all === '1';
  const rows = includeInactive
    ? db.prepare('SELECT * FROM criteria ORDER BY sort_order, id').all()
    : db.prepare('SELECT * FROM criteria WHERE active = 1 ORDER BY sort_order, id').all();
  res.json({ criteria: rows });
});

// إضافة بند (المدير فقط)
router.post('/', authRequired, requireRole('manager'), (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'اسم البند مطلوب' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM criteria').get().m;
  const info = db
    .prepare('INSERT INTO criteria (name, sort_order) VALUES (?, ?)')
    .run(String(name).trim(), maxOrder + 1);
  const row = db.prepare('SELECT * FROM criteria WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ criterion: row });
});

// تعديل بند (المدير فقط) — الاسم و/أو الحالة
router.put('/:id', authRequired, requireRole('manager'), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'البند غير موجود' });
  const name = req.body.name != null ? String(req.body.name).trim() : row.name;
  const active = req.body.active != null ? (req.body.active ? 1 : 0) : row.active;
  if (!name) return res.status(400).json({ error: 'اسم البند مطلوب' });
  db.prepare('UPDATE criteria SET name = ?, active = ? WHERE id = ?').run(name, active, id);
  res.json({ criterion: db.prepare('SELECT * FROM criteria WHERE id = ?').get(id) });
});

// حذف بند (المدير فقط) — تعطيل إذا كان مستخدماً، حذف نهائي إن لم يُستخدم
router.delete('/:id', authRequired, requireRole('manager'), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'البند غير موجود' });
  const used = db.prepare('SELECT COUNT(*) AS c FROM assessment_items WHERE criterion_id = ?').get(id).c;
  if (used > 0) {
    db.prepare('UPDATE criteria SET active = 0 WHERE id = ?').run(id);
    return res.json({ deactivated: true });
  }
  db.prepare('DELETE FROM criteria WHERE id = ?').run(id);
  res.json({ deleted: true });
});

module.exports = router;
