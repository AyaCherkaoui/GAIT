import { DatabaseSync } from "node:sqlite";
import path from "node:path";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(process.env.GAIT_DB_PATH || path.join(process.cwd(), "gait.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      student_name TEXT, course TEXT, notes TEXT, outputs TEXT
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      title TEXT, description TEXT, plan TEXT, related TEXT
    );
    CREATE TABLE IF NOT EXISTS course_policies (
      course_code TEXT PRIMARY KEY,
      professor TEXT DEFAULT '',
      policy TEXT NOT NULL DEFAULT 'unknown',
      details TEXT DEFAULT '',
      source TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS debriefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      drain INTEGER NOT NULL,
      note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      at TEXT DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS aria_docs USING fts5(
      drive_id UNINDEXED, name, mime UNINDEXED, url UNINDEXED, modified UNINDEXED, text,
      tokenize = 'porter unicode61'
    );
  `);
  return db;
}
