import { requireUser } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { getDb, logActivity, nowIso, uid } from "@/lib/db";
import { getProject, listProjects } from "@/lib/data";
import { findTemplate } from "@/lib/templates";
import { languageForPath } from "@/lib/types";
import { ApiError } from "@/lib/errors";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const includeArchived = new URL(req.url).searchParams.get("archived") === "true";
    return json({ projects: listProjects(user.id, includeArchived) });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      name?: string;
      description?: string;
      language?: string;
      color?: string;
      template?: string;
    }>(req);
    const name = str(body.name, "Project name", { min: 1, max: 80 });
    const description = str(body.description, "Description", { max: 400, optional: true });
    const template = findTemplate(String(body.template ?? "blank"));
    const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color ?? ""))
      ? String(body.color)
      : "#8b7bff";
    const language = body.language && body.language.length < 30 ? body.language : template.language;

    const db = getDb();
    const id = uid();
    const timestamp = nowIso();
    db.prepare(
      `INSERT INTO projects (id, user_id, name, description, language, color, is_archived, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(id, user.id, name, description, language, color, `template:${template.id}`, timestamp, timestamp);

    const insertFile = db.prepare(
      `INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    );
    for (const file of template.files) {
      insertFile.run(
        uid(), id, user.id, file.path, file.path, languageForPath(file.path),
        file.content.replace(/^# Project/m, `# ${name}`), timestamp, timestamp,
      );
    }
    logActivity(user.id, "project", `Created ${name}`, id);
    return json({ project: getProject(user.id, id) }, 201);
  });
}

export async function DELETE() {
  return guard(async () => {
    throw new ApiError(405, "Specify a project to delete.");
  });
}
