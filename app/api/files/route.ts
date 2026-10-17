import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, logActivity, nowIso, uid } from "@/lib/db";
import { listFiles, mapFile } from "@/lib/data";
import { languageForPath } from "@/lib/types";
import { ApiError } from "@/lib/errors";
import { cleanFilePath, ownedProjectId } from "@/lib/files";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const projectId = ownedProjectId(user.id, new URL(req.url).searchParams.get("projectId"));
    return json({ files: listFiles(user.id, projectId) });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{ projectId?: string; path?: string; content?: string }>(req);
    const projectId = ownedProjectId(user.id, body.projectId);
    const path = cleanFilePath(body.path);
    const content = typeof body.content === "string" ? body.content.slice(0, 1_000_000) : "";
    const db = getDb();
    const exists = db
      .prepare("SELECT id FROM files WHERE project_id = ? AND path = ?")
      .get(projectId, path);
    if (exists) throw new ApiError(409, `A file named ${path} already exists.`);
    const id = uid();
    const timestamp = nowIso();
    db.prepare(
      `INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    ).run(id, projectId, user.id, path, path.split("/").pop() ?? path, languageForPath(path), content, timestamp, timestamp);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(timestamp, projectId);
    logActivity(user.id, "file", `Added ${path}`, projectId);
    const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as Record<string, unknown>;
    return json({ file: mapFile(row) }, 201);
  });
}
