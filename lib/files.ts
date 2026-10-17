import { getDb } from "./db";
import { ApiError } from "./errors";
import { str } from "./api";

export function cleanFilePath(input: unknown): string {
  const raw = str(input, "File path", { min: 1, max: 180 });
  const path = raw.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  const parts = path.split("/");
  if (!path || parts.some((part) => !part.trim() || part === "." || part === "..")) {
    throw new ApiError(400, "Use a relative file path like src/app.js.");
  }
  if (/[\u0000-\u001f]/.test(path)) throw new ApiError(400, "The file path contains invalid characters.");
  return path;
}

export function ownedProjectId(userId: string, projectId: unknown): string {
  const id = str(projectId, "Project", { min: 1, max: 80 });
  const row = getDb().prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) throw new ApiError(404, "Project not found.");
  return id;
}
