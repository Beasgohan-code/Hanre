"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CheckCheck, DownloadCloud, FileCode2, Github, Info, Loader2, Lock,
  Search, Star, TriangleAlert,
} from "lucide-react";
import { api, errorMessage, formatBytes } from "@/lib/client";
import { useToast } from "@/components/studio/providers";

interface RepoInfo {
  owner: string;
  name: string;
  branch: string;
  description: string;
  language: string;
  stars: number;
  url: string;
}

interface RepoData {
  repo: RepoInfo;
  files: { path: string; size: number }[];
  truncated: boolean;
}

const EXAMPLES = [
  { repo: "octocat/Hello-World", note: "The classic first repository" },
  { repo: "codemirror/dev", note: "The editor that powers Hanre" },
  { repo: "sindresorhus/slugify", note: "A small, readable utility package" },
];

export default function ImportView() {
  const router = useRouter();
  const { toast } = useToast();
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<RepoData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function inspect(target?: string) {
    const value = (target ?? repo).trim();
    if (!value) {
      setError("Paste a GitHub repository URL or owner/repo.");
      return;
    }
    setRepo(value);
    setInspecting(true);
    setError("");
    setData(null);
    setSelected(new Set());
    try {
      const result = await api<RepoData>(
        `/api/github?repo=${encodeURIComponent(value)}${branch.trim() ? `&branch=${encodeURIComponent(branch.trim())}` : ""}`,
      );
      setData(result);
      setSelected(new Set(result.files.map((file) => file.path)));
      if (!result.files.length) setError("No readable text files were found in that repository.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setInspecting(false);
    }
  }

  async function importRepo() {
    if (!data || importing) return;
    if (!selected.size) {
      setError("Select at least one file to import.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const result = await api<{ project: { id: string; name: string }; imported: number }>(
        "/api/github/import",
        {
          method: "POST",
          body: JSON.stringify({
            repo: `${data.repo.owner}/${data.repo.name}`,
            branch: data.repo.branch,
            paths: [...selected],
          }),
        },
      );
      toast(`${result.imported} files copied into “${result.project.name}”.`, {
        tone: "success",
        title: "Repository imported",
      });
      router.push(`/projects/${result.project.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setImporting(false);
    }
  }

  function toggle(path: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const allSelected = Boolean(data) && selected.size === data!.files.length;
  const selectedSize = data
    ? data.files.filter((file) => selected.has(file.path)).reduce((sum, file) => sum + file.size, 0)
    : 0;
  const totalSize = data ? data.files.reduce((sum, file) => sum + file.size, 0) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Concierge</div>
          <h1 className="page-title">Import from GitHub</h1>
          <p className="page-sub">
            Bring a public repository into a fresh Hanre project. Read real code, run what runs,
            and learn by changing things.
          </p>
        </div>
      </div>

      <div className="import-grid">
        <div className="stack gap-16">
          <div className="card import-card">
            <div className="settings-card__head">
              <h2>Find a repository</h2>
              <p>Public repositories only. Paste a URL or use owner/repo.</p>
            </div>

            <div className="import-input">
              <input
                className="input"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void inspect();
                }}
                placeholder="https://github.com/owner/repository"
                aria-label="GitHub repository"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => inspect()}
                disabled={inspecting}
              >
                {inspecting ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                {inspecting ? "Reading…" : "Inspect"}
              </button>
            </div>

            <div className="input-row" style={{ marginTop: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="import-branch">
                  Branch <span className="field__hint">optional — defaults to the repository default</span>
                </label>
                <input
                  id="import-branch"
                  className="input"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder="main"
                  spellCheck={false}
                />
              </div>
            </div>

            <p className="import-hint">
              Hanre reads the repository as a tarball, keeps the readable text files, and skips
              binaries, lockfiles, and build output. The original repository is never modified.
            </p>

            {error && (
              <div className="auth-error" style={{ marginTop: 14 }} role="alert">
                <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            {inspecting && (
              <div
                className="row gap-10"
                style={{
                  marginTop: 18,
                  padding: "20px 16px",
                  border: "1px dashed var(--border-strong)",
                  borderRadius: 12,
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                <Loader2 size={16} className="spin" style={{ color: "var(--accent-2)" }} />
                <div>
                  <strong style={{ display: "block", color: "var(--text-2)", fontSize: 12.5 }}>
                    Reading the repository…
                  </strong>
                  <span>Downloading the tarball, de-duplicating, and picking readable files.</span>
                </div>
              </div>
            )}

            {data && !inspecting && (
              <>
                <div className="repo-preview">
                  <div className="repo-preview__head">
                    <span
                      className="project-icon"
                      style={{ "--tone": "#c4b5fd" } as React.CSSProperties}
                    >
                      GH
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3>
                        {data.repo.owner}/{data.repo.name}
                        <span className="badge badge--accent">branch: {data.repo.branch}</span>
                      </h3>
                      <p>{data.repo.description || "No description provided."}</p>
                      <div className="repo-meta">
                        <span><Star size={10} /> {data.repo.stars.toLocaleString()} stars</span>
                        {data.repo.language && <span><span className="dot" /> {data.repo.language}</span>}
                        <span><FileCode2 size={10} /> {data.files.length} readable files</span>
                        <span>{formatBytes(totalSize)}</span>
                        {data.truncated && <span style={{ color: "var(--amber)" }}>truncated to 70 files</span>}
                      </div>
                    </div>
                  </div>

                  <div className="file-pick">
                    {data.files.map((file) => (
                      <label className="file-pick__row" key={file.path}>
                        <input
                          type="checkbox"
                          checked={selected.has(file.path)}
                          onChange={() => toggle(file.path)}
                        />
                        <FileCode2 size={12} style={{ color: "var(--faint)", flex: "none" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{file.path}</span>
                        <span className="file-pick__size">{formatBytes(file.size)}</span>
                      </label>
                    ))}
                    {!data.files.length && (
                      <div style={{ padding: 18, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                        No readable text files were found.
                      </div>
                    )}
                  </div>

                  <div className="file-pick__bar">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(data.files.map((file) => file.path)),
                        )
                      }
                    >
                      <CheckCheck size={12} /> {allSelected ? "Clear selection" : "Select all"}
                    </button>
                    <span>
                      {selected.size} of {data.files.length} selected · {formatBytes(selectedSize)}
                    </span>
                  </div>
                </div>

                <div className="row" style={{ justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setData(null)}>
                    Start over
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={importRepo}
                    disabled={importing || selected.size === 0}
                  >
                    {importing ? <Loader2 size={14} className="spin" /> : <DownloadCloud size={14} />}
                    {importing
                      ? "Copying files…"
                      : `Import ${selected.size} file${selected.size === 1 ? "" : "s"}`}
                    {!importing && <ArrowRight size={13} />}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card import-card">
            <div className="settings-card__head">
              <h2>How it works</h2>
              <p>Three steps, a few seconds, and a full workspace on the other side.</p>
            </div>
            <div className="stack gap-12">
              {[
                ["Inspect", "We read the repository metadata and download a single archive."],
                ["Pick files", "Only readable text files are offered — up to 70 files or 2 MB."],
                ["Import", "A new project appears with every file ready to edit and run."],
              ].map(([title, text], index) => (
                <div className="row gap-12" key={title}>
                  <span
                    className="badge badge--accent"
                    style={{ width: 22, height: 22, justifyContent: "center", borderRadius: 7, padding: 0, flex: "none" }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <strong style={{ fontSize: 12.5 }}>{title}</strong>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack gap-16">
          <div className="card import-card">
            <div className="settings-card__head">
              <h2>Try an example</h2>
              <p>Small repositories that open quickly.</p>
            </div>
            <div className="example-repos">
              {EXAMPLES.map((example) => (
                <button
                  key={example.repo}
                  type="button"
                  className="example-repo"
                  onClick={() => void inspect(example.repo)}
                  disabled={inspecting}
                >
                  <Github size={14} />
                  <span>
                    <span style={{ display: "block", fontWeight: 550 }}>{example.repo}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--faint)" }}>{example.note}</span>
                  </span>
                  <code>→</code>
                </button>
              ))}
            </div>
          </div>

          <div className="import-note">
            <Info size={15} />
            <span>
              <strong style={{ color: "var(--text-2)" }}>Limits & privacy.</strong> Only public
              repositories can be read. Files are copied into your Hanre workspace — the source
              repository is untouched. Binaries, lockfiles, and anything over 120 KB are skipped.
            </span>
          </div>

          <div className="import-note">
            <Lock size={15} />
            <span>
              <strong style={{ color: "var(--text-2)" }}>Rate limits.</strong> GitHub allows a small
              number of anonymous requests per hour. If you see a limit error, wait a few minutes or
              set <span className="mono">GITHUB_TOKEN</span> on the server for a higher ceiling.
            </span>
          </div>

          <div className="card import-card">
            <div className="settings-card__head">
              <h2>Prefer a blank page?</h2>
              <p>Start from one of six templates instead.</p>
            </div>
            <a className="btn btn--soft btn--block" href="/projects?new=1">
              <FileCode2 size={14} /> Create a project
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
