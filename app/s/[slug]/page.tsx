import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { listFiles, mapProject } from "@/lib/data";
import { bumpShareViews, getShareBySlug } from "@/lib/shares";
import PublicShare from "@/components/public/PublicShare";

export const dynamic = "force-dynamic";

function loadSharedProject(slug: string) {
  const share = getShareBySlug(slug);
  if (!share) return null;
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(share.projectId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return { share, project: mapProject(row) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = loadSharedProject(slug);
  if (!data) return { title: "Shared project not found" };
  return {
    title: `${data.project.name} · Shared on Hanre`,
    description: data.project.description || "A read-only project shared from Hanre Studio.",
  };
}

export default async function SharedProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = loadSharedProject(slug);
  if (!data) notFound();
  const files = listFiles(data.project.userId, data.project.id);
  bumpShareViews(data.share.id);
  return <PublicShare project={data.project} files={files} initialViews={data.share.views + 1} />;
}
