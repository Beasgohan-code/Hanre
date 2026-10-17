import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const row = getDb().prepare("SELECT id FROM runs WHERE id = ? AND user_id = ?").get(id, user.id);
    if (!row) throw new ApiError(404, "Run not found.");
    getDb().prepare("DELETE FROM runs WHERE id = ? AND user_id = ?").run(id, user.id);
    return json({ ok: true });
  });
}
