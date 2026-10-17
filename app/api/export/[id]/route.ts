import { strToU8, zipSync } from "fflate";
import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/api";
import { getProject, listFiles } from "@/lib/data";
import { ApiError } from "@/lib/errors";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = getProject(user.id, id);
    if (!project) throw new ApiError(404, "Project not found.");
    const files = listFiles(user.id, id);
    if (!files.length) throw new ApiError(400, "This project has no files to export yet.");
    const archive: Record<string, Uint8Array> = {};
    for (const file of files) {
      if (file.isDir) continue;
      archive[file.path.replace(/^\/+/, "")] = strToU8(file.content);
    }
    const data = zipSync(archive, { level: 6 });
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    return new Response(Buffer.from(data), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"; filename*=UTF-8''${encodeURIComponent(slug)}.zip`,
        "Cache-Control": "no-store",
      },
    });
  });
}
