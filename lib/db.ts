import { DatabaseSync } from "node:sqlite";
import path from "node:path";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(process.env.GAIT_DB || process.env.GAIT_DB_PATH || path.join(process.cwd(), "gait.db"));
  db.exec("PRAGMA busy_timeout = 30000; PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL, name TEXT, picture TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT (datetime('now'))
    );
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
    CREATE TABLE IF NOT EXISTS quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      score INTEGER, total INTEGER, topic TEXT
    );
  `);
  const hasColumn = (table: string, column: string) =>
    (db!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  if (!hasColumn("sessions", "reflection")) db.exec("ALTER TABLE sessions ADD COLUMN reflection TEXT");
  // Each tutor sees only their own rows. Rows from before sign-in existed keep user_id NULL and stay hidden from everyone.
  for (const table of ["sessions", "tasks", "quiz_results"]) {
    if (!hasColumn(table, "user_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  }
  return db;
}
