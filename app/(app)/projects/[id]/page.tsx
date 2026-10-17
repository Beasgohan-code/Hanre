import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getProject, listFiles } from "@/lib/data";
import Workbench from "@/components/workbench/Workbench";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "Editor" };
  const { id } = await params;
  const project = getProject(user.id, id);
  return { title: project ? `${project.name} · Editor` : "Editor" };
}

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) notFound();
  const files = listFiles(user.id, id);
  const query = await searchParams;
  return <Workbench initialProject={project} initialFiles={files} initialFileId={query.file} />;
}
