import { rateLimit, requireUser } from "@/lib/auth";
import { guard, json, readJson, str } from "@/lib/api";
import { getDb, logActivity } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

const API = "https://api.github.com";
const MAX_FILES = 70;
const MAX_BYTES = 2_000_000;

type GitHubError = { message?: string; documentation_url?: string };
type RepoInfo = { full_name: string; html_url: string; default_branch: string; owner: { login: string } };

async function github<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Hanre-Studio",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(502, "Could not reach GitHub. Check your connection and try again.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as GitHubError;
      detail = body.message ?? "";
    } catch {}
    if (response.status === 401) throw new ApiError(401, "GitHub rejected this token. Check that it is valid and has repository Contents write access.");
    if (response.status === 403) throw new ApiError(403, "GitHub denied this action. Check the token's repository permissions and rate limit.");
    if (response.status === 404) throw new ApiError(404, "Repository or branch not found. Check the name and token access.");
    if (response.status === 409) throw new ApiError(409, "GitHub could not update this branch because its history changed. Retry the push.");
    if (response.status === 422) throw new ApiError(422, detail || "GitHub could not accept this request. Check the repository, branch, or commit message.");
    throw new ApiError(502, `GitHub returned ${response.status}. Try again shortly.`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function refPath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function safePath(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(400, "Project has an invalid file path.");
  const path = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!path || path.length > 180 || path.split("/").some((part) => !part || part === "." || part === "..") || /[\u0000-\u001f]/.test(path)) {
    throw new ApiError(400, `Unsafe file path: ${value.slice(0, 80)}`);
  }
  return path;
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    rateLimit(`github-push:${user.id}`, 8, 60_000);
    const body = await readJson<{
      projectId?: string;
      token?: string;
      owner?: string;
      repo?: string;
      branch?: string;
      commitMessage?: string;
      createIfMissing?: boolean;
      makePrivate?: boolean;
      openPullRequest?: boolean;
    }>(req);
    const projectId = str(body.projectId, "Project", { min: 1, max: 80 });
    const token = str(body.token, "GitHub token", { min: 10, max: 500 });
    const owner = str(body.owner, "GitHub owner", { min: 1, max: 100 });
    const repo = str(body.repo, "Repository name", { min: 1, max: 100 });
    const branchInput = str(body.branch, "Branch", { min: 1, max: 100 });
    const commitMessage = str(body.commitMessage ?? "Sync from Hanre Studio", "Commit message", { min: 1, max: 180 });
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      throw new ApiError(400, "Owner and repository may only contain letters, numbers, dots, hyphens, and underscores.");
    }
    if (branchInput.length > 100 || !/^[A-Za-z0-9._/-]+$/.test(branchInput) || branchInput.startsWith("-") || branchInput.includes("..") || branchInput.includes("//") || branchInput.includes("@{") || branchInput.endsWith("/") || branchInput.endsWith(".") || branchInput.toLowerCase().endsWith(".lock") || branchInput.split("/").some((part) => part.startsWith("."))) {
      throw new ApiError(400, "Branch name contains unsupported characters.");
    }

    const db = getDb();
    const project = db.prepare("SELECT name FROM projects WHERE id = ? AND user_id = ?").get(projectId, user.id) as { name: string } | undefined;
    if (!project) throw new ApiError(404, "Project not found.");
    const rows = db.prepare("SELECT path, content FROM files WHERE project_id = ? AND user_id = ? AND is_dir = 0 ORDER BY path").all(projectId, user.id) as { path: string; content: string }[];
    if (!rows.length) throw new ApiError(400, "Add at least one file before pushing this project.");
    if (rows.length > MAX_FILES) throw new ApiError(400, `Push up to ${MAX_FILES} files at a time.`);

    const paths = new Set<string>();
    let totalBytes = 0;
    const entries = rows.map((file) => {
      const path = safePath(file.path);
      if (paths.has(path)) throw new ApiError(400, `Duplicate project file path: ${path}`);
      paths.add(path);
      const content = String(file.content ?? "");
      totalBytes += Buffer.byteLength(content, "utf8");
      return { path, mode: "100644", type: "blob", content };
    });
    if (totalBytes > MAX_BYTES) throw new ApiError(413, "This project exceeds the 2 MB GitHub sync limit. Remove large files and retry.");

    let repoInfo: RepoInfo;
    let createdRepository = false;
    try {
      repoInfo = await github<RepoInfo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404 || !body.createIfMissing) throw error;
      const identity = await github<{ login: string }>("/user", token);
      if (identity.login.toLowerCase() !== owner.toLowerCase()) {
        throw new ApiError(400, `This token belongs to @${identity.login}. Use that account as the repository owner, or create the repository on GitHub first.`);
      }
      repoInfo = await github<RepoInfo>("/user/repos", token, {
        method: "POST",
        body: JSON.stringify({ name: repo, private: body.makePrivate !== false, auto_init: true, description: `Created from Hanre Studio · ${project.name}`.slice(0, 350) }),
      });
      createdRepository = true;
    }

    const slug = repoInfo.full_name.split("/");
    const repoPath = `/repos/${encodeURIComponent(slug[0])}/${encodeURIComponent(slug[1])}`;
    const defaultBranch = repoInfo.default_branch || "main";
    const branch = branchInput || defaultBranch;
    const defaultRef = await github<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/${refPath(defaultBranch)}`, token);
    let currentRef: { object: { sha: string } };
    try {
      currentRef = await github(`${repoPath}/git/ref/heads/${refPath(branch)}`, token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      await github(`${repoPath}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: defaultRef.object.sha }),
      });
      currentRef = { object: { sha: defaultRef.object.sha } };
    }

    const parent = await github<{ sha: string; tree: { sha: string } }>(`${repoPath}/git/commits/${currentRef.object.sha}`, token);
    const tree = await github<{ sha: string }>(`${repoPath}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
    });
    const commit = await github<{ sha: string; html_url: string }>(`${repoPath}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({ message: commitMessage, tree: tree.sha, parents: [parent.sha] }),
    });
    await github(`${repoPath}/git/refs/heads/${refPath(branch)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    let pullRequestUrl: string | null = null;
    let pullRequestNote: string | null = null;
    if (body.openPullRequest && branch !== defaultBranch) {
      try {
        const pr = await github<{ html_url: string }>(`${repoPath}/pulls`, token, {
          method: "POST",
          body: JSON.stringify({ title: `Sync ${project.name} from Hanre Studio`, head: branch, base: defaultBranch, body: `Updated from Hanre Studio.\n\nCommit: ${commit.sha.slice(0, 7)}` }),
        });
        pullRequestUrl = pr.html_url;
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) pullRequestNote = "A pull request may already exist for this branch, or GitHub requires more changes before opening one.";
        else throw error;
      }
    }

    logActivity(user.id, "project", `Pushed ${project.name} to GitHub · ${repoInfo.full_name}:${branch}`, projectId);
    return json({
      repositoryUrl: repoInfo.html_url,
      branch,
      defaultBranch,
      commitUrl: commit.html_url,
      pullRequestUrl,
      pullRequestNote,
      filesPushed: entries.length,
      createdRepository,
    });
  });
}
