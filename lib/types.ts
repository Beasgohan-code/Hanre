export type Language =
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "json"
  | "sql"
  | "markdown"
  | "shell"
  | "cpp"
  | "rust"
  | "java"
  | "php"
  | "xml"
  | "yaml"
  | "plaintext";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  prefs: UserPrefs;
  createdAt: string;
}

export interface UserPrefs {
  theme?: "dark" | "light" | "system";
  editorFontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  autosave?: boolean;
  lineNumbers?: boolean;
  accent?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  language: string;
  color: string;
  isArchived: boolean;
  favorite: boolean;
  shareSlug?: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  fileCount?: number;
  runCount?: number;
  openTasks?: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  userId: string;
  path: string;
  name: string;
  isDir: boolean;
  language: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Snippet {
  id: string;
  userId: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  userId: string;
  projectId: string | null;
  projectName?: string | null;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: string;
  userId: string;
  projectId: string | null;
  projectName?: string | null;
  fileId: string | null;
  fileName?: string | null;
  command: string;
  language: string;
  status: "success" | "error" | "unsupported";
  output: string;
  durationMs: number;
  createdAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  size: number;
  preview: string;
  createdAt: string;
}

export interface Share {
  id: string;
  projectId: string;
  slug: string;
  views: number;
  createdAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  kind: string;
  message: string;
  projectId: string | null;
  createdAt: string;
}

export interface DashboardData {
  stats: {
    projects: number;
    snippets: number;
    openTasks: number;
    runs: number;
    runsThisWeek: number;
    successRate: number;
  };
  projects: Project[];
  tasks: Task[];
  runs: Run[];
  activity: Activity[];
  activityByDay: { day: string; count: number }[];
  snippets: Snippet[];
}

export const LANGUAGES: { value: string; label: string; color: string; ext: string }[] = [
  { value: "javascript", label: "JavaScript", color: "#f7df1e", ext: "js" },
  { value: "typescript", label: "TypeScript", color: "#3178c6", ext: "ts" },
  { value: "python", label: "Python", color: "#3776ab", ext: "py" },
  { value: "html", label: "HTML", color: "#e34f26", ext: "html" },
  { value: "css", label: "CSS", color: "#663399", ext: "css" },
  { value: "json", label: "JSON", color: "#a3a3a3", ext: "json" },
  { value: "sql", label: "SQL", color: "#e38b00", ext: "sql" },
  { value: "markdown", label: "Markdown", color: "#9ca3af", ext: "md" },
  { value: "shell", label: "Shell", color: "#4eaa25", ext: "sh" },
  { value: "cpp", label: "C++", color: "#00599c", ext: "cpp" },
  { value: "rust", label: "Rust", color: "#dea584", ext: "rs" },
  { value: "java", label: "Java", color: "#b07219", ext: "java" },
  { value: "php", label: "PHP", color: "#777bb4", ext: "php" },
  { value: "yaml", label: "YAML", color: "#cb171e", ext: "yml" },
  { value: "plaintext", label: "Plain text", color: "#8b97a8", ext: "txt" },
];

export const LANGUAGE_COLORS: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.value, l.color]),
);

export function languageForPath(path: string): string {
  const lower = path.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", py: "python", html: "html", htm: "html",
    css: "css", scss: "css", json: "json", sql: "sql", md: "markdown",
    mdx: "markdown", sh: "shell", bash: "shell", zsh: "shell", cpp: "cpp",
    cc: "cpp", h: "cpp", rs: "rust", java: "java", php: "php", yml: "yaml",
    yaml: "yaml", xml: "xml", svg: "xml", txt: "plaintext",
  };
  if (!ext) return "plaintext";
  if (lower.endsWith("dockerfile")) return "plaintext";
  return map[ext] ?? "plaintext";
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: "dark",
  editorFontSize: 14,
  tabSize: 2,
  wordWrap: false,
  autosave: true,
  lineNumbers: true,
  accent: "violet",
};
