import { requireUser, updateProfile } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import type { UserPrefs } from "@/lib/types";
import { ApiError } from "@/lib/errors";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json({ user });
  });
}

export async function PATCH(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = await readJson<{
      name?: string;
      email?: string;
      avatarColor?: string;
      prefs?: UserPrefs;
    }>(req);
    const patch: {
      name?: string;
      email?: string;
      avatarColor?: string;
      prefs?: UserPrefs;
    } = {};
    if (body.name !== undefined) patch.name = str(body.name, "Name", { min: 2, max: 80 });
    if (body.email !== undefined) {
      const nextEmail = str(body.email, "Email", { min: 3, max: 200 }).toLowerCase();
      if (user.email === "demo@hanre.dev" && nextEmail !== user.email) {
        throw new ApiError(403, "The demo account's email is fixed. Create your own account to use a different address.");
      }
      patch.email = nextEmail;
    }
    if (body.avatarColor !== undefined) {
      patch.avatarColor = /^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor))
        ? String(body.avatarColor)
        : user.avatarColor;
    }
    if (body.prefs !== undefined && typeof body.prefs === "object" && body.prefs !== null) {
      patch.prefs = body.prefs;
    }
    const updated = updateProfile(user.id, patch);
    return json({ user: updated });
  });
}
