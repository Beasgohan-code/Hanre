import { requireUser } from "@/lib/auth";
import { guard, json, oneOf, readJson } from "@/lib/api";
import { getDb, logActivity, nowIso } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  TASK_PRIORITIES, TASK_STATUSES, taskWithProject, validateDueDate, verifyProject,
} from "@/lib/tasks";

async function ownedTask(userId: string, id: string) {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new ApiError(404, "Task not found.");
  return row;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await ownedTask(user.id, id);
    const body = await readJson<{
      title?: string;
      notes?: string;
      status?: string;
      priority?: string;
      projectId?: string | null;
      dueDate?: string | null;
      position?: number;
    }>(req);

    const title = body.title !== undefined ? String(body.title).trim().slice(0, 160) : String(existing.title);
    if (!title) throw new ApiError(400, "Task title is required.");
    const notes = body.notes !== undefined ? String(body.notes).slice(0, 2000) : String(existing.notes ?? "");
    const status = body.status !== undefined ? oneOf(body.status, TASK_STATUSES, "backlog") : String(existing.status);
    const priority = body.priority !== undefined ? oneOf(body.priority, TASK_PRIORITIES, "medium") : String(existing.priority);
    const projectId = body.projectId !== undefined ? verifyProject(user.id, body.projectId) : (existing.project_id as string | null);
    const dueDate = body.dueDate !== undefined ? validateDueDate(body.dueDate) : (existing.due_date as string | null);
    const position = typeof body.position === "number" && Number.isFinite(body.position)
      ? body.position
      : Number(existing.position);

    getDb().prepare(
      `UPDATE tasks SET title = ?, notes = ?, status = ?, priority = ?, project_id = ?, due_date = ?, position = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(title, notes, status, priority, projectId, dueDate, position, nowIso(), id, user.id);

    if (status === "done" && existing.status !== "done") {
      logActivity(user.id, "task", `Completed “${title}”`, projectId);
    }
    return json({ task: taskWithProject(id) });
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await ownedTask(user.id, id);
    getDb().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, user.id);
    return json({ ok: true });
  });
}
