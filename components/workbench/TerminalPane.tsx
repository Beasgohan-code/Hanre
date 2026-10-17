"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { ProjectFile } from "@/lib/types";
import { executeCommand, type TerminalHost } from "@/lib/terminal";

export interface TerminalHandle {
  clear: () => void;
  focus: () => void;
}

interface Props {
  projectName: string;
  userName: string;
  cwd: string;
  setCwd: (path: string) => void;
  files: ProjectFile[];
  dirtyPaths: string[];
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  openFile: (path: string) => void;
  runFile: (path: string) => Promise<string>;
  createFile: (path: string, content?: string) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  deletePath: (path: string) => Promise<void>;
  movePath: (from: string, to: string) => Promise<void>;
}

const COMMANDS = [
  "help", "ls", "cd", "pwd", "cat", "tree", "touch", "rm", "mv", "open", "run",
  "node", "python", "echo", "git", "npm", "hanre", "whoami", "date", "uname",
  "history", "clear",
];

function xtermTheme(theme: "dark" | "light") {
  if (theme === "light") {
    return {
      background: "#f4f2ec",
      foreground: "#3a352c",
      cursor: "#6d5ae6",
      cursorAccent: "#f4f2ec",
      selectionBackground: "rgba(109, 90, 230, 0.2)",
      black: "#3a352c",
      red: "#b31d38",
      green: "#0f8f7d",
      yellow: "#9a6600",
      blue: "#2563eb",
      magenta: "#6d5ae6",
      cyan: "#0e7490",
      white: "#e8e3d8",
      brightBlack: "#8a8274",
    };
  }
  return {
    background: "#0a0c12",
    foreground: "#c9cfdb",
    cursor: "#a394ff",
    cursorAccent: "#0a0c12",
    selectionBackground: "rgba(139, 123, 255, 0.28)",
    black: "#0a0c12",
    red: "#fb7185",
    green: "#5eead4",
    yellow: "#fbbf24",
    blue: "#60a5fa",
    magenta: "#c4b5fd",
    cyan: "#67e8f9",
    white: "#d5dae4",
    brightBlack: "#5a6274",
  };
}

const TerminalPane = forwardRef<TerminalHandle, Props>(function TerminalPane(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const propsRef = useRef(props);
  const inputRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const cwdRef = useRef(props.cwd);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);
  propsRef.current = props;

  useEffect(() => {
    cwdRef.current = props.cwd;
  }, [props.cwd]);

  useImperativeHandle(ref, () => ({
    clear() {
      termRef.current?.clear();
    },
    focus() {
      termRef.current?.focus();
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const [{ Terminal: Xterm }, { FitAddon: Fit }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;
      terminal = new Xterm({
        fontFamily: '"JetBrains Mono Variable", ui-monospace, "SFMono-Regular", monospace',
        fontSize: 11.5,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: "bar",
        convertEol: true,
        scrollback: 3000,
        theme: xtermTheme(propsRef.current.theme),
        allowProposedApi: true,
      });
      fitAddon = new Fit();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      termRef.current = terminal;
      fitRef.current = fitAddon;
      setReady(true);
      try {
        fitAddon.fit();
      } catch {
        /* container not measurable yet */
      }

      const prompt = () => {
        if (!terminal) return;
        const cwd = cwdRef.current;
        const display = cwd === "/" ? "~" : cwd;
        const name = propsRef.current.projectName;
        terminal.write(
          `\x1b[38;5;141m${name}\x1b[0m \x1b[2m${display}\x1b[0m \x1b[38;5;79m❯\x1b[0m `,
        );
      };

      const redraw = () => {
        if (!terminal) return;
        terminal.write("\r\x1b[2K");
        prompt();
        terminal.write(inputRef.current);
      };

      const buildHost = (): TerminalHost => ({
        projectName: propsRef.current.projectName,
        userName: propsRef.current.userName,
        cwd: cwdRef.current,
        get files() {
          return propsRef.current.files;
        },
        history: historyRef.current,
        dirtyPaths: propsRef.current.dirtyPaths,
        setCwd: (path) => {
          cwdRef.current = path;
          propsRef.current.setCwd(path);
        },
        createFile: propsRef.current.createFile,
        writeFile: propsRef.current.writeFile,
        deletePath: propsRef.current.deletePath,
        movePath: propsRef.current.movePath,
        runFile: propsRef.current.runFile,
        openFile: propsRef.current.openFile,
        clearScreen: () => terminal?.clear(),
        setTheme: propsRef.current.setTheme,
      });

      const submit = async () => {
        if (!terminal) return;
        const command = inputRef.current;
        inputRef.current = "";
        terminal.write("\r\n");
        if (!command.trim()) {
          prompt();
          return;
        }
        historyRef.current.push(command);
        historyIndexRef.current = historyRef.current.length;
        busyRef.current = true;
        try {
          const result = await executeCommand(command, buildHost());
          if (result.clear) {
            terminal.clear();
          } else {
            result.lines.forEach((line) => terminal?.writeln(line));
          }
        } catch (error) {
          terminal.writeln(`\x1b[38;5;203m✖ ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
        } finally {
          busyRef.current = false;
          prompt();
        }
      };

      const complete = () => {
        if (!terminal) return;
        const line = inputRef.current;
        const tokens = line.split(/\s+/);
        const last = tokens[tokens.length - 1] ?? "";
        const atStart = tokens.length <= 1;
        const pool = atStart
          ? COMMANDS
          : propsRef.current.files.map((file) => file.path);
        const matches = pool.filter((candidate) => candidate.startsWith(last));
        if (!matches.length) return;
        if (matches.length === 1) {
          const remainder = matches[0].slice(last.length);
          inputRef.current += remainder;
          terminal.write(remainder);
          return;
        }
        const common = matches.reduce((prefix, candidate) => {
          let index = 0;
          while (index < prefix.length && index < candidate.length && prefix[index] === candidate[index]) {
            index += 1;
          }
          return prefix.slice(0, index);
        }, matches[0]);
        if (common.length > last.length) {
          const remainder = common.slice(last.length);
          inputRef.current += remainder;
          terminal.write(remainder);
          return;
        }
        terminal.write("\r\n");
        terminal.writeln(`\x1b[2m${matches.slice(0, 24).join("   ")}\x1b[0m`);
        redraw();
      };

      const handleData = (data: string) => {
        if (!terminal) return;
        if (data.includes("\r") && data.length > 1) {
          const parts = data.split(/\r/);
          parts.forEach((part, index) => {
            const printable = part.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
            if (printable) {
              inputRef.current += printable;
              terminal?.write(printable);
            }
            if (index < parts.length - 1) {
              void submit();
            }
          });
          return;
        }
        if (busyRef.current) return;
        if (data === "\r") {
          void submit();
          return;
        }
        if (data === "\u007f") {
          if (inputRef.current.length > 0) {
            inputRef.current = inputRef.current.slice(0, -1);
            terminal.write("\b \b");
          }
          return;
        }
        if (data === "\t") {
          complete();
          return;
        }
        if (data === "\u0003") {
          terminal.write("^C\r\n");
          inputRef.current = "";
          prompt();
          return;
        }
        if (data === "\u000c") {
          terminal.clear();
          prompt();
          return;
        }
        if (data === "\u001b[A") {
          if (!historyRef.current.length) return;
          historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
          inputRef.current = historyRef.current[historyIndexRef.current] ?? "";
          redraw();
          return;
        }
        if (data === "\u001b[B") {
          if (!historyRef.current.length) return;
          historyIndexRef.current = Math.min(historyRef.current.length, historyIndexRef.current + 1);
          inputRef.current = historyRef.current[historyIndexRef.current] ?? "";
          redraw();
          return;
        }
        if (data.startsWith("\u001b")) return;
        const printable = data.replace(/[\u0000-\u001f\u007f]/g, "");
        if (printable) {
          inputRef.current += printable;
          terminal.write(printable);
        }
      };

      terminal.writeln("\x1b[38;5;141m  ◆ Hanre Shell\x1b[0m \x1b[2m· a real shell over your workspace\x1b[0m");
      terminal.writeln(`\x1b[2m  ${propsRef.current.projectName} · type "help" for commands, "tree" to explore\x1b[0m`);
      terminal.writeln("");
      prompt();
      terminal.onData(handleData);

      const container = containerRef.current;
      const focusTerminal = () => terminal?.focus();
      container?.addEventListener("mousedown", focusTerminal);

      observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon?.fit();
          } catch {
            /* ignore hidden containers */
          }
        });
      });
      observer.observe(container);
      terminal.focus();

      return () => {
        container?.removeEventListener("mousedown", focusTerminal);
      };
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      terminal?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = xtermTheme(props.theme);
    }
  }, [props.theme]);

  return (
    <div className="term-host" style={{ position: "relative" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--faint)",
            fontSize: 11,
            background: "var(--code-bg)",
          }}
        >
          starting shell…
        </div>
      )}
    </div>
  );
});

export default TerminalPane;
