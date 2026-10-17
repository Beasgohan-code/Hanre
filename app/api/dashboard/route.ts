import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json(getDashboardData(user.id));
  });
}
