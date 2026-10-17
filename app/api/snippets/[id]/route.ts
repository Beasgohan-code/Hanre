import { requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { getDb, nowIso } from "@/lib/db";
import { mapSnippet } from "@/lib/data";
import { ApiError } from "@/lib/errors";
import { normalizeTags } from "@/lib/snippets";

async function ownedSnippet(userId: string, id: string) {
  const row = getDb().prepare("SELECT * FROM snippets WHERE id = ? AND user_id = ?").get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new ApiError(404, "Snippet not found.");
  return row;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await ownedSnippet(user.id, id);
    const body = await readJson<{
      title?: string;
      description?: string;
      language?: string;
      code?: string;
      tags?: unknown;
      isStarred?: boolean;
    }>(req);

    const title = body.title !== undefined ? String(body.title).trim().slice(0, 120) : String(existing.title);
    if (!title) throw new ApiError(400, "Title is required.");
    const description = body.description !== undefined
      ? String(body.description).slice(0, 300)
      : String(existing.description ?? "");
    const code = body.code !== undefined ? String(body.code).slice(0, 120_000) : String(existing.code ?? "");
    if (!code.trim()) throw new ApiError(400, "A snippet needs some code.");
    const language = body.language && body.language.length < 30 ? body.language : String(existing.language);
    const tags = body.tags !== undefined ? normalizeTags(body.tags) : String(existing.tags ?? "[]");
    const starred = body.isStarred !== undefined ? (body.isStarred ? 1 : 0) : Number(existing.is_starred);

    getDb().prepare(
      `UPDATE snippets SET title = ?, description = ?, language = ?, code = ?, tags = ?, is_starred = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(title, description, language, code, typeof tags === "string" ? tags : JSON.stringify(tags), starred, nowIso(), id, user.id);

    const row = getDb().prepare("SELECT * FROM snippets WHERE id = ?").get(id) as Record<string, unknown>;
    return json({ snippet: mapSnippet(row) });
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await ownedSnippet(user.id, id);
    getDb().prepare("DELETE FROM snippets WHERE id = ? AND user_id = ?").run(id, user.id);
    return json({ ok: true });
  });
}
