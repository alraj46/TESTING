'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, UPLOAD_DIR } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { upload } = require('../upload');

const router = express.Router();

function saveAttachment(file) {
  const info = db
    .prepare('INSERT INTO attachments (stored_name, original_name, mimetype, size) VALUES (?, ?, ?, ?)')
    .run(file.filename, file.originalname, file.mimetype, file.size);
  return info.lastInsertRowid;
}

function cleanupFiles(files) {
  for (const f of files || []) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)); } catch (_) { /* ignore */ }
  }
}

// إنشاء تقييم جديد (المشرف) — كل بند إلزامي مع مرفق إلزامي
router.post('/', authRequired, requireRole('supervisor'), upload.any(), (req, res) => {
  const files = req.files || [];
  const fileByField = new Map(files.map((f) => [f.fieldname, f]));

  const fail = (code, msg) => {
    cleanupFiles(files);
    return res.status(code).json({ error: msg });
  };

  const campName = (req.body.camp_name || '').trim();
  const notes = (req.body.notes || '').trim();
  if (!campName) return fail(400, 'اسم/رقم المخيم مطلوب');

  let items;
  try {
    items = JSON.parse(req.body.payload || '[]');
  } catch (_) {
    return fail(400, 'صيغة البيانات غير صحيحة');
  }
  if (!Array.isArray(items) || items.length === 0) {
    return fail(400, 'يجب تعبئة بنود التقييم');
  }

  // التحقق من إلزامية كل بند + مرفق لكل بند
  const prepared = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const criterionName = (it.criterion_name || '').trim();
    if (!criterionName) return fail(400, `اسم البند مفقود في العنصر رقم ${i + 1}`);
    if (it.available !== 0 && it.available !== 1 && it.available !== '0' && it.available !== '1') {
      return fail(400, `يجب تحديد حالة التوفر للبند: ${criterionName}`);
    }
    const file = fileByField.get(it.file_field);
    if (!file) return fail(400, `المرفق إلزامي للبند: ${criterionName}`);
    prepared.push({
      criterion_id: it.criterion_id || null,
      criterion_name: criterionName,
      available: Number(it.available) ? 1 : 0,
      note: (it.note || '').trim() || null,
      file,
    });
  }

  const tx = db.transaction(() => {
    const aInfo = db
      .prepare('INSERT INTO assessments (user_id, camp_name, notes) VALUES (?, ?, ?)')
      .run(req.user.id, campName, notes || null);
    const assessmentId = aInfo.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO assessment_items (assessment_id, criterion_id, criterion_name, available, note, attachment_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const p of prepared) {
      const attId = saveAttachment(p.file);
      insertItem.run(assessmentId, p.criterion_id, p.criterion_name, p.available, p.note, attId);
    }
    return assessmentId;
  });

  try {
    const id = tx();
    res.status(201).json({ id });
  } catch (err) {
    cleanupFiles(files);
    console.error(err);
    res.status(500).json({ error: 'تعذّر حفظ التقييم' });
  }
});

// قائمة التقييمات — المشرف يرى تقييماته، المدير يرى الكل
router.get('/', authRequired, (req, res) => {
  const isManager = req.user.role === 'manager';
  const rows = isManager
    ? db.prepare(`
        SELECT a.*, u.name AS supervisor_name,
          (SELECT COUNT(*) FROM assessment_items ai WHERE ai.assessment_id = a.id) AS items_count,
          (SELECT COUNT(*) FROM assessment_items ai WHERE ai.assessment_id = a.id AND ai.available = 1) AS available_count
        FROM assessments a JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC`).all()
    : db.prepare(`
        SELECT a.*, u.name AS supervisor_name,
          (SELECT COUNT(*) FROM assessment_items ai WHERE ai.assessment_id = a.id) AS items_count,
          (SELECT COUNT(*) FROM assessment_items ai WHERE ai.assessment_id = a.id AND ai.available = 1) AS available_count
        FROM assessments a JOIN users u ON u.id = a.user_id
        WHERE a.user_id = ? ORDER BY a.id DESC`).all(req.user.id);
  res.json({ assessments: rows });
});

// تفاصيل تقييم واحد مع البنود
router.get('/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare(`
    SELECT a.*, u.name AS supervisor_name
    FROM assessments a JOIN users u ON u.id = a.user_id WHERE a.id = ?`).get(id);
  if (!a) return res.status(404).json({ error: 'التقييم غير موجود' });
  if (req.user.role !== 'manager' && a.user_id !== req.user.id) {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }
  const items = db.prepare('SELECT * FROM assessment_items WHERE assessment_id = ? ORDER BY id').all(id);
  res.json({ assessment: a, items });
});

module.exports = router;
