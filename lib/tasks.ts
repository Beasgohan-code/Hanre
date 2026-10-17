import { getDb, nowIso, uid } from "./db";
import { mapTask } from "./data";
import { ApiError } from "./errors";
import { oneOf } from "./api";

export const TASK_STATUSES = ["backlog", "in_progress", "review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export function validateDueDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "That due date is not valid.");
  return date.toISOString();
}

export function verifyProject(userId: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const id = String(value);
  const row = getDb().prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) throw new ApiError(400, "That project does not exist.");
  return id;
}

export function taskWithProject(id: string) {
  const row = getDb()
    .prepare(
      `SELECT t.*, p.name AS project_name FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?`,
    )
    .get(id) as Record<string, unknown>;
  return mapTask(row);
}

export function createTaskRecord(
  userId: string,
  input: {
    title: string;
    notes?: string;
    status?: string;
    priority?: string;
    projectId?: string | null;
    dueDate?: string | null;
  },
) {
  const db = getDb();
  const status = oneOf(input.status, TASK_STATUSES, "backlog");
  const priority = oneOf(input.priority, TASK_PRIORITIES, "medium");
  const projectId = verifyProject(userId, input.projectId);
  const dueDate = validateDueDate(input.dueDate);
  const maxRow = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS max FROM tasks WHERE user_id = ? AND status = ?")
    .get(userId, status) as { max: number };
  const id = uid();
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO tasks (id, user_id, project_id, title, notes, status, priority, due_date, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, projectId, input.title, input.notes ?? "", status, priority, dueDate, Number(maxRow.max) + 1, timestamp, timestamp);
  return id;
}
