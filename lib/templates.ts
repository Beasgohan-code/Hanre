export interface TemplateFile {
  path: string;
  content: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  icon: string;
  files: TemplateFile[];
}

const webIndex = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New site</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="page">
    <p class="eyebrow">NEW PROJECT</p>
    <h1>Start something small.</h1>
    <p class="lede">Edit this page, add a stylesheet rule, and watch the preview update.</p>
    <button id="greet">Say hello</button>
    <p id="message"></p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const webCss = `:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #f2f0ff;
  background:
    radial-gradient(50vw 50vw at 15% 0%, rgba(139, 123, 255, 0.35), transparent 60%),
    #0a0c10;
}
.page {
  width: min(560px, calc(100% - 40px));
  padding: 44px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
}
.eyebrow { margin: 0 0 12px; font-size: 11px; letter-spacing: 0.22em; color: #5eead4; }
h1 { margin: 0 0 14px; font-size: 36px; letter-spacing: -0.03em; }
.lede { margin: 0 0 24px; color: #a5acba; line-height: 1.7; font-size: 14px; }
button {
  border: 0; border-radius: 10px; padding: 12px 20px;
  font: inherit; font-weight: 600; font-size: 13px;
  color: #12082b; background: #c4b5fd; cursor: pointer;
}
button:hover { filter: brightness(1.06); }
`;

const webJs = `const button = document.getElementById("greet");
const message = document.getElementById("message");

button.addEventListener("click", () => {
  message.textContent = "Hello from Hanre — " + new Date().toLocaleTimeString();
});
`;

const nodeJs = `// Start here. Run with Cmd/Ctrl + Enter.

console.log("Hello from a new Node-style project.");

const items = ["write", "run", "share"];

items.forEach((item, index) => {
  console.log("  " + (index + 1) + ". " + item);
});
`;

const pythonMain = `"""Your new Python project.

Press Cmd/Ctrl + Enter to run it in the browser.
"""

def greet(name: str = "world") -> str:
    return f"Hello, {name}!"


if __name__ == "__main__":
    print(greet())
    print("Edit this file and run it again.")
`;

const readme = `# Project

A fresh Hanre project.

## Files

- Start editing in the main file.
- Press Cmd/Ctrl + Enter to run.
- Press Cmd/Ctrl + S to save.
`;

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "An empty canvas with a README.",
    language: "plaintext",
    icon: "file",
    files: [{ path: "README.md", content: readme }],
  },
  {
    id: "web",
    name: "Web page",
    description: "HTML, CSS, and JavaScript with a live preview.",
    language: "html",
    icon: "globe",
    files: [
      { path: "index.html", content: webIndex },
      { path: "styles.css", content: webCss },
      { path: "app.js", content: webJs },
    ],
  },
  {
    id: "node",
    name: "JavaScript",
    description: "A runnable script with console output.",
    language: "javascript",
    icon: "terminal",
    files: [
      { path: "index.js", content: nodeJs },
      { path: "README.md", content: readme },
    ],
  },
  {
    id: "python",
    name: "Python",
    description: "Python in the browser, no install required.",
    language: "python",
    icon: "braces",
    files: [
      { path: "main.py", content: pythonMain },
      { path: "README.md", content: readme },
    ],
  },
  {
    id: "data",
    name: "Data notebook",
    description: "Python analysis plus a SQL scratchpad.",
    language: "python",
    icon: "chart",
    files: [
      { path: "analysis.py", content: pythonMain.replace("Your new Python project.", "A small data notebook.") },
      { path: "queries.sql", content: "-- Explore your data\nSELECT 1 + 1 AS answer;\n" },
      { path: "README.md", content: readme },
    ],
  },
  {
    id: "docs",
    name: "Docs",
    description: "Markdown with a rendered preview.",
    language: "markdown",
    icon: "book",
    files: [
      {
        path: "README.md",
        content: "# Project documentation\n\nWrite your docs in Markdown.\n\n## Overview\n\n- What it does\n- Who it is for\n- How to run it\n\n## Notes\n\nPress Run to see the rendered page.\n",
      },
    ],
  },
];

export function findTemplate(id: string): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
