import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, nowIso } from "@/lib/db";
import { mapFile } from "@/lib/data";
import { languageForPath } from "@/lib/types";
import { ApiError } from "@/lib/errors";
import { cleanFilePath } from "@/lib/files";

async function ownedFile(userId: string, id: string) {
  const row = getDb().prepare("SELECT * FROM files WHERE id = ? AND user_id = ?").get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new ApiError(404, "File not found.");
  return row;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await ownedFile(user.id, id);
    const body = await readJson<{ content?: string; path?: string }>(req);
    const db = getDb();
    const timestamp = nowIso();
    const projectId = String(existing.project_id);

    if (body.path !== undefined) {
      const path = cleanFilePath(body.path);
      const clash = db
        .prepare("SELECT id FROM files WHERE project_id = ? AND path = ? AND id != ?")
        .get(projectId, path, id);
      if (clash) throw new ApiError(409, `A file named ${path} already exists.`);
      db.prepare(
        "UPDATE files SET path = ?, name = ?, language = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      ).run(
        path,
        path.split("/").pop() ?? path,
        languageForPath(path),
        typeof body.content === "string" ? body.content : String(existing.content ?? ""),
        timestamp,
        id,
        user.id,
      );
    } else if (body.content !== undefined) {
      if (typeof body.content !== "string") throw new ApiError(400, "File content must be text.");
      db.prepare("UPDATE files SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
        body.content.slice(0, 1_000_000),
        timestamp,
        id,
        user.id,
      );
    }

    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(timestamp, projectId);
    const updated = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as Record<string, unknown>;
    return json({ file: mapFile(updated) });
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const file = await ownedFile(user.id, id);
    const db = getDb();
    db.prepare("DELETE FROM files WHERE id = ? AND user_id = ?").run(id, user.id);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), String(file.project_id));
    return json({ ok: true });
  });
}
