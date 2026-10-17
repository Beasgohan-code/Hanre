import { requireUser } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { getDb, logActivity, nowIso } from "@/lib/db";
import { getProject } from "@/lib/data";
import { ApiError } from "@/lib/errors";

async function ownedProject(userId: string, id: string) {
  const row = getDb()
    .prepare("SELECT id, name, is_archived FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId) as { id: string; name: string; is_archived: number } | undefined;
  if (!row) throw new ApiError(404, "Project not found.");
  return row;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = getProject(user.id, id);
    if (!project) throw new ApiError(404, "Project not found.");
    return json({ project });
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await ownedProject(user.id, id);
    const body = await readJson<{
      name?: string;
      description?: string;
      color?: string;
      language?: string;
      isArchived?: boolean;
      favorite?: boolean;
    }>(req);

    const name = body.name !== undefined ? str(body.name, "Project name", { min: 1, max: 80 }) : existing.name;
    const description = body.description !== undefined
      ? str(body.description, "Description", { max: 400, optional: true })
      : undefined;
    const color = body.color && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : undefined;
    const language = body.language && body.language.length < 30 ? body.language : undefined;
    const archived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : undefined;
    const favorite = body.favorite !== undefined ? (body.favorite ? 1 : 0) : undefined;

    const db = getDb();
    db.prepare(
      `UPDATE projects SET
        name = ?,
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        language = COALESCE(?, language),
        is_archived = COALESCE(?, is_archived),
        favorite = COALESCE(?, favorite),
        updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(name, description ?? null, color ?? null, language ?? null, archived ?? null, favorite ?? null, nowIso(), id, user.id);

    const meaningful =
      body.name !== undefined ||
      body.description !== undefined ||
      body.color !== undefined ||
      body.language !== undefined ||
      body.isArchived !== undefined;
    if (archived === 1) logActivity(user.id, "project", `Archived ${name}`, id);
    else if (archived === 0 && existing.is_archived) logActivity(user.id, "project", `Restored ${name}`, id);
    else if (meaningful) logActivity(user.id, "project", `Updated ${name}`, id);

    return json({ project: getProject(user.id, id) });
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = await ownedProject(user.id, id);
    const db = getDb();
    db.prepare("UPDATE tasks SET project_id = NULL WHERE project_id = ? AND user_id = ?").run(id, user.id);
    db.prepare("UPDATE runs SET project_id = NULL WHERE project_id = ? AND user_id = ?").run(id, user.id);
    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, user.id);
    logActivity(user.id, "project", `Deleted ${project.name}`, null);
    return json({ ok: true });
  });
}
