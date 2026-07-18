'use strict';

const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

// إحصائيات لوحة تحكم المدير
router.get('/', authRequired, requireRole('manager'), (req, res) => {
  const totalAssessments = db.prepare('SELECT COUNT(*) AS c FROM assessments').get().c;
  const totalReports = db.prepare('SELECT COUNT(*) AS c FROM reports').get().c;
  const openReports = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'").get().c;
  const doneReports = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'done'").get().c;
  const supervisors = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'supervisor'").get().c;

  const reportsByCategory = db.prepare(`
    SELECT category, COUNT(*) AS c FROM reports GROUP BY category ORDER BY c DESC`).all();

  // نسبة توفر البنود عبر كل التقييمات
  const availability = db.prepare(`
    SELECT criterion_name AS name,
      SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) AS available_count,
      COUNT(*) AS total
    FROM assessment_items GROUP BY criterion_name ORDER BY total DESC`).all();

  res.json({
    stats: { totalAssessments, totalReports, openReports, doneReports, supervisors },
    reportsByCategory,
    availability,
  });
});

module.exports = router;
