import { ApiError } from "./errors";
import { parseTarGz } from "./tar";

export interface RepoFile {
  path: string;
  content: string;
}

export interface ImportedRepo {
  owner: string;
  repo: string;
  branch: string;
  description: string;
  language: string;
  stars: number;
  htmlUrl: string;
  files: RepoFile[];
  totalFound: number;
  skipped: number;
  truncated: boolean;
}

interface CacheEntry {
  at: number;
  data: ImportedRepo;
}

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;
const MAX_FILES = 70;
const MAX_FILE_BYTES = 120_000;
const MAX_TOTAL_BYTES = 2_000_000;

const ALLOWED_EXT = new Set([
  "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "html", "htm", "css", "scss",
  "sass", "less", "json", "md", "mdx", "sql", "sh", "bash", "yml", "yaml",
  "toml", "rs", "go", "c", "h", "cpp", "hpp", "cc", "java", "kt", "php", "rb",
  "swift", "cs", "vue", "svelte", "txt", "xml", "svg", "graphql", "prisma",
]);

const IGNORED = [
  "node_modules/", ".git/", "dist/", "build/", ".next/", "vendor/", "target/",
  "coverage/", "__pycache__/", ".venv/", "venv/", "assets/", "public/fonts/",
  ".github/", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock",
  "poetry.lock", ".min.js", ".min.css", ".map", "LICENSE", "LICENCE",
];

const BASE_NAMES = new Set([
  "readme", "license", "licence", "makefile", "dockerfile", "procfile", "gemfile",
  "rakefile", "changelog", "contributing", "authors", "notice", "todo", "build",
]);

const DOTFILES = new Set([
  ".gitignore", ".gitattributes", ".editorconfig", ".env.example", ".prettierrc",
  ".eslintrc", ".npmrc", ".nvmrc", ".babelrc", ".npmignore", ".dockerignore",
]);

const PRIORITY = [
  "readme.md", "readme", "package.json", "index.html", "index.js", "index.ts",
  "main.py", "app.py", "src/main", "src/index", "app.js", "app.tsx", "main.js",
  "main.ts", "styles.css", "style.css", "tsconfig.json", "dockerfile",
];

function headers(extra?: Record<string, string>) {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "Hanre-Studio",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function parseRepoInput(input: string): { owner: string; repo: string; branch?: string } {
  let value = input.trim();
  value = value.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  value = value.replace(/^git@github\.com:/i, "");
  value = value.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = value.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new ApiError(400, "Enter a repository as owner/repo or paste a GitHub URL.");
  }
  const [owner, repo, marker, ...branchParts] = parts;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) {
    throw new ApiError(400, "That does not look like a valid GitHub repository.");
  }
  const branch = marker === "tree" && branchParts.length ? branchParts.join("/") : undefined;
  return { owner, repo, branch };
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 25000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms), cache: "no-store" });
}

function shouldInclude(path: string, size: number) {
  if (size > MAX_FILE_BYTES || size === 0) return false;
  if (IGNORED.some((fragment) => path.includes(fragment))) return false;
  const lower = path.toLowerCase();
  const base = lower.split("/").pop() ?? "";
  if (BASE_NAMES.has(base) || DOTFILES.has(base)) return true;
  const ext = base.includes(".") ? base.split(".").pop()! : "";
  return ALLOWED_EXT.has(ext);
}

function score(path: string) {
  const lower = path.toLowerCase();
  const depth = path.split("/").length - 1;
  let value = 100 - depth * 4;
  PRIORITY.forEach((needle, index) => {
    if (lower.includes(needle)) value += 60 - index * 2;
  });
  if (lower.startsWith("src/")) value += 10;
  return value;
}

function stripRoot(entries: { path: string; content: string; size: number }[]) {
  const roots = new Map<string, number>();
  for (const entry of entries) {
    const root = entry.path.split("/")[0];
    if (root) roots.set(root, (roots.get(root) ?? 0) + 1);
  }
  let root = "";
  let best = -1;
  roots.forEach((count, name) => {
    if (count > best) {
      best = count;
      root = name;
    }
  });
  return entries
    .filter((entry) => entry.path.startsWith(root + "/"))
    .map((entry) => ({ ...entry, path: entry.path.slice(root.length + 1) }));
}

function looksBinary(content: string) {
  return content.includes("\u0000");
}

async function fetchViaTarball(
  owner: string,
  repo: string,
  branch: string,
): Promise<RepoFile[]> {
  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${encodeURI(branch)}`;
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Hanre-Studio" } });
  if (!response.ok) throw new Error(`tarball ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 30_000_000) throw new Error("repository too large");
  const entries = stripRoot(parseTarGz(buffer));
  const candidates = entries
    .filter((entry) => shouldInclude(entry.path, entry.size) && !looksBinary(entry.content.slice(0, 2000)))
    .sort((a, b) => score(b.path) - score(a.path));
  let total = 0;
  const files: RepoFile[] = [];
  for (const entry of candidates) {
    if (files.length >= MAX_FILES) break;
    if (total + entry.size > MAX_TOTAL_BYTES) break;
    total += entry.size;
    files.push({ path: entry.path, content: entry.content });
  }
  if (!files.length) throw new Error("no readable text files");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fetchViaContents(owner: string, repo: string, branch: string): Promise<RepoFile[]> {
  const listing = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(branch)}`,
    { headers: headers() },
  );
  if (!listing.ok) throw new Error(`contents ${listing.status}`);
  const items = (await listing.json()) as { type: string; path: string; size: number }[];
  const picked = items
    .filter((item) => item.type === "file" && shouldInclude(item.path, item.size))
    .slice(0, 20);
  const files: RepoFile[] = [];
  for (const item of picked) {
    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(item.path)}?ref=${encodeURIComponent(branch)}`,
      { headers: headers({ Accept: "application/vnd.github.raw" }) },
    );
    if (response.ok) files.push({ path: item.path, content: await response.text() });
  }
  if (!files.length) throw new Error("no readable text files");
  return files;
}

export async function loadRepo(input: string, branchOverride?: string): Promise<ImportedRepo> {
  const parsed = parseRepoInput(input);
  const key = `${parsed.owner}/${parsed.repo}`;
  const cached = branchOverride ? undefined : cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const metaResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers: headers() },
  );
  if (metaResponse.status === 404) {
    throw new ApiError(404, "Repository not found, or it is private. Only public repositories can be imported.");
  }
  if (metaResponse.status === 403 || metaResponse.status === 429) {
    throw new ApiError(429, "GitHub rate limit reached. Try again in a few minutes, or configure a GITHUB_TOKEN.");
  }
  if (!metaResponse.ok) {
    throw new ApiError(502, "GitHub could not be reached right now. Try again shortly.");
  }
  const meta = (await metaResponse.json()) as {
    default_branch: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    html_url: string;
    size: number;
  };
  const branch = branchOverride?.trim() || parsed.branch || meta.default_branch || "main";

  let files: RepoFile[] = [];
  let usedFallback = false;
  try {
    files = await fetchViaTarball(parsed.owner, parsed.repo, branch);
  } catch {
    usedFallback = true;
    try {
      files = await fetchViaContents(parsed.owner, parsed.repo, branch);
    } catch {
      throw new ApiError(502, `Could not read files from ${key}@${branch}. The repository may be empty or too large.`);
    }
  }

  const data: ImportedRepo = {
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    description: meta.description ?? "",
    language: meta.language ?? "plaintext",
    stars: meta.stargazers_count ?? 0,
    htmlUrl: meta.html_url,
    files,
    totalFound: files.length,
    skipped: 0,
    truncated: !usedFallback && files.length >= MAX_FILES,
  };
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 25) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return data;
}

export function getCachedRepo(input: string): ImportedRepo | null {
  try {
    const parsed = parseRepoInput(input);
    const cached = cache.get(`${parsed.owner}/${parsed.repo}`);
    return cached && Date.now() - cached.at < CACHE_MS ? cached.data : null;
  } catch {
    return null;
  }
}
