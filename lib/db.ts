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
    CREATE VIRTUAL TABLE IF NOT EXISTS aria_docs USING fts5(
      drive_id UNINDEXED, name, mime UNINDEXED, url UNINDEXED, modified UNINDEXED, text,
      tokenize = 'porter unicode61'
    );
  `);
  return db;
}
