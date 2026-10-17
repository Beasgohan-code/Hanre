import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listFiles, listProjects, listRuns, listSnippets, listTasks } from "@/lib/data";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    const projects = listProjects(user.id, true);
    const files = projects.flatMap((project) => listFiles(user.id, project.id));
    const backup = {
      app: "Hanre Studio",
      version: 1,
      exportedAt: new Date().toISOString(),
      user: { name: user.name, email: user.email, createdAt: user.createdAt, prefs: user.prefs },
      projects,
      files,
      snippets: listSnippets(user.id),
      tasks: listTasks(user.id),
      runs: listRuns(user.id, 500),
    };
    const db = getDb();
    db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get();
    const filename = `hanre-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
