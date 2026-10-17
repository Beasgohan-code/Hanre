"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, ArrowUpRight, CheckSquare, ChevronRight, Copy, Download,
  FileCode2, FolderKanban, FolderOpen, Github, LayoutGrid, List, Loader2, MoreHorizontal,
  Pencil, Play, Plus, Search, Trash2, X,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { LANGUAGES } from "@/lib/types";
import { api, errorMessage, relativeTime } from "@/lib/client";
import { ConfirmDialog, EmptyState, Modal, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";
import NewProjectModal from "@/components/projects/NewProjectModal";

function langTag(language: string) {
  return LANGUAGES.find((entry) => entry.value === language)?.ext?.toUpperCase() ?? "TXT";
}

export default function ProjectsView({
  initialProjects,
  initialNew = false,
}: {
  initialProjects: Project[];
  initialNew?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [newOpen, setNewOpen] = useState(initialNew);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDescription, setRenameDescription] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [duplicating, setDuplicating] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuId]);

  useEffect(() => {
    if (initialNew) router.replace("/projects");
  }, [initialNew, router]);

  const activeCount = projects.filter((project) => !project.isArchived).length;
  const archivedCount = projects.filter((project) => project.isArchived).length;
  const totalFiles = projects.reduce((sum, project) => sum + (project.fileCount ?? 0), 0);
  const totalRuns = projects.reduce((sum, project) => sum + (project.runCount ?? 0), 0);
  const languages = useMemo(
    () => [...new Set(projects.map((project) => project.language))].sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter((project) => (showArchived ? true : !project.isArchived))
      .filter((project) => language === "all" || project.language === language)
      .filter((project) =>
        !needle ||
        project.name.toLowerCase().includes(needle) ||
        project.description.toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [projects, query, language, showArchived, sort]);

  function openProject(project: Project) {
    router.push(`/projects/${project.id}`);
  }

  function startRename(project: Project) {
    setRenameTarget(project);
    setRenameName(project.name);
    setRenameDescription(project.description);
    setMenuId(null);
  }

  async function saveRename() {
    if (!renameTarget || renamePending) return;
    const name = renameName.trim();
    if (!name) {
      toast("Project name cannot be empty.", { tone: "error" });
      return;
    }
    const previous = projects;
    setProjects((current) =>
      current.map((project) =>
        project.id === renameTarget.id
          ? { ...project, name, description: renameDescription.trim() }
          : project,
      ),
    );
    setRenameTarget(null);
    try {
      await api(`/api/projects/${renameTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description: renameDescription.trim() }),
      });
      toast("Project details updated.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setProjects(previous);
      toast(errorMessage(error), { tone: "error", title: "Rename failed" });
    }
  }

  async function toggleArchive(project: Project) {
    const nextArchived = !project.isArchived;
    const previous = projects;
    setProjects((current) =>
      current.map((item) => (item.id === project.id ? { ...item, isArchived: nextArchived } : item)),
    );
    setArchiving((current) => new Set(current).add(project.id));
    setMenuId(null);
    try {
      await api(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      toast(
        nextArchived
          ? "Archived. Find it again with the Archived filter."
          : "Project restored to your workspace.",
        { tone: "success", title: nextArchived ? "Project archived" : "Project restored" },
      );
      router.refresh();
    } catch (error) {
      setProjects(previous);
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setArchiving((current) => {
        const next = new Set(current);
        next.delete(project.id);
        return next;
      });
    }
  }

  async function duplicate(project: Project) {
    if (duplicating.has(project.id)) return;
    setDuplicating((current) => new Set(current).add(project.id));
    setMenuId(null);
    try {
      const data = await api<{ project: Project }>(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
      });
      setProjects((current) => [data.project, ...current]);
      toast(`“${data.project.name}” is ready to edit.`, { tone: "success", title: "Project duplicated" });
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "Could not duplicate" });
    } finally {
      setDuplicating((current) => {
        const next = new Set(current);
        next.delete(project.id);
        return next;
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    const previous = projects;
    setDeletePending(true);
    setProjects((current) => current.filter((project) => project.id !== target.id));
    setDeleteTarget(null);
    try {
      await api(`/api/projects/${target.id}`, { method: "DELETE" });
      toast(`“${target.name}” was removed.`, { tone: "success", title: "Project deleted" });
      router.refresh();
    } catch (error) {
      setProjects(previous);
      toast(errorMessage(error), { tone: "error", title: "Could not delete project" });
    } finally {
      setDeletePending(false);
    }
  }

  function exportProject(project: Project) {
    window.location.href = `/api/export/${project.id}`;
    setMenuId(null);
    toast("Preparing a .zip of every file…", { tone: "info" });
  }

  const menu = (project: Project) => {
    const open = menuId === project.id;
    const pending = duplicating.has(project.id) || archiving.has(project.id);
    return (
      <div className="dropdown" ref={open ? menuRef : undefined}>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 28, height: 28 }}
          aria-label={`Actions for ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuId(open ? null : project.id);
          }}
        >
          {pending ? <Loader2 size={14} className="spin" /> : <MoreHorizontal size={15} />}
        </button>
        {open && (
          <div className="dropdown__panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="menu-item" onClick={() => openProject(project)}>
              <FolderOpen size={14} /> Open project
            </button>
            <button type="button" className="menu-item" onClick={() => startRename(project)}>
              <Pencil size={14} /> Rename
            </button>
            <button type="button" className="menu-item" onClick={() => duplicate(project)}>
              <Copy size={14} /> Duplicate
            </button>
            <button type="button" className="menu-item" onClick={() => exportProject(project)}>
              <Download size={14} /> Export .zip
            </button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => toggleArchive(project)}>
              {project.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              {project.isArchived ? "Restore" : "Archive"}
            </button>
            <button
              type="button"
              className="menu-item menu-item--danger"
              onClick={() => {
                setDeleteTarget(project);
                setMenuId(null);
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const emptyAll = projects.length === 0;
  const emptyFiltered = !emptyAll && filtered.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Library</div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">
            Every project is a real folder of files with a runner and a live preview attached.
          </p>
        </div>
        <div className="header-actions">
          <LinkImport />
          <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> New project
          </button>
        </div>
      </div>

      <div className="task-summary">
        <span className="summary-pill"><FolderKanban size={12} /> <strong>{activeCount}</strong> active</span>
        <span className="summary-pill"><Archive size={12} /> <strong>{archivedCount}</strong> archived</span>
        <span className="summary-pill"><FileCode2 size={12} /> <strong>{totalFiles}</strong> files</span>
        <span className="summary-pill"><Play size={12} /> <strong>{totalRuns}</strong> runs</span>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
          />
        </div>

        <select
          className="select"
          style={{ width: 150, height: 36 }}
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

        <select
          className="select"
          style={{ width: 140, height: 36 }}
          value={sort}
          onChange={(event) => setSort(event.target.value as "updated" | "name")}
          aria-label="Sort projects"
        >
          <option value="updated">Last updated</option>
          <option value="name">Name A→Z</option>
        </select>

        <button
          type="button"
          className="chip"
          data-active={showArchived}
          onClick={() => setShowArchived((value) => !value)}
          style={{ height: 36 }}
        >
          <Archive size={12} /> Archived {archivedCount > 0 ? `(${archivedCount})` : ""}
        </button>

        <div className="view-switch" role="group" aria-label="View">
          <button type="button" data-active={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view">
            <LayoutGrid size={14} />
          </button>
          <button type="button" data-active={view === "list"} onClick={() => setView("list")} aria-label="List view">
            <List size={14} />
          </button>
        </div>
      </div>

      {emptyAll ? (
        <EmptyState
          icon={FolderKanban}
          title="Your workspace is a blank canvas"
          description="Create a project from a template, or pull in a public GitHub repository and start reading real code."
          action={
            <button className="btn btn--primary" onClick={() => setNewOpen(true)}>
              <Plus size={15} /> Create your first project
            </button>
          }
          secondary={
            <a className="btn btn--ghost" href="/import">
              <Github size={15} /> Import from GitHub
            </a>
          }
        />
      ) : emptyFiltered ? (
        <EmptyState
          icon={Search}
          title="No projects match"
          description="Try a different search, language filter, or include archived projects in the results."
          action={
            <button
              className="btn btn--sm"
              onClick={() => {
                setQuery("");
                setLanguage("all");
                setShowArchived(true);
              }}
            >
              <X size={14} /> Clear filters
            </button>
          }
        />
      ) : view === "grid" ? (
        <div className="project-tiles">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="project-tile"
              style={{ "--tone": project.color } as React.CSSProperties}
              role="link"
              tabIndex={0}
              onClick={() => openProject(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProject(project);
                }
              }}
            >
              <div className="project-tile__head">
                <span className="project-icon" style={{ "--tone": project.color } as React.CSSProperties}>
                  {langTag(project.language)}
                </span>
                <div className="project-tile__title">
                  <h3>
                    {project.name}
                    {project.isArchived && <span className="badge">Archived</span>}
                  </h3>
                  <span className="project-card__lang">
                    <span className="project-dot" style={{ background: project.color }} />
                    {project.language} · edited {relativeTime(project.updatedAt)}
                  </span>
                </div>
                <div className="project-tile__actions" onClick={(event) => event.stopPropagation()}>
                  {menu(project)}
                </div>
              </div>

              <p className="project-tile__desc">
                {project.description || "No description yet — open the editor and add one."}
              </p>

              <div className="project-tile__meta">
                <span><FileCode2 size={11} /> {project.fileCount} files</span>
                <span><Play size={11} /> {project.runCount} runs</span>
                {(project.openTasks ?? 0) > 0 && (
                  <span><CheckSquare size={11} /> {project.openTasks} open</span>
                )}
                <span style={{ marginLeft: "auto" }} className="project-tile__source">
                  {project.source.startsWith("github:") ? <Github size={10} /> : <FolderOpen size={10} />}
                  {project.source.startsWith("github:") ? "GitHub" : project.source.replace("template:", "")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="project-list">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="project-list__row"
              style={{ cursor: "pointer" }}
              onClick={() => openProject(project)}
            >
              <span className="project-icon" style={{ "--tone": project.color } as React.CSSProperties}>
                {langTag(project.language)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>
                  {project.name}
                  {project.isArchived && <span className="badge" style={{ marginLeft: 7 }}>Archived</span>}
                </h3>
                <p>{project.description || "No description"}</p>
              </div>
              <span className="muted-sm" style={{ flex: "none" }}>{project.fileCount} files</span>
              <span className="muted-sm" style={{ flex: "none", width: 90, textAlign: "right" }}>
                {relativeTime(project.updatedAt)}
              </span>
              <div onClick={(event) => event.stopPropagation()}>{menu(project)}</div>
              <ChevronRight size={14} style={{ color: "var(--faint)", flex: "none" }} />
            </div>
          ))}
        </div>
      )}

      {!emptyAll && !emptyFiltered && (
        <p className="muted-sm" style={{ marginTop: 16 }}>
          Showing {filtered.length} of {projects.length} projects
          {!showArchived && archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
        </p>
      )}

      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename project"
        subtitle="A clear name makes the sidebar easier to scan."
        footer={
          <>
            <button className="btn" type="button" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn btn--primary" type="button" onClick={saveRename} disabled={renamePending}>
              {renamePending && <Spinner />} Save changes
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="field">
            <label htmlFor="rename-name">Project name</label>
            <input
              id="rename-name"
              className="input"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveRename();
                }
              }}
              maxLength={80}
            />
          </div>
          <div className="field">
            <label htmlFor="rename-desc">Description</label>
            <textarea
              id="rename-desc"
              className="textarea"
              rows={3}
              value={renameDescription}
              onChange={(event) => setRenameDescription(event.target.value)}
              maxLength={400}
              placeholder="What is this project for?"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.name ?? "project"}”?`}
        description="All files, runs, and links inside this project will be deleted. Export a copy first if you might need it."
        confirmLabel="Delete project"
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function LinkImport() {
  return (
    <Link href="/import" className="btn btn--outline">
      <Github size={15} /> Import
    </Link>
  );
}
