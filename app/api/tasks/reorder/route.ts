import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, nowIso } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { TASK_STATUSES } from "@/lib/tasks";

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      updates?: { id?: string; status?: string; position?: number }[];
    }>(req);
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      throw new ApiError(400, "No task updates were provided.");
    }
    if (body.updates.length > 200) throw new ApiError(400, "Too many task updates at once.");
    const db = getDb();
    const update = db.prepare(
      "UPDATE tasks SET status = ?, position = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    );
    const owned = db.prepare("SELECT id FROM tasks WHERE id = ? AND user_id = ?");
    db.exec("BEGIN");
    try {
      for (const item of body.updates) {
        const id = String(item.id ?? "");
        if (!owned.get(id, user.id)) throw new ApiError(404, "One of those tasks could not be found.");
        const status = TASK_STATUSES.includes(item.status as (typeof TASK_STATUSES)[number])
          ? item.status!
          : "backlog";
        const position = typeof item.position === "number" && Number.isFinite(item.position) ? item.position : 0;
        update.run(status, position, nowIso(), id, user.id);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return json({ ok: true });
  });
}
