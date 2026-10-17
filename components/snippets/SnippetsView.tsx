"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Braces, Check, Code2, Copy, Pencil, Plus, Search, Sparkles, Star, Trash2, X,
} from "lucide-react";
import type { Snippet } from "@/lib/types";
import { LANGUAGES, LANGUAGE_COLORS } from "@/lib/types";
import { api, copyText, errorMessage, relativeTime } from "@/lib/client";
import { ConfirmDialog, EmptyState, Modal, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";

const LANGUAGE_OPTIONS = LANGUAGES.filter((entry) => entry.value !== "plaintext");

export default function SnippetsView({
  initialSnippets,
  initialNew = false,
  initialEditId,
}: {
  initialSnippets: Snippet[];
  initialNew?: boolean;
  initialEditId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initialEditing = initialSnippets.find((snippet) => snippet.id === initialEditId) ?? null;

  const [snippets, setSnippets] = useState(initialSnippets);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(Boolean(initialNew) || Boolean(initialEditing));
  const [editing, setEditing] = useState<Snippet | null>(initialEditing);

  const [title, setTitle] = useState(initialEditing?.title ?? "");
  const [description, setDescription] = useState(initialEditing?.description ?? "");
  const [codeLanguage, setCodeLanguage] = useState(initialEditing?.language ?? "javascript");
  const [code, setCode] = useState(initialEditing?.code ?? "");
  const [tags, setTags] = useState(initialEditing?.tags.join(", ") ?? "");
  const [starred, setStarred] = useState(initialEditing?.isStarred ?? false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [starBusy, setStarBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialNew || initialEditId) router.replace("/snippets");
  }, [initialNew, initialEditId, router]);

  const languages = useMemo(
    () => [...new Set(snippets.map((snippet) => snippet.language))].sort(),
    [snippets],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snippets
      .filter((snippet) => !starredOnly || snippet.isStarred)
      .filter((snippet) => language === "all" || snippet.language === language)
      .filter((snippet) =>
        !needle ||
        snippet.title.toLowerCase().includes(needle) ||
        snippet.description.toLowerCase().includes(needle) ||
        snippet.tags.some((tag) => tag.includes(needle)) ||
        snippet.code.toLowerCase().includes(needle),
      );
  }, [snippets, query, language, starredOnly]);

  function resetForm(snippet: Snippet | null) {
    setEditing(snippet);
    setTitle(snippet?.title ?? "");
    setDescription(snippet?.description ?? "");
    setCodeLanguage(snippet?.language ?? "javascript");
    setCode(snippet?.code ?? "");
    setTags(snippet?.tags.join(", ") ?? "");
    setStarred(snippet?.isStarred ?? false);
    setFormError("");
    setModalOpen(true);
  }

  async function saveSnippet() {
    if (pending) return;
    if (title.trim().length < 2) {
      setFormError("Give your snippet a title with at least 2 characters.");
      return;
    }
    if (!code.trim()) {
      setFormError("Add some code before saving.");
      return;
    }
    setFormError("");
    setPending(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      language: codeLanguage,
      code,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      isStarred: starred,
    };
    try {
      if (editing) {
        const data = await api<{ snippet: Snippet }>(`/api/snippets/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSnippets((current) => current.map((snippet) => (snippet.id === editing.id ? data.snippet : snippet)));
        toast("Snippet updated.", { tone: "success" });
      } else {
        const data = await api<{ snippet: Snippet }>("/api/snippets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSnippets((current) => [data.snippet, ...current]);
        toast("Saved to your snippet shelf.", { tone: "success", title: "Snippet created" });
      }
      setModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function toggleStar(snippet: Snippet) {
    if (starBusy.has(snippet.id)) return;
    const next = !snippet.isStarred;
    setStarBusy((current) => new Set(current).add(snippet.id));
    setSnippets((current) =>
      current.map((entry) => (entry.id === snippet.id ? { ...entry, isStarred: next } : entry)),
    );
    try {
      await api(`/api/snippets/${snippet.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isStarred: next }),
      });
    } catch (error) {
      setSnippets((current) =>
        current.map((entry) => (entry.id === snippet.id ? { ...entry, isStarred: snippet.isStarred } : entry)),
      );
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setStarBusy((current) => {
        const nextSet = new Set(current);
        nextSet.delete(snippet.id);
        return nextSet;
      });
    }
  }

  async function copySnippet(snippet: Snippet) {
    try {
      await copyText(snippet.code);
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 1600);
      toast("Code copied to clipboard.", { tone: "success" });
    } catch {
      toast("Could not access the clipboard.", { tone: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    const previous = snippets;
    setDeletePending(true);
    setSnippets((current) => current.filter((snippet) => snippet.id !== target.id));
    setDeleteTarget(null);
    try {
      await api(`/api/snippets/${target.id}`, { method: "DELETE" });
      toast(`“${target.title}” was removed.`, { tone: "success" });
      router.refresh();
    } catch (error) {
      setSnippets(previous);
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setDeletePending(false);
    }
  }

  const emptyAll = snippets.length === 0;
  const emptyFiltered = !emptyAll && filtered.length === 0;
  const starredCount = snippets.filter((snippet) => snippet.isStarred).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Library</div>
          <h1 className="page-title">Snippets</h1>
          <p className="page-sub">
            Keep the small, sharp pieces of code you reach for again and again — tagged, searchable, one copy away.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn--primary" onClick={() => resetForm(null)}>
            <Plus size={15} /> New snippet
          </button>
        </div>
      </div>

      <div className="task-summary">
        <span className="summary-pill"><Braces size={12} /> <strong>{snippets.length}</strong> snippets</span>
        <span className="summary-pill"><Star size={12} /> <strong>{starredCount}</strong> starred</span>
        <span className="summary-pill"><Code2 size={12} /> <strong>{languages.length}</strong> languages</span>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, tag, or code…"
            aria-label="Search snippets"
          />
        </div>
        <select
          className="select"
          style={{ width: 160, height: 36 }}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label="Filter by language"
        >
          <option value="all">All languages</option>
          {languages.map((value) => (
            <option key={value} value={value}>
              {LANGUAGES.find((entry) => entry.value === value)?.label ?? value}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="chip"
          data-active={starredOnly}
          onClick={() => setStarredOnly((current) => !current)}
          style={{ height: 36 }}
        >
          <Star size={12} /> Starred only
        </button>
      </div>

      {emptyAll ? (
        <EmptyState
          icon={Braces}
          title="Your snippet shelf is empty"
          description="Save that regex you always forget, a favourite CSS trick, or a reusable function. Snippets are searchable and copy-ready."
          action={
            <button className="btn btn--primary" onClick={() => resetForm(null)}>
              <Plus size={15} /> Save your first snippet
            </button>
          }
        />
      ) : emptyFiltered ? (
        <EmptyState
          icon={Search}
          title="No snippets match"
          description="Try a broader search, another language, or clear the starred filter."
          action={
            <button
              className="btn btn--sm"
              onClick={() => {
                setQuery("");
                setLanguage("all");
                setStarredOnly(false);
              }}
            >
              <X size={14} /> Clear filters
            </button>
          }
        />
      ) : (
        <div className="snippet-grid">
          {filtered.map((snippet) => (
            <article className="snippet-card" key={snippet.id}>
              <div className="snippet-card__head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{snippet.title}</h3>
                  {snippet.description && <p className="snippet-card__desc">{snippet.description}</p>}
                </div>
                <button
                  type="button"
                  className="star-btn"
                  data-on={snippet.isStarred}
                  onClick={() => toggleStar(snippet)}
                  aria-label={snippet.isStarred ? "Remove star" : "Star snippet"}
                  title={snippet.isStarred ? "Starred" : "Star this snippet"}
                >
                  <Star size={15} />
                </button>
              </div>

              <pre className="snippet-code">{snippet.code.trim().split("\n").slice(0, 8).join("\n")}</pre>

              <div className="snippet-card__foot">
                <span
                  className="badge"
                  style={{
                    color: LANGUAGE_COLORS[snippet.language] ?? "var(--text-2)",
                    background: `color-mix(in srgb, ${LANGUAGE_COLORS[snippet.language] ?? "#888"} 14%, transparent)`,
                  }}
                >
                  <span className="dot" /> {LANGUAGES.find((entry) => entry.value === snippet.language)?.label ?? snippet.language}
                </span>
                <div className="tag-list">
                  {snippet.tags.slice(0, 3).map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="snippet-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    onClick={() => copySnippet(snippet)}
                    title="Copy code"
                    aria-label="Copy snippet code"
                  >
                    {copiedId === snippet.id ? <Check size={13} style={{ color: "var(--mint)" }} /> : <Copy size={13} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    onClick={() => resetForm(snippet)}
                    title="Edit snippet"
                    aria-label="Edit snippet"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    onClick={() => setDeleteTarget(snippet)}
                    title="Delete snippet"
                    aria-label="Delete snippet"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="snippet-card__foot" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <span style={{ fontSize: 10, color: "var(--faint)" }}>Updated {relativeTime(snippet.updatedAt)}</span>
                {snippet.isStarred && <Sparkles size={10} style={{ color: "var(--amber)", marginLeft: "auto" }} />}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !pending && setModalOpen(false)}
        title={editing ? "Edit snippet" : "New snippet"}
        subtitle="Write it once. Find it forever."
        wide
        footer={
          <>
            <button className="btn" type="button" onClick={() => setModalOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button className="btn btn--primary" type="button" onClick={saveSnippet} disabled={pending}>
              {pending && <Spinner />}
              {editing ? "Save changes" : "Save snippet"}
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="input-row">
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="snippet-title">Title</label>
              <input
                id="snippet-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="useDebouncedValue"
                maxLength={120}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="snippet-language">Language</label>
              <select
                id="snippet-language"
                className="select"
                value={codeLanguage}
                onChange={(event) => setCodeLanguage(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="snippet-description">Description</label>
            <input
              id="snippet-description"
              className="input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is it for? When would future-you reach for it?"
              maxLength={300}
            />
          </div>
          <div className="field">
            <label htmlFor="snippet-code">
              Code <span className="field__hint">⌘↵ to save</span>
            </label>
            <textarea
              id="snippet-code"
              className="textarea code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={"export function meaningOfLife() {\n  return 42;\n}"}
              spellCheck={false}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  saveSnippet();
                }
                if (event.key === "Tab") {
                  event.preventDefault();
                  const target = event.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const next = `${code.slice(0, start)}  ${code.slice(end)}`;
                  setCode(next);
                  requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  });
                }
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="snippet-tags">
              Tags <span className="field__hint">comma separated</span>
            </label>
            <input
              id="snippet-tags"
              className="input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="react, hooks, performance"
            />
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={starred}
              onChange={(event) => setStarred(event.target.checked)}
            />
            Star this snippet so it floats to the top
          </label>
          {formError && <div className="field-error">{formError}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.title ?? "snippet"}”?`}
        description="The snippet will be permanently removed from your shelf."
        confirmLabel="Delete snippet"
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
