import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listProjects, listTasks } from "@/lib/data";
import TasksView from "@/components/tasks/TasksView";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const tasks = listTasks(user.id);
  const projects = listProjects(user.id);
  const params = await searchParams;
  return <TasksView initialTasks={tasks} projects={projects} initialTaskId={params.task} />;
}
