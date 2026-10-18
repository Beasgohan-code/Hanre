import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, logActivity, nowIso } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { snapshotVersion } from "@/lib/versions";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return guard(async () => {
    const user = await requireUser();
    const { id: projectId } = await context.params;
    const body = await readJson<{ changes?: { fileId?: string; content?: string }[] }>(req);
    if (!Array.isArray(body.changes) || body.changes.length === 0) {
      throw new ApiError(400, "No file changes to save.");
    }
    if (body.changes.length > 70) throw new ApiError(400, "Replace at most 70 files at a time.");

    const seen = new Set<string>();
    let totalBytes = 0;
    const changes = body.changes.map((change) => {
      if (typeof change.fileId !== "string" || !change.fileId || seen.has(change.fileId)) {
        throw new ApiError(400, "The replace request contains an invalid or duplicate file.");
      }
      if (typeof change.content !== "string" || change.content.length > 1_000_000) {
        throw new ApiError(400, "A replaced file exceeds the 1 MB per-file limit.");
      }
      seen.add(change.fileId);
      totalBytes += Buffer.byteLength(change.content, "utf8");
      return { fileId: change.fileId, content: change.content };
    });
    if (totalBytes > 2_000_000) throw new ApiError(413, "The replacement exceeds the 2 MB total limit.");

    const db = getDb();
    const rows = changes.map(({ fileId }) => db.prepare(
      "SELECT id, content FROM files WHERE id = ? AND project_id = ? AND user_id = ? AND is_dir = 0",
    ).get(fileId, projectId, user.id) as { id: string; content: string } | undefined);
    if (rows.some((row) => !row)) throw new ApiError(404, "A file no longer exists in this project.");
    const timestamp = nowIso();

    db.exec("BEGIN IMMEDIATE");
    try {
      for (let index = 0; index < changes.length; index += 1) {
        const previous = rows[index]!;
        const change = changes[index];
        if (String(previous.content ?? "") === change.content) continue;
        snapshotVersion(previous.id, String(previous.content ?? ""));
        db.prepare("UPDATE files SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
          .run(change.content, timestamp, previous.id, user.id);
      }
      db.prepare("UPDATE projects SET updated_at = ? WHERE id = ? AND user_id = ?")
        .run(timestamp, projectId, user.id);
      logActivity(user.id, "file", `Replaced text in ${changes.length} files`, projectId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return json({ updated: changes.length });
  });
}
