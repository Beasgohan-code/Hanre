import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, nowIso } from "@/lib/db";
import { mapFile } from "@/lib/data";
import { ApiError } from "@/lib/errors";
import { getVersion, listVersions, snapshotVersion } from "@/lib/versions";

async function ownedFile(userId: string, id: string) {
  const row = getDb().prepare("SELECT * FROM files WHERE id = ? AND user_id = ?").get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new ApiError(404, "File not found.");
  return row;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await ownedFile(user.id, id);
    const versionId = new URL(req.url).searchParams.get("versionId");
    if (versionId) {
      const version = getVersion(id, versionId);
      if (!version) throw new ApiError(404, "That version no longer exists.");
      return json({ version });
    }
    return json({ versions: listVersions(id) });
  });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const file = await ownedFile(user.id, id);
    const body = await readJson<{ versionId?: string }>(req);
    if (!body.versionId) throw new ApiError(400, "Choose a version to restore.");
    const version = getVersion(id, body.versionId);
    if (!version) throw new ApiError(404, "That version no longer exists.");

    snapshotVersion(id, String(file.content ?? ""));
    const timestamp = nowIso();
    getDb()
      .prepare("UPDATE files SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(version.content.slice(0, 1_000_000), timestamp, id, user.id);
    getDb()
      .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
      .run(timestamp, String(file.project_id));

    const updated = getDb().prepare("SELECT * FROM files WHERE id = ?").get(id) as Record<string, unknown>;
    return json({ file: mapFile(updated), restoredAt: version.createdAt });
  });
}
