import { clearSession } from "@/lib/auth";
import { guard, json } from "@/lib/api";

export async function POST() {
  return guard(async () => {
    await clearSession();
    return json({ ok: true });
  });
}
