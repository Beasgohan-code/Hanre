import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listProjects, workspaceCounts } from "@/lib/data";
import StudioShell from "@/components/studio/StudioShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const projects = listProjects(user.id);
  const counts = workspaceCounts(user.id);

  return (
    <StudioShell user={user} projects={projects} counts={counts}>
      {children}
    </StudioShell>
  );
}
