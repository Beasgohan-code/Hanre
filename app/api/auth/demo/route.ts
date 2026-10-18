import { createSession, getUserById, setSessionCookie } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ensureDemoUser } from "@/lib/seed";
import { ApiError } from "@/lib/errors";

export async function POST() {
  return guard(async () => {
    if (process.env.NODE_ENV === "production" && process.env.HANRE_ENABLE_DEMO !== "true") {
      throw new ApiError(404, "The demo account is disabled on this deployment.");
    }
    const userId = ensureDemoUser(getDb());
    const session = createSession(userId);
    await setSessionCookie(session.token);
    return json({ user: getUserById(userId), demo: true });
  });
}
