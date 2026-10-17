import { createSession, createUser, setSessionCookie, validateEmail } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getDb, logActivity } from "@/lib/db";
import { seedStarterContent } from "@/lib/seed";

export async function POST(req: Request) {
  return guard(async () => {
    const body = await readJson<{ name?: string; email?: string; password?: string }>(req);
    const name = str(body.name, "Name", { min: 2, max: 80 });
    const email = str(body.email, "Email", { min: 3, max: 200 });
    const password = typeof body.password === "string" ? body.password : "";
    if (!validateEmail(email)) throw new ApiError(400, "Enter a valid email address.");
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    if (password.length > 200) throw new ApiError(400, "That password is too long.");

    const user = createUser({ name, email, password });
    try {
      seedStarterContent(getDb(), user.id);
    } catch (error) {
      console.error("[hanre] starter content failed", error);
    }
    logActivity(user.id, "account", "Created your Hanre workspace");
    const session = createSession(user.id);
    await setSessionCookie(session.token);
    return json({ user });
  });
}
