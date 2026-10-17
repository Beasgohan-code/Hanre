import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (!q) return json({ projects: [], files: [], snippets: [], tasks: [] });
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const db = getDb();
    const projects = db
      .prepare(
        `SELECT id, name, language, color, description FROM projects
         WHERE user_id = ? AND is_archived = 0 AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
         ORDER BY updated_at DESC LIMIT 5`,
      )
      .all(user.id, like, like);
    const files = db
      .prepare(
        `SELECT f.id, f.path, f.project_id, p.name AS project_name, f.language FROM files f
         JOIN projects p ON p.id = f.project_id
         WHERE f.user_id = ? AND f.path LIKE ? ESCAPE '\\'
         ORDER BY f.updated_at DESC LIMIT 6`,
      )
      .all(user.id, like);
    const snippets = db
      .prepare(
        `SELECT id, title, language, description FROM snippets
         WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
         ORDER BY is_starred DESC, updated_at DESC LIMIT 5`,
      )
      .all(user.id, like, like, like);
    const tasks = db
      .prepare(
        `SELECT id, title, status, priority FROM tasks
         WHERE user_id = ? AND title LIKE ? ESCAPE '\\' AND status != 'done'
         ORDER BY updated_at DESC LIMIT 5`,
      )
      .all(user.id, like);
    return json({ projects, files, snippets, tasks });
  });
}
