import { requireUser } from "@/lib/auth";
import { guard, json, oneOf, readJson } from "@/lib/api";
import { getDb, nowIso, uid } from "@/lib/db";
import { countRuns, listRuns, runStats } from "@/lib/data";
import { ApiError } from "@/lib/errors";

const STATUSES = ["success", "error", "unsupported"] as const;

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit") ?? 25), 1), 100);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);
    const status = params.get("status") ?? "all";
    return json({
      runs: listRuns(user.id, limit, offset, status),
      total: countRuns(user.id, status),
      stats: runStats(user.id),
    });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      projectId?: string | null;
      fileId?: string | null;
      command?: string;
      language?: string;
      status?: string;
      output?: string;
      durationMs?: number;
    }>(req);
    const db = getDb();
    let projectId: string | null = null;
    if (body.projectId) {
      const row = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(String(body.projectId), user.id);
      projectId = row ? String(body.projectId) : null;
    }
    let fileId: string | null = null;
    if (body.fileId) {
      const row = db.prepare("SELECT id FROM files WHERE id = ? AND user_id = ?").get(String(body.fileId), user.id);
      fileId = row ? String(body.fileId) : null;
    }
    const status = oneOf(body.status, STATUSES, "success");
    const command = String(body.command ?? "").slice(0, 200);
    const language = String(body.language ?? "javascript").slice(0, 30);
    const output = String(body.output ?? "").slice(0, 20_000);
    const durationMs = Math.min(Math.max(Math.round(Number(body.durationMs ?? 0)) || 0, 0), 600_000);
    if (!command && !language) throw new ApiError(400, "A run needs a command or language.");
    const id = uid();
    db.prepare(
      `INSERT INTO runs (id, user_id, project_id, file_id, command, language, status, output, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, user.id, projectId, fileId, command, language, status, output, durationMs, nowIso());
    const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown>;
    return json(
      {
        run: {
          id,
          userId: user.id,
          projectId,
          fileId,
          command,
          language,
          status,
          output,
          durationMs,
          createdAt: String(row.created_at),
        },
      },
      201,
    );
  });
}

export async function DELETE() {
  return guard(async () => {
    const user = await requireUser();
    getDb().prepare("DELETE FROM runs WHERE user_id = ?").run(user.id);
    return json({ ok: true });
  });
}
