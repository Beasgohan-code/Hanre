import { requireUser } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { getDb, logActivity, nowIso, uid } from "@/lib/db";
import { listSnippets, mapSnippet } from "@/lib/data";
import { ApiError } from "@/lib/errors";
import { normalizeTags } from "@/lib/snippets";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json({ snippets: listSnippets(user.id) });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      title?: string;
      description?: string;
      language?: string;
      code?: string;
      tags?: unknown;
      isStarred?: boolean;
    }>(req);
    const title = str(body.title, "Title", { min: 2, max: 120 });
    const description = str(body.description, "Description", { max: 300, optional: true });
    const code = typeof body.code === "string" ? body.code.slice(0, 120_000) : "";
    if (!code.trim()) throw new ApiError(400, "Add some code before saving the snippet.");
    const language = typeof body.language === "string" && body.language.length < 30 ? body.language : "javascript";
    const id = uid();
    const timestamp = nowIso();
    getDb().prepare(
      `INSERT INTO snippets (id, user_id, title, description, language, code, tags, is_starred, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, user.id, title, description, language, code, JSON.stringify(normalizeTags(body.tags)), body.isStarred ? 1 : 0, timestamp, timestamp);
    logActivity(user.id, "snippet", `Saved snippet “${title}”`);
    const row = getDb().prepare("SELECT * FROM snippets WHERE id = ?").get(id) as Record<string, unknown>;
    return json({ snippet: mapSnippet(row) }, 201);
  });
}
