/**
 * Hanre Shell — a friendly, sandboxed shell for the browser workspace.
 *
 * It never touches the network or the real filesystem: every command maps to
 * operations on the user's project files through the host adapter. The goal is
 * teaching, not POSIX purity — output is coloured, errors are explained, and
 * destructive commands always say exactly what changed.
 */

import { buildTree, listDir, type TreeNode } from "./filetree";

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[38;5;245m",
  faint: "\x1b[38;5;240m",
  text: "\x1b[38;5;252m",
  green: "\x1b[38;5;114m",
  red: "\x1b[38;5;203m",
  yellow: "\x1b[38;5;221m",
  blue: "\x1b[38;5;111m",
  purple: "\x1b[38;5;141m",
  cyan: "\x1b[38;5;116m",
};

export interface TerminalFile {
  id: string;
  path: string;
  content: string;
  language: string;
}

export interface TerminalHost {
  projectName: string;
  userName: string;
  cwd: string;
  files: TerminalFile[];
  history: string[];
  dirtyPaths: string[];
  setCwd(path: string): void;
  createFile(path: string, content?: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  deletePath(path: string): Promise<void>;
  movePath(from: string, to: string): Promise<void>;
  runFile(path: string): Promise<string>;
  openFile(path: string): void;
  clearScreen(): void;
  setTheme(theme: "dark" | "light"): void;
}

export interface CommandResult {
  lines: string[];
  clear?: boolean;
}

const COMMANDS = [
  ["ls [dir]", "list files and folders"],
  ["cd <dir>", "change directory"],
  ["cat <file>", "print a file"],
  ["tree", "print the whole project tree"],
  ["touch <file>", "create an empty file"],
  ["echo <text> > <file>", "write or append text"],
  ["rm <file>", "delete a file"],
  ["mv <from> <to>", "rename or move"],
  ["open <file>", "open a file in the editor"],
  ["run <file>", "execute a file in the sandbox"],
  ["node|python <file>", "run a file with a specific runtime"],
  ["pwd / whoami / date", "workspace info"],
  ["git status|log|branch|diff", "inspect version control"],
  ["hanre stats|theme|docs", "Hanre extras"],
  ["clear", "clear the screen"],
];

function resolvePath(cwd: string, input: string) {
  const parts = (input.startsWith("/") ? input : `${cwd}/${input}`).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function parseArgs(input: string) {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input))) args.push(match[1] ?? match[2] ?? match[3]);
  return args;
}

function error(text: string) {
  return [`${c.red}✗${c.reset} ${text}`];
}

function ok(text: string, extra?: string) {
  return `${c.green}✓${c.reset} ${text}${extra ? ` ${c.faint}${extra}${c.reset}` : ""}`;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fakeHash(seed: string, length = 7) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0").slice(0, length);
}

function findFile(host: TerminalHost, path: string) {
  return host.files.find((file) => file.path === path);
}

function isDir(host: TerminalHost, path: string) {
  if (!path) return true;
  return host.files.some((file) => file.path.startsWith(`${path}/`));
}

function dirList(host: TerminalHost, path: string, flags: string[]) {
  const entries = listDir(host.files, path);
  if (!entries.length) {
    if (path && !isDir(host, path)) return error(`No such directory: ${path || "/"}`);
    return [`${c.dim}This folder is empty.${c.reset}`];
  }
  const showSize = flags.some((flag) => flag.includes("l"));
  const lines = entries.map((entry) => {
    if (entry.isDir) return `  ${c.blue}${entry.name}/${c.reset}`;
    const file = findFile(host, entry.path);
    const bytes = file ? new TextEncoder().encode(file.content).length : 0;
    const meta = showSize ? `${c.faint}${humanSize(bytes).padStart(9)}${c.reset}` : "";
    return `${meta}  ${c.text}${entry.name}${c.reset}`;
  });
  const count = entries.length;
  lines.push("");
  lines.push(`${c.faint}${count} item${count === 1 ? "" : "s"}${path ? ` in ${path}` : ""}${c.reset}`);
  return lines;
}

function treeLines(host: TerminalHost) {
  const tree = buildTree(host.files.map((file) => ({
    id: file.id,
    path: file.path,
    language: file.language,
  })));
  const lines: string[] = [`${c.blue}${host.projectName}${c.reset}`];

  function walk(nodes: TreeNode[], prefix: string) {
    nodes.forEach((node, index) => {
      const last = index === nodes.length - 1;
      const branch = last ? "└── " : "├── ";
      const nextPrefix = prefix + (last ? "    " : "│   ");
      const label = node.isDir
        ? `${c.blue}${node.name}/${c.reset}`
        : `${c.text}${node.name}${c.reset}`;
      lines.push(`${c.faint}${prefix}${branch}${c.reset}${label}`);
      if (node.children.length) walk(node.children, nextPrefix);
    });
  }
  walk(tree, "");
  lines.push("");
  lines.push(`${c.faint}${host.files.length} files${c.reset}`);
  return lines;
}

function gitStatus(host: TerminalHost) {
  const lines = [`${c.text}On branch ${c.purple}main${c.reset}`];
  if (!host.dirtyPaths.length) {
    lines.push(`nothing to commit, working tree clean`);
    return lines;
  }
  lines.push(`${c.dim}Changes not staged for commit:${c.reset}`);
  lines.push(`${c.faint}  (use "git add <file>..." to update what will be committed)${c.reset}`);
  for (const path of host.dirtyPaths) {
    lines.push(`${c.red}        modified:   ${path}${c.reset}`);
  }
  lines.push("");
  lines.push(`${c.dim}no changes added to commit${c.reset}`);
  return lines;
}

function gitLog(host: TerminalHost) {
  const seed = host.files.map((file) => file.path).join("|");
  const messages = [
    "Polish the empty state",
    "Wire up keyboard shortcuts",
    `Add ${host.files.length} files to ${host.projectName}`,
    "Initial commit",
  ];
  const now = Date.now();
  const lines: string[] = [];
  messages.forEach((message, index) => {
    const hash = fakeHash(`${seed}:${message}`, 7);
    const when = new Date(now - index * 1000 * 60 * 60 * 9).toUTCString().replace("GMT", "+0000");
    lines.push(`${c.yellow}commit ${hash}${fakeHash(`${seed}:${index}`, 33)}${c.reset}`);
    lines.push(`${c.text}Author: ${host.userName} <you@hanre.dev>${c.reset}`);
    lines.push(`${c.text}Date:   ${when}${c.reset}`);
    lines.push("");
    lines.push(`    ${message}`);
    lines.push("");
  });
  const branch = [...new Set(host.files.map(() => "main"))].join(", ");
  lines.push(`${c.dim}(end of history — branch ${branch} is synced with the workspace)${c.reset}`);
  return lines;
}

function gitCommand(host: TerminalHost, args: string[]) {
  const sub = args[0] ?? "";
  if (!sub) {
    return [
      `${c.dim}usage: git <command>${c.reset}`,
      `  ${c.cyan}status${c.reset}   inspect changes`,
      `  ${c.cyan}log${c.reset}      recent commits`,
      `  ${c.cyan}branch${c.reset}   current branch`,
      `  ${c.cyan}diff${c.reset}     pending edits`,
      "",
      `${c.faint}The workspace keeps a lightweight local history — commits are simulated.${c.reset}`,
    ];
  }
  if (sub === "status") return gitStatus(host);
  if (sub === "log") return gitLog(host);
  if (sub === "branch" || sub === "branch-list") {
    return [`${c.green}* main${c.reset}`, `${c.faint}  (workspace branch — no remotes configured)${c.reset}`];
  }
  if (sub === "diff") {
    if (!host.dirtyPaths.length) return [`${c.dim}No unstaged changes.${c.reset}`];
    const lines: string[] = [];
    for (const path of host.dirtyPaths.slice(0, 3)) {
      const file = findFile(host, path);
      lines.push(`${c.dim}diff --git a/${path} b/${path}${c.reset}`);
      lines.push(`${c.dim}--- a/${path}${c.reset}`);
      lines.push(`${c.dim}+++ b/${path}${c.reset}`);
      lines.push(`${c.red}- unsaved buffer${c.reset}`);
      lines.push(`${c.green}+ ${file?.content.split("\n").length ?? 0} lines in editor${c.reset}`);
    }
    return lines;
  }
  if (sub === "init") return [ok("Reinitialised the local workspace history.")];
  if (sub === "add") return [ok(args.slice(1).join(" ") || "Everything", "staged (buffered edits are saved on Cmd+S).")];
  if (sub === "commit") return [ok("Committed locally.", "Push is not available in the browser sandbox.")];
  if (sub === "remote" || sub === "fetch") return [`${c.dim}No remotes configured.${c.reset}`, `Use ${c.cyan}Import from GitHub${c.reset} to bring in a repository.`];
  if (sub === "pull" || sub === "push") return [`${c.yellow}Remote operations are disabled in the browser.${c.reset}`, `${c.dim}Use the Import page to copy files from GitHub.${c.reset}`];
  if (sub === "checkout" || sub === "switch") {
    return [`${c.yellow}Branch switching is not available.${c.reset}`, `${c.dim}The workspace has one branch: main.${c.reset}`];
  }
  return error(`git: '${sub}' is not supported here. Try status, log, branch or diff.`);
}

function npmCommand(args: string[]) {
  const sub = args[0] ?? "";
  if (sub === "install" || sub === "i" || sub === "add") {
    return [
      `${c.dim}Hanre runs in the browser, so there is no package manager here.${c.reset}`,
      `${c.faint}Bundled already: CodeMirror 6, xterm.js, sucrase, fflate.${c.reset}`,
      `${c.faint}For Python, Pyodide is fetched on demand when you run a .py file.${c.reset}`,
    ];
  }
  if (sub === "run") {
    const script = args[1] ?? "";
    if (script === "dev" || script === "start") {
      return [
        `${c.faint}> hanre-studio@1.0.0 ${script}${c.reset}`,
        `${c.green}ready${c.reset} — preview is live inside the editor`,
        `${c.dim}Open an .html file and press Run to see it immediately.${c.reset}`,
      ];
    }
    if (script === "test") {
      return [`${c.yellow}No test suite in this project yet.${c.reset}`, `${c.dim}Run a file directly with: run <file>${c.reset}`];
    }
    return [ok(`Simulated \`npm run ${script || "dev"}\`. Use the Run button for real execution.`)];
  }
  if (sub === "test") return [`${c.yellow}No test suite in this project yet.${c.reset}`];
  if (sub === "ls" || sub === "list") {
    return [`${c.dim}This workspace is not an npm project — files are managed by Hanre.${c.reset}`];
  }
  return error(`npm: '${sub || "help"}' is not available in the browser sandbox.`);
}

function hanreCommand(host: TerminalHost, args: string[]) {
  const sub = args[0] ?? "help";
  if (sub === "stats") {
    const bytes = host.files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).length, 0);
    const byLanguage = new Map<string, number>();
    for (const file of host.files) byLanguage.set(file.language, (byLanguage.get(file.language) ?? 0) + 1);
    const languages = [...byLanguage.entries()].sort((a, b) => b[1] - a[1]);
    return [
      `${c.purple}${host.projectName}${c.reset} ${c.faint}· workspace overview${c.reset}`,
      `  files      ${c.text}${host.files.length}${c.reset}`,
      `  size       ${c.text}${humanSize(bytes)}${c.reset}`,
      `  directory  ${c.text}/${host.cwd || ""}${c.reset}`,
      `  modified   ${c.text}${host.dirtyPaths.length}${c.reset} ${c.faint}unsaved${c.reset}`,
      "",
      ...languages.map(([language, count]) => `  ${c.cyan}${language.padEnd(12)}${c.reset} ${count}`),
    ];
  }
  if (sub === "theme") {
    const next = args[1];
    if (next !== "dark" && next !== "light") return error("Usage: hanre theme <dark|light>");
    host.setTheme(next);
    return [ok(`Switched to the ${next} theme.`)];
  }
  if (sub === "docs" || sub === "help") {
    return [
      `${c.purple}Hanre shortcuts${c.reset}`,
      `  ${c.cyan}Cmd/Ctrl + K${c.reset}   command palette`,
      `  ${c.cyan}Cmd/Ctrl + S${c.reset}   save the open file`,
      `  ${c.cyan}Cmd/Ctrl + Enter${c.reset} run the open file`,
      `  ${c.cyan}Cmd/Ctrl + \`${c.reset}   toggle the terminal`,
      `  ${c.cyan}Ctrl + Space${c.reset}  editor autocomplete (JS/TS)`,
    ];
  }
  if (sub === "version") return [`Hanre Studio ${c.text}1.0.0${c.reset} ${c.faint}— browser edition${c.reset}`];
  return error(`Unknown hanre command: ${sub}. Try stats, theme or docs.`);
}

function helpText() {
  const lines = [
    `${c.purple}Hanre Shell${c.reset} ${c.faint}— a safe place to poke around${c.reset}`,
    "",
    `${c.text}Files${c.reset}`,
    ...COMMANDS.slice(0, 7).map(([name, description]) => `  ${c.cyan}${name.padEnd(22)}${c.reset} ${c.dim}${description}${c.reset}`),
    "",
    `${c.text}Run${c.reset}`,
    ...COMMANDS.slice(7, 10).map(([name, description]) => `  ${c.cyan}${name.padEnd(22)}${c.reset} ${c.dim}${description}${c.reset}`),
    "",
    `${c.text}Workspace${c.reset}`,
    ...COMMANDS.slice(10).map(([name, description]) => `  ${c.cyan}${name.padEnd(22)}${c.reset} ${c.dim}${description}${c.reset}`),
    "",
    `${c.faint}Type help anytime. Commands run against this project only — nothing leaves your browser.${c.reset}`,
  ];
  return lines;
}

export async function executeCommand(raw: string, host: TerminalHost): Promise<CommandResult> {
  const input = raw.trim();
  if (!input) return { lines: [] };

  const args = parseArgs(input);
  const command = (args.shift() ?? "").toLowerCase();
  const cwd = host.cwd;

  const needFile = (target: string) => {
    const resolved = resolvePath(cwd, target);
    const file = findFile(host, resolved);
    if (!file) return { path: resolved, file: null as TerminalFile | null };
    return { path: resolved, file };
  };

  try {
    switch (command) {
      case "help":
      case "?":
        return { lines: helpText() };

      case "clear":
      case "cls":
        return { lines: [], clear: true };

      case "pwd":
        return { lines: [`/${cwd}`] };

      case "cd": {
        const target = args[0];
        if (!target || target === "~" || target === "/") {
          host.setCwd("");
          return { lines: [] };
        }
        const resolved = resolvePath(cwd, target);
        if (resolved && !isDir(host, resolved)) return { lines: error(`cd: no such directory: ${target}`) };
        host.setCwd(resolved);
        return { lines: [] };
      }

      case "ls":
      case "dir": {
        const flags = args.filter((arg) => arg.startsWith("-"));
        const target = args.find((arg) => !arg.startsWith("-"));
        const resolved = target ? resolvePath(cwd, target) : cwd;
        return { lines: dirList(host, resolved, flags) };
      }

      case "tree":
        return { lines: treeLines(host) };

      case "cat":
      case "less":
      case "more": {
        if (!args[0]) return { lines: error("usage: cat <file>") };
        const { path, file } = needFile(args[0]);
        if (!file) return { lines: error(`cat: ${args[0]}: no such file`) };
        const all = file.content.split("\n");
        const shown = all.slice(0, 120);
        const lines = shown.map((line) => `${c.text}${line}${c.reset}`);
        if (all.length > shown.length) {
          lines.push(`${c.faint}… ${all.length - shown.length} more lines. Open the file to read all of it.${c.reset}`);
        }
        return { lines };
      }

      case "open":
      case "edit": {
        if (!args[0]) return { lines: error("usage: open <file>") };
        const { file } = needFile(args[0]);
        if (!file) return { lines: error(`open: ${args[0]}: no such file`) };
        host.openFile(file.path);
        return { lines: [ok(`Opened ${c.text}${file.path}${c.reset} in the editor.`)] };
      }

      case "touch": {
        if (!args[0]) return { lines: error("usage: touch <file>") };
        const resolved = resolvePath(cwd, args[0]);
        if (!resolved) return { lines: error("touch: choose a file name.") };
        if (findFile(host, resolved)) return { lines: [`${c.dim}${resolved} already exists.${c.reset}`] };
        await host.createFile(resolved, "");
        return { lines: [ok(`Created ${c.text}${resolved}${c.reset}`)] };
      }

      case "mkdir": {
        if (!args[0]) return { lines: error("usage: mkdir <folder>[/.keep]") };
        const resolved = resolvePath(cwd, args[0]);
        await host.createFile(`${resolved}/.keep`, `# ${resolved.split("/").pop()}\n`);
        return { lines: [ok(`Created folder ${c.text}${resolved}/${c.reset}`)] };
      }

      case "rm":
      case "del": {
        if (!args[0]) return { lines: error("usage: rm <file>") };
        const { path, file } = needFile(args[0]);
        if (!file) return { lines: error(`rm: ${args[0]}: no such file`) };
        await host.deletePath(path);
        return { lines: [ok(`Deleted ${c.text}${path}${c.reset}`)] };
      }

      case "mv":
      case "rename": {
        if (args.length < 2) return { lines: error("usage: mv <from> <to>") };
        const from = resolvePath(cwd, args[0]);
        const to = resolvePath(cwd, args[1]);
        if (!isDir(host, from) && !findFile(host, from)) return { lines: error(`mv: ${args[0]}: no such file`) };
        await host.movePath(from, to);
        return { lines: [ok(`Moved ${c.text}${from}${c.reset} → ${c.text}${to}${c.reset}`)] };
      }

      case "echo": {
        const redirect = input.match(/\s(>>?)\s+(\S+)\s*$/);
        if (!redirect) {
          const text = input.replace(/^echo\s*/i, "").replace(/^["']|["']$/g, "");
          return { lines: [`${c.text}${text}${c.reset}`] };
        }
        const target = resolvePath(cwd, redirect[2].replace(/^["']|["']$/g, ""));
        const content = input
          .replace(/^echo\s*/i, "")
          .replace(/\s>>?\s+\S+\s*$/, "")
          .replace(/^["']|["']$/g, "");
        const existing = findFile(host, target);
        if (redirect[1] === ">>" && existing) {
          await host.writeFile(target, `${existing.content}${existing.content.endsWith("\n") ? "" : "\n"}${content}\n`);
          return { lines: [ok(`Appended a line to ${c.text}${target}${c.reset}`)] };
        }
        await host.createFile(target, `${content}\n`);
        return { lines: [ok(`Wrote ${c.text}${target}${c.reset}`)] };
      }

      case "run":
      case "node":
      case "nodejs":
      case "python":
      case "python3":
      case "tsx":
      case "deno": {
        if (!args[0]) return { lines: error(`usage: ${command} <file>`) };
        const { file } = needFile(args[0]);
        if (!file) return { lines: error(`${command}: ${args[0]}: no such file`) };
        const output = await host.runFile(file.path);
        return { lines: output.split("\n").map((line) => `${c.text}${line}${c.reset}`) };
      }

      case "git":
        return { lines: gitCommand(host, args) };

      case "npm":
      case "pnpm":
      case "yarn":
        return { lines: npmCommand(args) };

      case "hanre":
        return { lines: hanreCommand(host, args) };

      case "whoami":
        return {
          lines: [
            `${c.text}${host.userName}${c.reset} ${c.faint}· signed in to Hanre${c.reset}`,
            `${c.faint}workspace: ${host.projectName}${c.reset}`,
          ],
        };

      case "date":
        return { lines: [`${new Date().toUTCString()}`] };

      case "uname":
        return { lines: [`HanreOS ${c.faint}(browser)${c.reset} 1.0.0 ${processLikeArch()}`] };

      case "history":
        return {
          lines: host.history.length
            ? host.history.map((entry, index) => `${c.faint}${String(index + 1).padStart(3)}${c.reset}  ${c.text}${entry}${c.reset}`)
            : [`${c.dim}No history yet.${c.reset}`],
        };

      case "curl":
      case "wget":
      case "ssh":
      case "ping":
      case "telnet":
      case "nc":
        return {
          lines: [
            `${c.yellow}Network commands are disabled in the browser sandbox.${c.reset}`,
            `${c.dim}Fetching GitHub repositories happens through the Import page instead.${c.reset}`,
          ],
        };

      case "sudo":
        return {
          lines: [`${c.yellow}Nice try.${c.reset} ${c.dim}This sandbox is intentionally unprivileged — everything is already yours.${c.reset}`],
        };

      case "code":
        return { lines: [ok("The editor is already open. Use Cmd+K to jump to any file.")] };

      case "exit":
      case "logout":
        return {
          lines: [`${c.dim}The shell is a view, not a session. Close the terminal panel to hide it.${c.reset}`],
        };

      default:
        return {
          lines: [
            `${c.red}✗ command not found:${c.reset} ${c.text}${command}${c.reset}`,
            `${c.faint}Type ${c.reset}${c.cyan}help${c.reset}${c.faint} to see everything this shell can do.${c.reset}`,
          ],
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Command failed.";
    return { lines: error(message) };
  }
}

function processLikeArch() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Mac/i.test(ua)) return "arm64-apple";
  if (/Win/i.test(ua)) return "x86_64-windows";
  return "x86_64-browser";
}

export function promptLabel(host: Pick<TerminalHost, "projectName" | "cwd">) {
  const dir = host.cwd ? `/${host.cwd}` : "";
  return `${host.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}${dir}`;
}

export { resolvePath };
