import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedDemoUser } from "./seed";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(path.join(dataDir, "hanre.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n === 0) {
    try {
      seedDemoUser(db);
    } catch (err) {
      console.error("[hanre] seed failed", err);
    }
  }
  return db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#8b7bff',
      prefs TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'javascript',
      color TEXT NOT NULL DEFAULT '#8b7bff',
      is_archived INTEGER NOT NULL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'blank',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      is_dir INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'plaintext',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, path)
    );
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'javascript',
      code TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      is_starred INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      position REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT,
      file_id TEXT,
      command TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'javascript',
      status TEXT NOT NULL DEFAULT 'success',
      output TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file_versions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      project_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_user ON snippets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_versions_file ON file_versions(file_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_shares_slug ON shares(slug);
  `);

  // Forward-compatible migrations for databases created before a column existed.
  const projectColumns = d.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projectColumns.some((column) => column.name === "favorite")) {
    d.exec("ALTER TABLE projects ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0");
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  return crypto.randomUUID();
}

export function logActivity(userId: string, kind: string, message: string, projectId: string | null = null) {
  const d = getDb();
  d.prepare(
    "INSERT INTO activity (id, user_id, kind, message, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(uid(), userId, kind, message, projectId, nowIso());
}
