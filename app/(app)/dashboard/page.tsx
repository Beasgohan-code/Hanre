import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import DashboardView from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = getDashboardData(user.id);
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return <DashboardView data={data} userName={user.name} todayLabel={todayLabel} />;
}
