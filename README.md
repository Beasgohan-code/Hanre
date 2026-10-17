# Hanre Studio

**A full coding workspace that runs in a browser tab — for everyone.**

Hanre Studio is a self-hosted, full-stack web IDE. It gives you a real editor, a project file
tree, instant previews, a friendly terminal, task boards, snippets, run history, and a GitHub
importer — wrapped in an interface designed for people writing their first line of code as much
as for people shipping their hundredth project.

No container orchestration, no remote VM, no npm install per project. JavaScript, TypeScript,
Python, HTML/CSS, Markdown, JSON, and SQL all run client-side, straight from the editor.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Hanre   Dashboard  Projects  Snippets  Tasks  Runs   ⌘K   Maya   │
├───────────┬──────────────────────────────────────────────────────────┤
│  Explorer │  index.html ×  app.js ×                         ▶ Run    │
│  ▾ src    │ ┌────────────────────────┬─────────────────────────────┐ │
│    app.js │ │  1  <!DOCTYPE html>    │   Live preview              │ │
│    ui.css │ │  2  <html lang="en">   │   ┌─────────────────────┐   │ │
│  index.html│ │  3    <head> …        │   │  Hello, Hanre       │   │ │
│  notes.md │ │                        │   └─────────────────────┘   │ │
│           │ └────────────────────────┴─────────────────────────────┘ │
│  + New    │  Terminal · git status · python hello.py                 │
└───────────┴──────────────────────────────────────────────────────────┘
```

---

## What is inside

### The workspace
- **CodeMirror 6 editor** with syntax highlighting for 15+ languages, autocomplete, bracket
  matching, search, multiple tabs, and unsaved-change indicators.
- **Run anything, instantly.** JavaScript and TypeScript execute inside a disposable Web Worker
  with a 6-second watchdog. Python and SQL run through Pyodide + SQLite. HTML renders in a
  sandboxed iframe with local CSS and JS inlined. CSS gets a sample page, Markdown gets a styled
  document, JSON gets validation and pretty-printing.
- **Live preview pane** beside the editor, or a distraction-free full-width mode.
- **Hanre Shell** — a guided terminal with `ls`, `cd`, `cat`, `tree`, `touch`, `echo >`, `rm`,
  `mv`, `open`, `run`, `git status/log/diff`, `npm run dev`, and `hanre stats`. Every destructive
  action maps to real workspace files, and every error explains itself.
- **File management** — create, rename, move, upload, download, and delete files and folders.
- **Project download** as a `.zip`, plus a full JSON backup of the whole workspace.

### Around the workspace
- **Dashboard** with a 7-day activity chart, real stats, recent projects, a focus list of open
  tasks, recent runs, and an activity feed.
- **Projects** with filtering (all/active/archived), grid and list views, duplicate, archive,
  rename, delete, six starter templates, and optimistic updates throughout.
- **Snippets** library with language/tag filters, search, starring, copy, edit, and delete.
- **Tasks** as a four-column drag-and-drop board (Backlog → In progress → Review → Done) with
  priorities, due dates, project links, quick-complete, and persisted ordering.
- **Runs** history with success rate, average duration, status filters, pagination, output
  inspection, single deletion, and a guarded “clear history”.
- **GitHub import** — inspect any public repository, choose which text files to copy, and land in
  a ready-to-edit project. Binaries, lockfiles, and huge files are skipped automatically.
- **Command palette** (⌘K / Ctrl+K) for jumping to pages, projects, snippets, tasks, and files.
- **Settings** for profile, avatar colour, theme (dark/light/system), accent colour, editor font
  size, tab size, word wrap, autosave, line numbers, password changes, data export, and account
  deletion.
- **Authentication** with scrypt-hashed passwords, HTTP-only session cookies, a one-click demo
  account, and per-user isolation on every query.

### The little things
Empty states on every list. Skeleton loading routes. Optimistic create/rename/delete. Toasts with
undo-able intent. Keyboard shortcuts. Focus-visible rings. Reduced-motion support. A responsive
layout that collapses to a single column, with a slide-over file tree in the editor.

---

## Quickstart

Requirements: **Node.js 22.13+** (the app uses the built-in `node:sqlite` module).

```bash
npm install
npm run seed      # optional — the app also seeds itself on first run
npm run dev
```

Open <http://localhost:3000>. Sign in with the demo account or create your own:

| Email | Password |
| --- | --- |
| `demo@hanre.dev` | `demo1234` |

The demo account ships with 5 projects, 13 files, 6 snippets, 11 tasks, and 14 runs across a
fortnight of activity.

### Production

```bash
npm run build
npm start          # binds 0.0.0.0:3000
```

The SQLite file lives at `data/hanre.db` (git-ignored). Mount a persistent volume there when
deploying — that single directory is the whole database.

---

## Stack, and where it comes from

Hanre is assembled from established open-source projects rather than reimplemented from scratch:

| Layer | Project | Why |
| --- | --- | --- |
| Framework | [Next.js 15](https://github.com/vercel/next.js) App Router | Server components, route handlers, streaming |
| UI | [React 19](https://github.com/facebook/react) | The editor shell and all interactivity |
| Editor | [CodeMirror 6](https://github.com/codemirror/dev) | Fast, accessible editing with a real extension system |
| Terminal | [xterm.js 5](https://github.com/xtermjs/xterm.js) | The same renderer behind VS Code’s terminal |
| Python / SQL | [Pyodide](https://github.com/pyodide/pyodide) | CPython + SQLite compiled to WebAssembly |
| TypeScript | [Sucrase](https://github.com/alangpierce/sucrase) | Instant TS → JS without a bundler step |
| Archives | [fflate](https://github.com/101arrowz/fflate) | Zip export and GitHub tarball extraction, in pure JS |
| Icons | [Lucide](https://github.com/lucide-icons/lucide) | A consistent, friendly icon set |
| Type | [Inter](https://github.com/rsms/inter) + [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | UI and code typography |
| Storage | [`node:sqlite`](https://nodejs.org/api/sqlite.html) | Zero-dependency, synchronous SQLite in Node |

No UI kit, no ORM, no auth service. The design system is hand-built in `app/globals.css` and
`app/studio.css`; the data layer is plain SQL over `node:sqlite`.

---

## How the runtime works

| Language | Execution | Limits |
| --- | --- | --- |
| JavaScript | Web Worker, fresh per run, `console.*` captured | 6 s, 600 log lines, 24 000 chars |
| TypeScript | Sucrase transform → same Worker | same as JS |
| Python | Pyodide (loaded on first run, ~10 MB, cached by the browser) | browser memory |
| SQL | `sqlite3` inside Pyodide, with a demo schema when the file has no `CREATE TABLE` | 50 rows per statement shown |
| HTML | CSS/JS from the same project inlined into a sandboxed iframe | none |
| CSS / Markdown | Rendered against a sample page / document | none |
| JSON | Parsed, validated, pretty-printed | 8 000 chars shown |
| Other | Friendly explanation of why it cannot run natively | — |

Everything executes **in the user’s browser**. There is no server-side code execution, so a
malicious file cannot touch the host. The Python runtime is fetched from jsDelivr; for an air-gapped
deployment, host the Pyodide `full/` build yourself and point `PYODIDE_CDN` in `lib/runner.ts` at it.

---

## Project layout

```
app/
  (app)/                 authenticated shell: dashboard, projects, snippets, tasks, runs, settings, import
  api/                   route handlers (auth, projects, files, snippets, tasks, runs, github, export, search)
  login/ register/       public auth pages
  globals.css            design tokens, resets, layout primitives, buttons, forms, modals, toasts
  studio.css             page-specific product styles
components/
  studio/                shell, command palette, providers (prefs/theme/toasts)
  workbench/             CodeMirror host, file tree, terminal, preview, run orchestration
  dashboard/ projects/ snippets/ tasks/ runs/ settings/ import/
  ui/                    shared primitives and skeletons
lib/
  db.ts seed.ts          schema, migrations, demo content
  auth.ts api.ts         sessions, scrypt, guards, JSON helpers
  data.ts                dashboard/search queries
  runner.ts terminal.ts  browser execution + shell
  preview.ts tar.ts github.ts filetree.ts templates.ts
scripts/seed.ts          `npm run seed [-- --reset]`
data/hanre.db            SQLite database (created on first run, git-ignored)
```

---

## API

All endpoints are JSON, scoped to the signed-in user, and return `{ error }` with a meaningful
message on failure. Writes use `POST`, `PATCH`, or `DELETE`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `/login`, `/demo`, `/logout` · `GET/PATCH /api/auth/me` · `POST /api/auth/password` · `DELETE /api/auth/account` |
| Projects | `GET/POST /api/projects` · `GET/PATCH/DELETE /api/projects/:id` · `POST /api/projects/:id/duplicate` |
| Files | `GET/POST /api/files?projectId=` · `GET/PATCH/DELETE /api/files/:id` |
| Snippets | `GET/POST /api/snippets` · `GET/PATCH/DELETE /api/snippets/:id` |
| Tasks | `GET/POST /api/tasks` · `GET/PATCH/DELETE /api/tasks/:id` · `POST /api/tasks/reorder` |
| Runs | `GET/POST/DELETE /api/runs` · `DELETE /api/runs/:id` |
| Workspace | `GET /api/dashboard`, `/api/search?q=`, `/api/github?repo=`, `POST /api/github/import` |
| Export | `GET /api/export` (JSON backup) · `GET /api/export/:id` (project zip) |

Authentication uses a 30-day `hanre_session` cookie. Tokens are random 32-byte values; only their
SHA-256 hashes are stored. Passwords use `scrypt` with a per-user salt.

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘S` / `Ctrl+S` | Save the open file |
| `⌘↵` / `Ctrl+Enter` | Run the open file |
| `⌘\`` / `Ctrl+\`` | Toggle the terminal |
| `Ctrl+Space` | Editor autocomplete |
| `⌘B` / `Ctrl+B` | Toggle the file sidebar (editor) |
| `Esc` | Close dialogs and the palette |

---

## Configuration

Copy `.env.example` if you want to set anything — everything is optional.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Raises GitHub’s anonymous rate limit for imports. No scopes are required for public repositories. |
| `NODE_EXTRA_CA_CERTS` | Only needed behind a TLS-inspecting proxy or sandbox; point it at your CA bundle. |

---

## Honest limitations

- **The terminal is a simulation.** It operates on workspace files and teaches the shape of a
  shell, but there are no processes, pipes, permissions, or network commands. `git` is a
  lightweight local model — commits are illustrative, not content-addressed.
- **Python is downloaded on demand.** The first Python or SQL run needs network access to jsDelivr.
- **No native compilers.** C++, Rust, Java, and PHP files are highlighted and stored, but not
  compiled; Hanre explains this instead of failing silently.
- **Single-node storage.** SQLite is perfect for a personal or small-team deployment; it is not a
  distributed database. Host the app on one persistent disk.
- **No email verification or password reset flow.** Accounts are local to this deployment, and the
  demo account cannot change its password or delete itself. Add an email provider before opening a
  public instance to strangers.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Production server, bound to `0.0.0.0:3000` |
| `npm run seed` | Ensure the demo workspace exists |
| `npm run seed -- --reset` | Rebuild the demo workspace from scratch |

---

Built with care as a demonstration that a capable coding environment can feel calm, explain
itself, and fit in a browser tab.
