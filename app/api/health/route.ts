import { json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return json({ status: "ok", service: "hanre-studio", database: "ok" });
  } catch {
    return json({ status: "error", service: "hanre-studio", database: "unavailable" }, 503);
  }
}
