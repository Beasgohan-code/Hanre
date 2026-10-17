"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckSquare, ChevronDown, Code2, FolderKanban, Github, History, LayoutDashboard,
  LogOut, Menu, Moon, Search, Settings, Sun, X,
} from "lucide-react";
import CommandPalette from "@/components/studio/CommandPalette";
import { PrefsProvider, ToastProvider, ToastViewport, usePrefs, useToast } from "@/components/studio/providers";
import type { Project, User, UserPrefs } from "@/lib/types";
import { api } from "@/lib/client";
import { initials } from "@/lib/format";

interface Counts {
  projects: number;
  files: number;
  openTasks: number;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/snippets", label: "Snippets", icon: Code2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/runs", label: "Run history", icon: History },
  { href: "/import", label: "Import", icon: Github },
];

const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  snippets: "Snippets",
  tasks: "Tasks",
  runs: "Run history",
  settings: "Settings",
  import: "Import",
};

export default function StudioShell({
  user,
  projects,
  counts,
  children,
}: {
  user: User;
  projects: Project[];
  counts: Counts;
  children: ReactNode;
}) {
  return (
    <PrefsProvider user={user} initialPrefs={user.prefs as UserPrefs}>
      <ToastProvider>
        <Shell projects={projects} counts={counts}>{children}</Shell>
      </ToastProvider>
    </PrefsProvider>
  );
}

function Shell({
  projects,
  counts,
  children,
}: {
  projects: Project[];
  counts: Counts;
  children: ReactNode;
}) {
  const { user, theme, setTheme } = usePrefs();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const segments = pathname.split("/").filter(Boolean);
  const section = SECTION_LABEL[segments[0] ?? ""] ?? "Workspace";
  const isProject = segments[0] === "projects" && Boolean(segments[1]);

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie may already be gone */
    }
    toast("Signed out. See you soon.", { tone: "info" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" data-open={sidebarOpen}>
        <div className="sidebar__brand">
          <Link href="/dashboard" className="brand" aria-label="Hanre Studio home">
            <span className="brand-mark">H</span>
            <span>
              <span className="brand-name">Hanre</span>
              <span className="brand-sub">studio</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="nav" aria-label="Main">
          <p className="sidebar__label">Workspace</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            const badge =
              item.href === "/tasks" ? counts.openTasks : item.href === "/projects" ? counts.projects : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{item.label}</span>
                {badge > 0 && <span className="nav-link__count">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__section">
          <div className="sidebar__label">
            <span>Projects</span>
            <Link href="/projects?new=1" aria-label="New project">+</Link>
          </div>
          {projects.length === 0 ? (
            <p className="sidebar__empty">No projects yet — make one.</p>
          ) : (
            <div className="sidebar__projects">
              {projects.slice(0, 7).map((project) => {
                const active = segments[0] === "projects" && segments[1] === project.id;
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="project-link"
                    data-active={active}
                  >
                    <span className="project-dot" style={{ background: project.color }} />
                    <span>{project.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar__spacer" />

        <div className="sidebar__footer">
          <div className="usage-card">
            <div className="usage-card__title">
              <span>Workspace</span>
              <span>{counts.files} files</span>
            </div>
            <div className="usage-bar">
              <span style={{ width: `${Math.min(100, Math.max(4, (counts.files / 200) * 100))}%` }} />
            </div>
            <p className="usage-card__meta">
              <span>{counts.projects} projects</span>
              <span>{counts.openTasks} open tasks</span>
            </p>
          </div>
          <Link
            href="/settings"
            className="nav-link"
            data-active={pathname.startsWith("/settings")}
          >
            <Settings size={16} strokeWidth={1.8} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-wrap">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <nav className="topbar__crumbs" aria-label="Breadcrumb">
            <span>Workspace</span>
            <span className="crumb-sep">/</span>
            {isProject ? (
              <>
                <Link href="/projects">Projects</Link>
                <span className="crumb-sep">/</span>
                <strong>Editor</strong>
              </>
            ) : (
              <strong>{section}</strong>
            )}
          </nav>

          <div className="topbar__spacer" />

          <button
            type="button"
            className="search-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search workspace"
          >
            <Search size={14} />
            <span>Search anything…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="topbar__right">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="avatar-menu" ref={menuRef}>
              <button
                type="button"
                className="avatar-trigger"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="avatar" style={{ background: user.avatarColor }}>
                  {initials(user.name)}
                </span>
                <span className="avatar-trigger__name">{user.name.split(" ")[0]}</span>
                <ChevronDown size={13} />
              </button>
              {menuOpen && (
                <div className="menu-pop" role="menu">
                  <div className="menu-pop__head">
                    <span className="avatar" style={{ background: user.avatarColor }}>
                      {initials(user.name)}
                    </span>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <Link href="/settings" className="menu-item" role="menuitem">
                    <Settings size={14} /> Account settings
                  </Link>
                  <a href="/api/export" className="menu-item" role="menuitem">
                    <Github size={14} /> Download backup
                  </a>
                  <button type="button" className="menu-item menu-item--danger" role="menuitem" onClick={signOut}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content" id="main">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastViewport />
    </div>
  );
}
