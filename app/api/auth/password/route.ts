import { changePassword, clearSession, requireUser } from "@/lib/auth";
import { guard, json, readJson } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { logActivity } from "@/lib/db";

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      throw new ApiError(400, "Enter your current and new password.");
    }
    changePassword(user.id, body.currentPassword, body.newPassword);
    logActivity(user.id, "account", "Changed account password");
    await clearSession();
    return json({ ok: true, reauth: true });
  });
}
