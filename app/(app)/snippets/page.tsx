import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listSnippets } from "@/lib/data";
import SnippetsView from "@/components/snippets/SnippetsView";

export const metadata: Metadata = { title: "Snippets" };

export default async function SnippetsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const snippets = listSnippets(user.id);
  const params = await searchParams;
  return (
    <SnippetsView
      initialSnippets={snippets}
      initialNew={params.new === "1"}
      initialEditId={params.edit}
    />
  );
}
