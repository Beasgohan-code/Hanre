import { getDb, nowIso, uid } from "./db";
import type { FileVersion } from "./types";

type Row = Record<string, unknown>;

/** Snapshot the *previous* content of a file so every save can be undone. */
export function snapshotVersion(fileId: string, content: string) {
  const db = getDb();
  const last = db
    .prepare("SELECT content FROM file_versions WHERE file_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .get(fileId) as Row | undefined;
  if (last && String(last.content) === content) return;

  db.prepare("INSERT INTO file_versions (id, file_id, content, created_at) VALUES (?, ?, ?, ?)").run(
    uid(),
    fileId,
    content,
    nowIso(),
  );
  db.prepare(
    `DELETE FROM file_versions
     WHERE file_id = ? AND id NOT IN (
       SELECT id FROM file_versions WHERE file_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30
     )`,
  ).run(fileId, fileId);
}

export function listVersions(fileId: string): FileVersion[] {
  const rows = getDb()
    .prepare(
      "SELECT id, file_id, content, created_at FROM file_versions WHERE file_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30",
    )
    .all(fileId) as Row[];
  return rows.map((row) => {
    const content = String(row.content ?? "");
    const firstLine = content.split("\n").find((line) => line.trim()) ?? "";
    return {
      id: String(row.id),
      fileId: String(row.file_id),
      size: content.length,
      preview: firstLine.trim().slice(0, 90),
      createdAt: String(row.created_at),
    };
  });
}

export function getVersion(fileId: string, versionId: string): (FileVersion & { content: string }) | null {
  const row = getDb()
    .prepare("SELECT id, file_id, content, created_at FROM file_versions WHERE id = ? AND file_id = ?")
    .get(versionId, fileId) as Row | undefined;
  if (!row) return null;
  const content = String(row.content ?? "");
  return {
    id: String(row.id),
    fileId: String(row.file_id),
    size: content.length,
    preview: content.split("\n").find((line) => line.trim())?.trim().slice(0, 90) ?? "",
    createdAt: String(row.created_at),
    content,
  };
}
