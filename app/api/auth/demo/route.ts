import { createSession, getUserById, setSessionCookie } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ensureDemoUser } from "@/lib/seed";

export async function POST() {
  return guard(async () => {
    const userId = ensureDemoUser(getDb());
    const session = createSession(userId);
    await setSessionCookie(session.token);
    return json({ user: getUserById(userId), demo: true });
  });
}
