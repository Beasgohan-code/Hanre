"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Eye, FileCode2, Github } from "lucide-react";
import type { Project, ProjectFile } from "@/lib/types";
import { LANGUAGE_COLORS, LANGUAGES } from "@/lib/types";
import { buildPreview } from "@/lib/preview";

function metaFor(language: string) {
  return LANGUAGES.find((entry) => entry.value === language);
}

export default function PublicShare({
  project,
  files,
  initialViews,
}: {
  project: Project;
  files: ProjectFile[];
  initialViews: number;
}) {
  const preview = useMemo(() => buildPreview(files), [files]);
  const startFile =
    files.find((file) => /(^|\/)index\.html$/i.test(file.path)) ??
    files.find((file) => file.language === "markdown") ??
    files[0] ??
    null;
  const [activeId, setActiveId] = useState(startFile?.id ?? null);
  const [tab, setTab] = useState<"preview" | "code">(preview ? "preview" : "code");
  const [copied, setCopied] = useState(false);

  const active = files.find((file) => file.id === activeId) ?? startFile;
  const language = active?.language ?? project.language;
  const meta = metaFor(language);
  const lines = (active?.content ?? "").split("\n").slice(0, 1600);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share-page">
      <header className="share-head">
        <Link className="share-brand" href="/">
          <span className="share-brand__mark" aria-hidden>
            <FileCode2 size={14} />
          </span>
          <span>
            <strong>Hanre</strong>
            <small>Studio</small>
          </span>
        </Link>
        <span className="badge">Shared project</span>
        <div className="share-head__spacer" />
        <button type="button" className="btn btn--sm" onClick={copyShare}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <Link className="btn btn--primary btn--sm" href="/register">
          Build your own <ExternalLink size={12} />
        </Link>
      </header>

      <main className="share-main">
        <section className="share-hero">
          <div className="share-hero__text">
            <span className="eyebrow">Published workspace</span>
            <h1>{project.name}</h1>
            <p>{project.description || "A project published from Hanre Studio."}</p>
          </div>
          <div className="share-hero__meta">
            <span className="badge" style={{ borderColor: `${LANGUAGE_COLORS[language] ?? "#8b7bff"}55` }}>
              <span className="project-dot" style={{ background: LANGUAGE_COLORS[language] ?? "#8b7bff" }} />
              {meta?.label ?? language}
            </span>
            <span className="badge"><FileCode2 size={10} /> {files.length} files</span>
            <span className="badge"><Eye size={10} /> {initialViews.toLocaleString()} views</span>
          </div>
        </section>

        <div className="share-workbench">
          <aside className="share-files">
            <span className="share-files__label">Files</span>
            <div className="share-files__list">
              {files.map((file) => {
                const fileMeta = metaFor(file.language);
                return (
                  <button
                    key={file.id}
                    type="button"
                    className="share-file"
                    data-active={file.id === active?.id}
                    onClick={() => {
                      setActiveId(file.id);
                      setTab("code");
                    }}
                    title={file.path}
                  >
                    <span className="share-file__dot" style={{ background: fileMeta?.color ?? "#8b7bff" }} />
                    <span className="share-file__name">{file.name}</span>
                    <span className="share-file__path">{file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : ""}</span>
                  </button>
                );
              })}
            </div>
            <div className="share-files__foot">
              <Github size={12} /> Read-only snapshot published from Hanre
            </div>
          </aside>

          <section className="share-panel">
            <div className="share-panel__bar">
              <div className="share-tabs" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "preview"}
                  data-active={tab === "preview"}
                  disabled={!preview}
                  title={preview ? "Rendered preview" : "This project has no previewable entry file"}
                  onClick={() => setTab("preview")}
                >
                  <Eye size={13} /> Preview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "code"}
                  data-active={tab === "code"}
                  onClick={() => setTab("code")}
                >
                  <FileCode2 size={13} /> Code
                </button>
              </div>
              <span className="share-panel__file mono">{active?.path ?? "No files"}</span>
            </div>

            {tab === "preview" && preview ? (
              <div className="share-preview">
                <iframe
                  title={`${project.name} preview`}
                  srcDoc={preview.html}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              </div>
            ) : (
              <div className="share-code">
                <div className="share-code__gutter" aria-hidden>
                  {lines.map((_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
                <pre className="share-code__pre">
                  <code>{lines.join("\n")}</code>
                </pre>
              </div>
            )}
          </section>
        </div>

        <footer className="share-foot">
          <p>
            <strong>Made with Hanre Studio</strong> — an in-browser code editor with a terminal,
            file versions, and one-click shares.
          </p>
          <span className="muted-sm">
            The owner can revoke this link at any time. Files are read-only here.
          </span>
        </footer>
      </main>
    </div>
  );
}
