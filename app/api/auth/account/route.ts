import { clearSession, requireUser, verifyPassword } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getDb } from "@/lib/db";

export async function DELETE(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (user.email === "demo@hanre.dev") {
      throw new ApiError(403, "The demo account cannot be deleted. Create your own account to own your workspace.");
    }

    const body = await readJson<{ password?: string }>(req);
    const db = getDb();
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as { password_hash: string } | undefined;

    if (typeof body.password !== "string" || !body.password) {
      throw new ApiError(400, "Enter your password to confirm account deletion.");
    }
    if (!row || !verifyPassword(body.password, row.password_hash)) {
      throw new ApiError(400, "That password is incorrect. Nothing was deleted.");
    }

    await clearSession();
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    return json({ ok: true });
  });
}
