"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CheckSquare, Code2, Download, FileCode2, FolderKanban, Github, History,
  LayoutDashboard, Loader2, LogOut, Moon, Plus, Search, Settings, Sun,
} from "lucide-react";
import { api } from "@/lib/client";
import { usePrefs, useToast } from "@/components/studio/providers";

interface PaletteEntry {
  id: string;
  label: string;
  hint?: string;
  group: "Go to" | "Create" | "Actions" | "Projects" | "Files" | "Snippets" | "Tasks";
  icon: ComponentType<{ size?: number | string }>;
  run: () => void;
  color?: string;
}

interface SearchPayload {
  projects: { id: string; name: string; description: string; color: string }[];
  files: { id: string; projectId: string; name: string; path: string }[];
  snippets: { id: string; title: string; language: string }[];
  tasks: { id: string; title: string; status: string }[];
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = usePrefs();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const baseActions = useMemo<PaletteEntry[]>(() => [
    { id: "nav-dashboard", label: "Dashboard", group: "Go to", icon: LayoutDashboard, run: () => go("/dashboard"), hint: "Overview" },
    { id: "nav-projects", label: "Projects", group: "Go to", icon: FolderKanban, run: () => go("/projects"), hint: "All projects" },
    { id: "nav-snippets", label: "Snippets", group: "Go to", icon: Code2, run: () => go("/snippets"), hint: "Saved code" },
    { id: "nav-tasks", label: "Tasks", group: "Go to", icon: CheckSquare, run: () => go("/tasks"), hint: "Board" },
    { id: "nav-runs", label: "Run history", group: "Go to", icon: History, run: () => go("/runs"), hint: "Execution log" },
    { id: "nav-import", label: "Import from GitHub", group: "Go to", icon: Github, run: () => go("/import"), hint: "Public repos" },
    { id: "nav-settings", label: "Settings", group: "Go to", icon: Settings, run: () => go("/settings"), hint: "Account & editor" },
    { id: "new-project", label: "New project", group: "Create", icon: Plus, run: () => go("/projects?new=1"), hint: "Start from a template" },
    { id: "new-snippet", label: "New snippet", group: "Create", icon: Plus, run: () => go("/snippets?new=1"), hint: "Save a piece of code" },
    { id: "toggle-theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", group: "Actions", icon: theme === "dark" ? Sun : Moon, run: () => { setTheme(theme === "dark" ? "light" : "dark"); toast(theme === "dark" ? "Light theme on." : "Dark theme on."); onClose(); } },
    { id: "backup", label: "Download workspace backup", group: "Actions", icon: Download, run: () => { window.location.href = "/api/export"; onClose(); } },
    { id: "logout", label: "Sign out", group: "Actions", icon: LogOut, run: async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => null); window.location.href = "/login"; } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [theme, setTheme, toast, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setActive(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const value = query.trim();
    if (value.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api<SearchPayload>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((data) => setResults(data))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 170);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase();
    const actions = baseActions.filter(
      (entry) => !needle || entry.label.toLowerCase().includes(needle) || entry.hint?.toLowerCase().includes(needle),
    );
    if (!results) return actions;
    const found: PaletteEntry[] = [
      ...results.projects.map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        hint: project.description || "Project",
        group: "Projects" as const,
        icon: FolderKanban,
        color: project.color,
        run: () => go(`/projects/${project.id}`),
      })),
      ...results.files.map((file) => ({
        id: `file-${file.id}`,
        label: file.name,
        hint: file.path,
        group: "Files" as const,
        icon: FileCode2,
        run: () => go(`/projects/${file.projectId}?file=${file.id}`),
      })),
      ...results.snippets.map((snippet) => ({
        id: `snippet-${snippet.id}`,
        label: snippet.title,
        hint: snippet.language,
        group: "Snippets" as const,
        icon: Code2,
        run: () => go(`/snippets?edit=${snippet.id}`),
      })),
      ...results.tasks.map((task) => ({
        id: `task-${task.id}`,
        label: task.title,
        hint: task.status.replace("_", " "),
        group: "Tasks" as const,
        icon: CheckSquare,
        run: () => go(`/tasks?task=${task.id}`),
      })),
    ];
    return [...actions, ...found];
  }, [baseActions, results, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActive(0);
  }, [query, results]);

  useEffect(() => {
    if (!open) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (entries.length ? (current + 1) % entries.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (entries.length ? (current - 1 + entries.length) % entries.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      entries[active]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  let lastGroup = "";
  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files, projects, snippets, or run a command…"
            aria-label="Search workspace"
            spellCheck={false}
          />
          {loading ? <Loader2 size={14} className="spin" /> : <kbd className="kbd">esc</kbd>}
        </div>
        <div className="palette__results" ref={listRef}>
          {entries.length === 0 && (
            <div className="palette__empty">
              <Search size={18} />
              <p>No matches for “{query}”. Try a file name, a project, or “new”.</p>
            </div>
          )}
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            const showGroup = entry.group !== lastGroup;
            lastGroup = entry.group;
            return (
              <div key={entry.id}>
                {showGroup && <div className="palette__group-label">{entry.group}</div>}
                <button
                  type="button"
                  className="palette__item"
                  data-active={index === active}
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={entry.run}
                >
                  <span
                    className="palette__icon"
                    style={entry.color ? { color: entry.color, background: `${entry.color}1f` } : undefined}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="palette__item-label">{entry.label}</span>
                  {entry.hint && <span className="palette__item-hint">{entry.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette__foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> open</span>
          <span><kbd className="kbd">esc</kbd> close</span>
          <span className="palette__brand">Hanre Studio</span>
        </div>
      </div>
    </div>
  );
}
