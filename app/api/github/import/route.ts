import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, logActivity, nowIso, uid } from "@/lib/db";
import { getProject } from "@/lib/data";
import { loadRepo } from "@/lib/github";
import { languageForPath } from "@/lib/types";
import { ApiError } from "@/lib/errors";

const LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  html: "html",
  css: "css",
  java: "java",
  rust: "rust",
  php: "php",
  shell: "shell",
  markdown: "markdown",
};

const COLORS: Record<string, string> = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  python: "#fbbf24",
  html: "#fb7185",
  css: "#8b7bff",
  rust: "#dea584",
  java: "#60a5fa",
  php: "#a78bfa",
  shell: "#5eead4",
};

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{ repo?: string; branch?: string; paths?: string[]; name?: string }>(req);
    const repo = String(body.repo ?? "").trim();
    if (!repo) throw new ApiError(400, "Enter a GitHub repository to import.");
    const data = await loadRepo(repo, body.branch);
    const requested = Array.isArray(body.paths) ? new Set(body.paths.map(String)) : null;
    const selected = data.files.filter((file) => {
      if (requested && requested.size > 0 && !requested.has(file.path)) return false;
      const clean = file.path.replace(/^\/+/, "");
      return clean && !clean.includes("..") && clean.length <= 180;
    });
    if (!selected.length) throw new ApiError(400, "Select at least one file to import.");
    if (selected.length > 70) throw new ApiError(400, "Import at most 70 files at a time.");

    const metaLanguage = (data.language || "").toLowerCase();
    const language = LANGUAGE_MAP[metaLanguage] ?? languageForPath(selected[0].path);
    const displayName = (body.name && String(body.name).trim().slice(0, 80)) || data.repo;
    const description = (data.description || `Imported from GitHub · ${data.owner}/${data.repo}`).slice(0, 400);
    const color = COLORS[language] ?? "#8b7bff";

    const db = getDb();
    const id = uid();
    const timestamp = nowIso();
    db.prepare(
      `INSERT INTO projects (id, user_id, name, description, language, color, is_archived, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(id, user.id, displayName, description, language, color, `github:${data.owner}/${data.repo}@${data.branch}`, timestamp, timestamp);

    const insert = db.prepare(
      `INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    );
    for (const file of selected) {
      const path = file.path.replace(/^\/+/, "");
      insert.run(uid(), id, user.id, path, path.split("/").pop() ?? path, languageForPath(path), file.content, timestamp, timestamp);
    }
    logActivity(user.id, "project", `Imported ${data.owner}/${data.repo} from GitHub`, id);
    return json({ project: getProject(user.id, id), imported: selected.length, branch: data.branch }, 201);
  });
}
