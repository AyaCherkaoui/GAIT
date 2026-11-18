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
    CREATE TABLE IF NOT EXISTS allowed_users (
      email TEXT PRIMARY KEY,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'tutor' CHECK (role IN ('tutor', 'director')),
      active INTEGER NOT NULL DEFAULT 1,
      added_at TEXT DEFAULT (datetime('now'))
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
  // Each tutor sees only their own rows. Rows from before sign-in existed keep user_id NULL until the director signs in and takes them over (lib/auth.ts).
  for (const table of ["sessions", "tasks", "quiz_results"]) {
    if (!hasColumn(table, "user_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  }
  // Role chooser: people who existed before it count as onboarded. requested_role is only a request; access comes from allowed_users.
  if (!hasColumn("users", "onboarded")) {
    db.exec("ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE users SET onboarded = 1");
  }
  if (!hasColumn("users", "requested_role")) db.exec("ALTER TABLE users ADD COLUMN requested_role TEXT CHECK (requested_role IN ('tutor', 'director'))");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_hits (key TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS rate_hits_key_at ON rate_hits (key, at);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id, id);
    CREATE INDEX IF NOT EXISTS tasks_user ON tasks (user_id, id);
    CREATE INDEX IF NOT EXISTS quiz_results_user ON quiz_results (user_id, id);
  `);
  // Counts of feature use: kind, time and who. No names, no text.
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      at TEXT DEFAULT (datetime('now')),
      user_id INTEGER REFERENCES users(id)
    );
  `);
  // Debrief: a private shift check-in, read only by its owner. Director note: what the director wrote on a session, shown to its tutor.
  db.exec(`
    CREATE TABLE IF NOT EXISTS debriefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      drain INTEGER NOT NULL,
      note TEXT DEFAULT '',
      user_id INTEGER REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS debriefs_user ON debriefs (user_id, id);
  `);
  if (!hasColumn("sessions", "director_note")) db.exec("ALTER TABLE sessions ADD COLUMN director_note TEXT");
  if (!hasColumn("sessions", "director_note_at")) db.exec("ALTER TABLE sessions ADD COLUMN director_note_at TEXT");
  // Course AI policies: each tutor keeps their own.
  db.exec(`
    CREATE TABLE IF NOT EXISTS course_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      course_code TEXT NOT NULL,
      professor TEXT DEFAULT '',
      policy TEXT NOT NULL DEFAULT 'unknown',
      details TEXT DEFAULT '',
      source TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, course_code)
    );
  `);
  // Task forces: one membership per person; ARIA file tags (source: folder, ai or director); the task force a task belongs to.
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_force_members (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      task_force_key TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS aria_doc_tags (
      drive_id TEXT PRIMARY KEY,
      task_force_key TEXT,
      source TEXT NOT NULL
    );
  `);
  if (!hasColumn("tasks", "task_force")) db.exec("ALTER TABLE tasks ADD COLUMN task_force TEXT");
  if (!hasColumn("users", "session_version")) db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0");
  return db;
}
