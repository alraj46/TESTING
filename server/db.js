'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    username     TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('supervisor','manager')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS criteria (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    stored_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype   TEXT NOT NULL,
    size       INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    camp_name  TEXT NOT NULL,
    notes      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessment_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id  INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    criterion_id   INTEGER REFERENCES criteria(id),
    criterion_name TEXT NOT NULL,
    available      INTEGER NOT NULL CHECK (available IN (0,1)),
    note           TEXT,
    attachment_id  INTEGER NOT NULL REFERENCES attachments(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    description TEXT NOT NULL,
    attachment_id INTEGER REFERENCES attachments(id),
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at   TEXT,
    closed_by   INTEGER REFERENCES users(id)
  );
`);

// --- Seed default assessment criteria (بنود الخدمات الأساسية) ---
const criteriaCount = db.prepare('SELECT COUNT(*) AS c FROM criteria').get().c;
if (criteriaCount === 0) {
  const defaults = [
    'الكهرباء',
    'المياه',
    'دورات المياه والنظافة',
    'الإضاءة',
    'التكييف والتهوية',
    'الخيام والسكن',
    'أنظمة الإطفاء والسلامة',
    'الإسعافات الأولية',
    'الأمن والحراسة',
    'توفر الطعام',
  ];
  const insert = db.prepare('INSERT INTO criteria (name, sort_order) VALUES (?, ?)');
  const seed = db.transaction(() => {
    defaults.forEach((name, i) => insert.run(name, i));
  });
  seed();
}

// --- Seed default manager account ---
const managerExists = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'manager'").get().c;
if (managerExists === 0) {
  const username = process.env.MANAGER_USERNAME || 'manager';
  const password = process.env.MANAGER_PASSWORD || 'manager123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('مدير النظام', username, hash, 'manager');
  console.log(`[seed] تم إنشاء حساب المدير الافتراضي: اسم المستخدم="${username}" كلمة المرور="${password}"`);
}

module.exports = { db, UPLOAD_DIR, DATA_DIR };
