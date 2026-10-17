import { getDb } from "./db";
import type {
  Activity, DashboardData, Project, ProjectFile, Run, Snippet, Task,
} from "./types";

type Row = Record<string, unknown>;

export function mapProject(row: Row): Project {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    language: String(row.language ?? "javascript"),
    color: String(row.color ?? "#8b7bff"),
    isArchived: Boolean(row.is_archived),
    source: String(row.source ?? "blank"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    fileCount: Number(row.file_count ?? 0),
    runCount: Number(row.run_count ?? 0),
    openTasks: Number(row.open_tasks ?? 0),
  };
}

export function mapFile(row: Row): ProjectFile {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    path: String(row.path),
    name: String(row.name),
    isDir: Boolean(row.is_dir),
    language: String(row.language ?? "plaintext"),
    content: String(row.content ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapSnippet(row: Row): Snippet {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags ?? "[]"));
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    language: String(row.language ?? "javascript"),
    code: String(row.code ?? ""),
    tags,
    isStarred: Boolean(row.is_starred),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapTask(row: Row): Task {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    title: String(row.title),
    notes: String(row.notes ?? ""),
    status: String(row.status ?? "backlog") as Task["status"],
    priority: String(row.priority ?? "medium") as Task["priority"],
    dueDate: row.due_date ? String(row.due_date) : null,
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapRun(row: Row): Run {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    fileId: row.file_id ? String(row.file_id) : null,
    fileName: row.file_name ? String(row.file_name) : null,
    command: String(row.command ?? ""),
    language: String(row.language ?? "javascript"),
    status: String(row.status ?? "success") as Run["status"],
    output: String(row.output ?? ""),
    durationMs: Number(row.duration_ms ?? 0),
    createdAt: String(row.created_at),
  };
}

export function mapActivity(row: Row): Activity {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: String(row.kind),
    message: String(row.message),
    projectId: row.project_id ? String(row.project_id) : null,
    createdAt: String(row.created_at),
  };
}

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) AS file_count,
    (SELECT COUNT(*) FROM runs r WHERE r.project_id = p.id) AS run_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks
  FROM projects p
`;

export function listProjects(userId: string, includeArchived = false): Project[] {
  const rows = getDb()
    .prepare(
      `${PROJECT_SELECT} WHERE p.user_id = ? ${includeArchived ? "" : "AND p.is_archived = 0"} ORDER BY p.updated_at DESC`,
    )
    .all(userId) as Row[];
  return rows.map(mapProject);
}

export function getProject(userId: string, id: string): Project | null {
  const row = getDb()
    .prepare(`${PROJECT_SELECT} WHERE p.user_id = ? AND p.id = ?`)
    .get(userId, id) as Row | undefined;
  return row ? mapProject(row) : null;
}

export function listFiles(userId: string, projectId: string): ProjectFile[] {
  const rows = getDb()
    .prepare("SELECT * FROM files WHERE user_id = ? AND project_id = ? ORDER BY is_dir DESC, path ASC")
    .all(userId, projectId) as Row[];
  return rows.map(mapFile);
}

export function listSnippets(userId: string): Snippet[] {
  const rows = getDb()
    .prepare("SELECT * FROM snippets WHERE user_id = ? ORDER BY is_starred DESC, updated_at DESC")
    .all(userId) as Row[];
  return rows.map(mapSnippet);
}

export function listTasks(userId: string): Task[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, p.name AS project_name FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.user_id = ? ORDER BY t.position ASC, t.created_at ASC`,
    )
    .all(userId) as Row[];
  return rows.map(mapTask);
}

export function listRuns(userId: string, limit = 25, offset = 0, status?: string): Run[] {
  const db = getDb();
  const rows = status && status !== "all"
    ? db.prepare(
        `SELECT r.*, p.name AS project_name, f.name AS file_name FROM runs r
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN files f ON f.id = r.file_id
         WHERE r.user_id = ? AND r.status = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      ).all(userId, status, limit, offset)
    : db.prepare(
        `SELECT r.*, p.name AS project_name, f.name AS file_name FROM runs r
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN files f ON f.id = r.file_id
         WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      ).all(userId, limit, offset);
  return (rows as Row[]).map(mapRun);
}

export function countRuns(userId: string, status?: string): number {
  const row = status && status !== "all"
    ? getDb().prepare("SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND status = ?").get(userId, status)
    : getDb().prepare("SELECT COUNT(*) AS n FROM runs WHERE user_id = ?").get(userId);
  return Number((row as Row)?.n ?? 0);
}

export function listActivity(userId: string, limit = 12): Activity[] {
  const rows = getDb()
    .prepare("SELECT * FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit) as Row[];
  return rows.map(mapActivity);
}

export function getDashboardData(userId: string): DashboardData {
  const db = getDb();
  const since = new Date(Date.now() - 7 * 86400000);
  const count = (sql: string) =>
    Number((db.prepare(sql).get(userId) as Row)?.n ?? 0);

  const projects = listProjects(userId);
  const tasks = listTasks(userId);
  const runs = listRuns(userId, 8);
  const totalRuns = count("SELECT COUNT(*) AS n FROM runs WHERE user_id = ?");
  const successRuns = count("SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND status = 'success'");
  const runsThisWeek = count(
    "SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND created_at >= '" + since.toISOString() + "'",
  );
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const snippets = listSnippets(userId);

  const dayRows = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n FROM runs
       WHERE user_id = ? AND created_at >= ? GROUP BY day`,
    )
    .all(userId, new Date(Date.now() - 6 * 86400000).toISOString()) as Row[];
  const byDay = new Map(dayRows.map((row) => [String(row.day), Number(row.n)]));
  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { day: key, count: byDay.get(key) ?? 0 };
  });

  return {
    stats: {
      projects: projects.length,
      snippets: snippets.length,
      openTasks,
      runs: totalRuns,
      runsThisWeek,
      successRate: totalRuns ? Math.round((successRuns / totalRuns) * 100) : 0,
    },
    projects,
    tasks,
    runs,
    activity: listActivity(userId, 8),
    activityByDay,
    snippets: snippets.slice(0, 3),
  };
}

export function workspaceCounts(userId: string) {
  const db = getDb();
  const row = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM projects WHERE user_id = ? AND is_archived = 0) AS projects,
       (SELECT COUNT(*) FROM files WHERE user_id = ?) AS files,
       (SELECT COUNT(*) FROM snippets WHERE user_id = ?) AS snippets,
       (SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status != 'done') AS open_tasks,
       (SELECT COUNT(*) FROM runs WHERE user_id = ?) AS runs`,
  ).get(userId, userId, userId, userId, userId) as Row;
  return {
    projects: Number(row?.projects ?? 0),
    files: Number(row?.files ?? 0),
    snippets: Number(row?.snippets ?? 0),
    openTasks: Number(row?.open_tasks ?? 0),
    runs: Number(row?.runs ?? 0),
  };
}

export function runStats(userId: string) {
  const db = getDb();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const row = db.prepare(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success,
       COALESCE(AVG(CASE WHEN status != 'unsupported' THEN duration_ms END), 0) AS avg_duration,
       COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week
     FROM runs WHERE user_id = ?`,
  ).get(since, userId) as Row;
  const total = Number(row?.total ?? 0);
  const success = Number(row?.success ?? 0);
  return {
    total,
    success,
    successRate: total ? Math.round((success / total) * 100) : 0,
    averageDuration: Math.round(Number(row?.avg_duration ?? 0)),
    thisWeek: Number(row?.week ?? 0),
  };
}
