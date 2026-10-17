import { createSession, normalizeEmail, rateLimit, setSessionCookie, verifyPassword } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    rateLimit(`${ip}:${email}`, 10, 10 * 60 * 1000);
    if (!email || !password) throw new ApiError(400, "Enter your email and password.");

    const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | { id: string; password_hash: string; name: string; avatar_color: string; prefs: string; created_at: string; email: string }
      | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new ApiError(401, "Email or password is incorrect.");
    }

    const session = createSession(row.id);
    await setSessionCookie(session.token);
    return json({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        avatarColor: row.avatar_color,
        prefs: JSON.parse(row.prefs || "{}"),
        createdAt: row.created_at,
      },
    });
  });
}
