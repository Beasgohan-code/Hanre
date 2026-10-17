import type { ProjectFile } from "./types";
import { buildCssPreview, buildMarkdownPreview, buildPreview, type PreviewResult } from "./preview";

export interface RunResult {
  status: "success" | "error" | "unsupported";
  output: string;
  durationMs: number;
  preview?: PreviewResult | null;
}

export type StatusHandler = (message: string) => void;

const JS_WORKER = [
  "self.onmessage = async function (event) {",
  "  var code = event.data.code;",
  "  function format(value) {",
  "    if (typeof value === 'string') return value;",
  "    if (value instanceof Error) return value.name + ': ' + value.message;",
  "    if (typeof value === 'undefined') return 'undefined';",
  "    if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']';",
  "    try { return JSON.stringify(value, null, 2); } catch (error) { return String(value); }",
  "  }",
  "  function send(payload) { self.postMessage(payload); }",
  "  function print(level, args) {",
  "    var line = Array.prototype.map.call(args, format).join(' ');",
  "    send({ type: 'log', level: level, line: line });",
  "  }",
  "  function table(rows) {",
  "    var list = Array.isArray(rows) ? rows : [rows];",
  "    if (!list.length) { print('log', ['(empty table)']); return; }",
  "    if (typeof list[0] !== 'object' || list[0] === null) { print('log', list); return; }",
  "    var keys = Object.keys(list[0]);",
  "    var widths = keys.map(function (key) {",
  "      return Math.max(key.length, Math.max.apply(null, list.map(function (row) { return String(row[key]).length; })));",
  "    });",
  "    var header = keys.map(function (key, i) { return key.padEnd(widths[i]); }).join(' | ');",
  "    var divider = widths.map(function (w) { return '-'.repeat(w); }).join('-+-');",
  "    print('log', [header]);",
  "    print('log', [divider]);",
  "    list.forEach(function (row) {",
  "      print('log', [keys.map(function (key, i) { return String(row[key]).padEnd(widths[i]); }).join(' | ')]);",
  "    });",
  "  }",
  "  var sandboxConsole = {",
  "    log: function () { print('log', arguments); },",
  "    info: function () { print('info', arguments); },",
  "    debug: function () { print('debug', arguments); },",
  "    warn: function () { print('warn', arguments); },",
  "    error: function () { print('error', arguments); },",
  "    table: table,",
  "    dir: function (value) { print('log', [value]); },",
  "    group: function () {}, groupEnd: function () {}, time: function () {}, timeEnd: function () {},",
  "    assert: function (condition, message) { if (!condition) print('error', ['Assertion failed: ' + (message || '')]); }",
  "  };",
  "  try {",
  "    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;",
  "    var fn = new AsyncFunction('console', 'performance', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'structuredClone', code);",
  "    var result = await fn(sandboxConsole, performance, setTimeout.bind(self), clearTimeout.bind(self), queueMicrotask.bind(self), structuredClone);",
  "    if (result !== undefined) print('log', [result]);",
  "    send({ type: 'done' });",
  "  } catch (error) {",
  "    var name = error && error.name ? error.name : 'Error';",
  "    var message = error && error.message ? error.message : String(error);",
  "    var stack = error && error.stack ? String(error.stack) : '';",
  "    send({ type: 'failure', name: name, message: message, stack: stack });",
  "  }",
  "};",
].join("\n");

function cleanStack(stack: string, name: string, message: string) {
  const lines = stack.split("\n").map((line) => line.trim());
  const filtered = lines.filter(
    (line) =>
      line &&
      !line.startsWith("at new AsyncFunction") &&
      !/^at (async )?eval/.test(line) &&
      (line.includes("hanre-user-code") || /^at .*\(.*:\d+:\d+\)$/.test(line)),
  );
  const formatted = [`${name}: ${message}`, ...filtered.slice(0, 4).map((line) => `    ${line}`)];
  return formatted.join("\n");
}

async function executeJavaScript(
  code: string,
  timeoutMs = 6000,
): Promise<{ output: string; failed: boolean; durationMs: number }> {
  const started = performance.now();
  const blob = new Blob([JS_WORKER], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  return new Promise((resolve) => {
    const logs: string[] = [];
    let settled = false;
    const finish = (failed: boolean, extra?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (extra) logs.push(extra);
      const output = logs.join("\n").slice(0, 24000);
      resolve({
        output: output || (failed ? "✖ Execution failed." : "✓ Finished with no console output."),
        failed,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      });
    };

    const timer = window.setTimeout(() => {
      finish(true, `\n✖ Timed out after ${timeoutMs / 1000}s. Infinite loops are stopped automatically.`);
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: "log"; line: string; level: string }
        | { type: "done" }
        | { type: "failure"; name: string; message: string; stack: string };
      if (data.type === "log") {
        if (logs.length < 600) logs.push(data.line);
        return;
      }
      if (data.type === "done") {
        finish(false);
        return;
      }
      if (data.type === "failure") {
        finish(true, cleanStack(data.stack, data.name, data.message));
      }
    };

    worker.onerror = (event) => {
      finish(true, `✖ ${event.message || "The script could not be started."}`);
    };

    worker.postMessage({ code: `${code}\n//# sourceURL=hanre-user-code.js` });
  });
}

const PYODIDE_VERSION = "v0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<PyodideLike> | null = null;

interface PyodideLike {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
  globals: { set: (key: string, value: unknown) => void };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-hanre-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.hanreSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not download the Python runtime."));
    document.head.appendChild(script);
  });
}

async function getPyodide(onStatus?: StatusHandler): Promise<PyodideLike> {
  if (pyodidePromise) return pyodidePromise;
  onStatus?.("Loading the Python runtime (about 10 MB, cached after the first run)…");
  pyodidePromise = (async () => {
    const globalWindow = window as unknown as { loadPyodide?: (options: { indexURL: string }) => Promise<PyodideLike> };
    if (!globalWindow.loadPyodide) {
      await loadScript(PYODIDE_CDN + "pyodide.js");
    }
    if (!globalWindow.loadPyodide) throw new Error("The Python runtime did not start.");
    return globalWindow.loadPyodide({ indexURL: PYODIDE_CDN });
  })().catch((error) => {
    pyodidePromise = null;
    throw error;
  });
  return pyodidePromise;
}

function pythonError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lines = raw.split("\n").filter((line) => line.trim() && !line.includes("pyodide/_base.py"));
  return lines.slice(-14).join("\n");
}

function bulletReport(label: string, result: { output: string; failed: boolean; durationMs: number }) {
  const status = result.failed ? "✖ Error" : "✓ Success";
  return {
    status: result.failed ? ("error" as const) : ("success" as const),
    output: result.output || "(no output)",
    durationMs: result.durationMs,
  };
}

const SQL_DEMO = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, placed_at TEXT);
CREATE TABLE sales (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, sold_at TEXT);
INSERT INTO customers VALUES (1, 'Aarav Textiles', 'Kerala'), (2, 'Meera Traders', 'Karnataka'),
  (3, 'Nila Foods', 'Tamil Nadu'), (4, 'Kite Studio', 'Maharashtra'),
  (5, 'Octave Labs', 'Delhi NCR'), (6, 'Fern & Co', 'Others');
INSERT INTO orders VALUES
  (1, 1, 1240.0, date('now', '-9 months')), (2, 1, 880.0, date('now', '-4 months')),
  (3, 2, 2310.0, date('now', '-7 months')), (4, 2, 640.0, date('now', '-1 months')),
  (5, 3, 3120.0, date('now', '-6 months')), (6, 3, 1450.0, date('now', '-2 months')),
  (7, 4, 980.0, date('now', '-5 months')), (8, 4, 2760.0, date('now', '-1 months')),
  (9, 5, 1640.0, date('now', '-8 months')), (10, 5, 1990.0, date('now', '-3 months')),
  (11, 6, 720.0, date('now', '-10 months')), (12, 6, 1100.0, date('now', '-2 months'));
INSERT INTO sales (customer_id, amount, sold_at)
  SELECT customer_id, amount, placed_at FROM orders;
`;

const SQL_PYTHON = [
  "import sqlite3",
  "sql = __hanre_sql",
  "conn = sqlite3.connect(':memory:')",
  "if 'create table' not in sql.lower():",
  "    conn.executescript(__hanre_demo)",
  "cur = conn.cursor()",
  "errors = 0",
  "buffer = ''",
  "count = 0",
  "",
  "def emit(statement):",
  "    global errors",
  "    try:",
  "        cur.execute(statement)",
  "        if cur.description:",
  "            columns = [d[0] for d in cur.description]",
  "            rows = cur.fetchmany(50)",
  "            widths = [len(str(c)) for c in columns]",
  "            for row in rows:",
  "                for i, value in enumerate(row):",
  "                    widths[i] = max(widths[i], len(str(value)))",
  "            print(' '.join(str(c).ljust(widths[i]) for i, c in enumerate(columns)))",
  "            print('-+-'.join('-' * w for w in widths))",
  "            for row in rows:",
  "                print(' | '.join(str(v).ljust(widths[i]) for i, v in enumerate(row)))",
  "            if len(rows) == 50:",
  "                print('(first 50 rows shown)')",
  "        else:",
  "            print('OK · ' + statement.split()[0].upper() + ' applied')",
  "    except Exception as error:",
  "        errors += 1",
  "        print('SQL error: ' + str(error))",
  "",
  "for line in sql.splitlines(True):",
  "    buffer += line",
  "    if sqlite3.complete_statement(buffer):",
  "        statement = buffer.strip()",
  "        buffer = ''",
  "        if statement:",
  "            count += 1",
  "            print('')",
  "            print('Query ' + str(count))",
  "            emit(statement)",
  "if buffer.strip():",
  "    count += 1",
  "    print('')",
  "    print('Query ' + str(count))",
  "    emit(buffer.strip())",
  "print('')",
  "print('SQLite · ' + str(count) + ' statement(s) · in-browser database')",
  "print('__HANRE_SQL_ERRORS__:' + str(errors))",
].join("\n");

async function executeSQL(code: string, onStatus?: StatusHandler) {
  const started = performance.now();
  const py = await getPyodide(onStatus);
  onStatus?.("Running SQL with in-browser SQLite…");
  const out: string[] = [];
  py.setStdout({ batched: (text) => out.push(text) });
  py.setStderr({ batched: (text) => out.push(text) });
  py.globals.set("__hanre_sql", code);
  py.globals.set("__hanre_demo", SQL_DEMO);
  let failed = false;
  try {
    await py.runPythonAsync(SQL_PYTHON);
  } catch (error) {
    failed = true;
    out.push(pythonError(error));
  }
  const text = out.join("\n").replace(/__HANRE_SQL_ERRORS__:(\d+)\s*$/m, (_match, count: string) => {
    if (Number(count) > 0) failed = true;
    return "";
  }).trim();
  return {
    status: failed ? ("error" as const) : ("success" as const),
    output: text || "(no output)",
    durationMs: Math.max(1, Math.round(performance.now() - started)),
  };
}

async function executePython(file: ProjectFile, onStatus?: StatusHandler) {
  const started = performance.now();
  const py = await getPyodide(onStatus);
  onStatus?.("Running Python…");
  const out: string[] = [];
  py.setStdout({ batched: (text) => out.push(text) });
  py.setStderr({ batched: (text) => out.push(text) });
  py.globals.set("__hanre_source", file.content);
  py.globals.set("__hanre_name", file.name);
  let failed = false;
  try {
    await py.runPythonAsync(
      'exec(compile(__hanre_source, __hanre_name, "exec"), {"__name__": "__main__"})',
    );
  } catch (error) {
    failed = true;
    out.push(pythonError(error));
  }
  const output = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    status: failed ? ("error" as const) : ("success" as const),
    output: output || "(no output)",
    durationMs: Math.max(1, Math.round(performance.now() - started)),
  };
}

export async function runFile(
  file: ProjectFile,
  files: ProjectFile[],
  onStatus?: StatusHandler,
): Promise<RunResult> {
  const language = file.language;
  const started = performance.now();

  if (language === "html") {
    const preview = buildPreview(files, file.path);
    return {
      status: preview ? "success" : "error",
      output: preview
        ? "✓ Preview rendered. Stylesheets and scripts on this page were inlined.\nConsole errors from the page appear in the Console tab."
        : "No HTML file was found to preview.",
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      preview,
    };
  }

  if (language === "css") {
    const preview = buildCssPreview(file.content, file.path);
    return {
      status: "success",
      output: "✓ Stylesheet applied to a sample page. Switch to the Preview tab to inspect it.",
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      preview,
    };
  }

  if (language === "markdown") {
    const preview = buildMarkdownPreview(file.content, file.path);
    return {
      status: "success",
      output: "✓ Markdown rendered. Switch to the Preview tab to read it.",
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      preview,
    };
  }

  if (language === "json") {
    try {
      const parsed = JSON.parse(file.content);
      return {
        status: "success",
        output: `✓ Valid JSON · ${file.content.length.toLocaleString()} characters\n\n${JSON.stringify(parsed, null, 2).slice(0, 8000)}`,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      };
    } catch (error) {
      return {
        status: "error",
        output: `✖ Invalid JSON\n\n${error instanceof Error ? error.message : String(error)}`,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      };
    }
  }

  if (language === "javascript") {
    const result = await executeJavaScript(file.content);
    return { ...bulletReport("JavaScript", result), preview: null };
  }

  if (language === "typescript") {
    onStatus?.("Compiling TypeScript…");
    try {
      const { transform } = await import("sucrase");
      const compiled = transform(file.content, { transforms: ["typescript"] }).code;
      const result = await executeJavaScript(compiled);
      return bulletReport("TypeScript", result);
    } catch (error) {
      return {
        status: "error",
        output: `✖ TypeScript compilation failed\n\n${error instanceof Error ? error.message : String(error)}`,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      };
    }
  }

  if (language === "python") {
    try {
      return await executePython(file, onStatus);
    } catch (error) {
      return {
        status: "error",
        output: `✖ Python runtime unavailable\n\n${error instanceof Error ? error.message : String(error)}`,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      };
    }
  }

  if (language === "sql") {
    try {
      return await executeSQL(file.content, onStatus);
    } catch (error) {
      return {
        status: "error",
        output: `✖ SQL runtime unavailable\n\n${error instanceof Error ? error.message : String(error)}`,
        durationMs: Math.max(1, Math.round(performance.now() - started)),
      };
    }
  }

  const friendly: Record<string, string> = {
    shell: "Shell files are documentation here. Use the Terminal tab for real commands.",
    cpp: "C++ needs a native compiler. Hanre runs JavaScript, TypeScript, Python, HTML/CSS, Markdown, JSON, and SQL in the browser.",
    rust: "Rust needs a native compiler. Try Python or JavaScript for an instant run in your browser.",
    java: "Java needs a JVM. Try Python or JavaScript for an instant run in your browser.",
    php: "PHP needs a server runtime. Try JavaScript or Python instead.",
    yaml: "YAML files are for configuration. Use the editor to validate indentation.",
    plaintext: "This file type cannot be executed. Rename it to .js, .py, .html, .css, .md, .json, or .sql to run it.",
  };

  return {
    status: "unsupported",
    output: friendly[language] ?? "This file type cannot be executed in the browser yet.",
    durationMs: 0,
    preview: null,
  };
}
