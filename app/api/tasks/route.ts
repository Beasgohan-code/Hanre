import { requireUser } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { getDb, logActivity } from "@/lib/db";
import { mapTask } from "@/lib/data";
import { createTaskRecord, taskWithProject } from "@/lib/tasks";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    const rows = getDb()
      .prepare(
        `SELECT t.*, p.name AS project_name FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.user_id = ? ORDER BY t.position ASC, t.created_at ASC`,
      )
      .all(user.id) as Record<string, unknown>[];
    return json({ tasks: rows.map(mapTask) });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      title?: string;
      notes?: string;
      status?: string;
      priority?: string;
      projectId?: string | null;
      dueDate?: string | null;
    }>(req);
    const title = str(body.title, "Task title", { min: 1, max: 160 });
    const notes = str(body.notes, "Notes", { max: 2000, optional: true });
    const id = createTaskRecord(user.id, {
      title,
      notes,
      status: body.status,
      priority: body.priority,
      projectId: body.projectId,
      dueDate: body.dueDate,
    });
    const task = taskWithProject(id);
    logActivity(user.id, "task", `Added task “${title}”`, task.projectId);
    return json({ task }, 201);
  });
}
