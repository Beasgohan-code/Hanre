import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb, logActivity, nowIso, uid } from "@/lib/db";
import { getProject, listFiles } from "@/lib/data";
import { ApiError } from "@/lib/errors";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = getProject(user.id, id);
    if (!project) throw new ApiError(404, "Project not found.");
    const files = listFiles(user.id, id);
    const db = getDb();
    const newId = uid();
    const timestamp = nowIso();
    let name = `${project.name} copy`;
    const existing = db.prepare("SELECT name FROM projects WHERE user_id = ?").all(user.id) as { name: string }[];
    const names = new Set(existing.map((row) => row.name));
    let counter = 2;
    while (names.has(name)) {
      name = `${project.name} copy ${counter}`;
      counter += 1;
    }
    db.prepare(
      `INSERT INTO projects (id, user_id, name, description, language, color, is_archived, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(newId, user.id, name, project.description, project.language, project.color, project.source, timestamp, timestamp);
    const insert = db.prepare(
      `INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const file of files) {
      insert.run(uid(), newId, user.id, file.path, file.name, file.isDir ? 1 : 0, file.language, file.content, timestamp, timestamp);
    }
    logActivity(user.id, "project", `Duplicated ${project.name}`, newId);
    return json({ project: getProject(user.id, newId) }, 201);
  });
}
