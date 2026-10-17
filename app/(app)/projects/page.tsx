import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listProjects } from "@/lib/data";
import ProjectsView from "@/components/projects/ProjectsView";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = listProjects(user.id, true);
  const params = await searchParams;
  return <ProjectsView initialProjects={projects} initialNew={params.new === "1"} />;
}
