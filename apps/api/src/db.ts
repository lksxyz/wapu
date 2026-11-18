import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, "../wapu.db");

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// v2: fx session per project, deploy snapshots, summarized trace projection.
// The previous single-HTML schema is wiped on first boot of this version.
export function runMigrations(): { reset: boolean } {
  const version = db.pragma("user_version", { simple: true }) as number;
  let reset = false;

  // v6 stored a scanned page (url, scan, options). A row from that model has no
  // fx session, so it cannot be resumed or chatted with. Wipe it once, the same
  // way the single-HTML schema went in v2.
  const projectsTable = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'`)
    .get();
  const hasSession = projectsTable
    ? (db.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[]).some(
        (column) => column.name === "sessionId",
      )
    : true;
  if (!hasSession) {
    db.exec(`DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS projects;`);
    reset = true;
  }

  if (version < 2) {
    db.exec(`DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS projects;`);
    reset = true;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      userId        TEXT NOT NULL,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL UNIQUE,
      sessionId     TEXT NOT NULL UNIQUE,
      isDeployed    INTEGER NOT NULL DEFAULT 0,
      deployVersion INTEGER NOT NULL DEFAULT 0,
      createdAt     TEXT NOT NULL,
      phase         TEXT NOT NULL DEFAULT 'build',
      design        TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id        TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      role      TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content   TEXT NOT NULL,
      steps     TEXT,
      position  INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_project
      ON messages(projectId, position);
  `);

  // v3: intake phase and the chosen design-system slug. Existing projects were
  // built before the menu existed, so they start at 'build'.
  if (reset || version < 3) {
    const columns = db.prepare(`PRAGMA table_info(projects)`).all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "phase")) {
      db.exec(`ALTER TABLE projects ADD COLUMN phase TEXT NOT NULL DEFAULT 'build'`);
    }
    if (!columns.some((column) => column.name === "design")) {
      db.exec(`ALTER TABLE projects ADD COLUMN design TEXT`);
    }
    db.pragma("user_version = 3");
  }

  // v4: whether the turn left a page on disk. The transcript used to infer this
  // from the reply text, so a cancelled turn still announced "Page generated".
  if (reset || version < 4) {
    const columns = db.prepare(`PRAGMA table_info(messages)`).all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "saved")) {
      db.exec(`ALTER TABLE messages ADD COLUMN saved INTEGER NOT NULL DEFAULT 0`);
    }
    db.pragma("user_version = 4");
  }

  // v5: the question the agent is waiting on, so a reload still shows it.
  if (reset || version < 5) {
    const columns = db.prepare(`PRAGMA table_info(projects)`).all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "pendingQuestion")) {
      db.exec(`ALTER TABLE projects ADD COLUMN pendingQuestion TEXT`);
    }
    db.pragma("user_version = 5");
  }

  // v7: whether the turn itself failed. A tool call the host rejected is a
  // failed step, not a failed turn; the header must not conflate them.
  if (reset || version < 7) {
    const columns = db.prepare(`PRAGMA table_info(messages)`).all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "failed")) {
      db.exec(`ALTER TABLE messages ADD COLUMN failed INTEGER NOT NULL DEFAULT 0`);
    }
    db.pragma("user_version = 7");
  }

  return { reset };
}
