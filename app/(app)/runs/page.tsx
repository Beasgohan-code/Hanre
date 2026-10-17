import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { countRuns, listRuns, runStats } from "@/lib/data";
import RunsView from "@/components/runs/RunsView";

export const metadata: Metadata = { title: "Run history" };

export default async function RunsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const runs = listRuns(user.id, 25, 0);
  const total = countRuns(user.id);
  const stats = runStats(user.id);
  return <RunsView initialRuns={runs} initialTotal={total} initialStats={stats} />;
}
