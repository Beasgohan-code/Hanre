import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { loadRepo } from "@/lib/github";
import { ApiError } from "@/lib/errors";

export async function GET(req: Request) {
  return guard(async () => {
    await requireUser();
    const params = new URL(req.url).searchParams;
    const repo = params.get("repo") ?? "";
    if (!repo.trim()) throw new ApiError(400, "Enter a GitHub repository to inspect.");
    const branch = params.get("branch") ?? undefined;
    const data = await loadRepo(repo, branch);
    return json({
      repo: { owner: data.owner, name: data.repo, branch: data.branch, description: data.description, language: data.language, stars: data.stars, url: data.htmlUrl },
      files: data.files.map((file) => ({ path: file.path, size: file.content.length })),
      truncated: data.truncated,
    });
  });
}
