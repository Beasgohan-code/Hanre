import type { ProjectFile } from "./types";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMd(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\b__([^_]+)__\b/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );
  return out;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let code: string[] | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMd(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${inlineMd(quote.join(" "))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line.trim())) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    const fence = line.trim().match(/^```(\w*)/);
    if (fence) {
      flushAll();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) {
      flushAll();
      html.push("<hr />");
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      flushQuote();
      if (list !== "ul") {
        flushList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inlineMd(unordered[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (list !== "ol") {
        flushList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inlineMd(ordered[1])}</li>`);
      continue;
    }
    if (/^\s{4,}\S/.test(line) && !paragraph.length) {
      flushAll();
      html.push(`<pre><code>${escapeHtml(line.replace(/^\s{4}/, ""))}</code></pre>`);
      continue;
    }
    flushQuote();
    paragraph.push(line.trim());
  }
  if (code !== null) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushAll();
  return html.join("\n");
}

const BRIDGE = `<script>
(function () {
  function send(type, payload) {
    try {
      parent.postMessage(Object.assign({ __hanre: true, type: type }, payload || {}), "*");
    } catch (error) {}
  }
  window.addEventListener("error", function (event) {
    send("error", { message: event.message || "Script error", line: event.lineno || 0 });
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    send("error", { message: String((reason && reason.message) || reason || "Unhandled rejection") });
  });
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      var message = Array.prototype.map.call(arguments, function (value) {
        if (typeof value === "string") return value;
        try { return JSON.stringify(value); } catch (error) { return String(value); }
      }).join(" ");
      send("console", { level: level, message: message });
      original.apply(null, arguments);
    };
  });
  send("ready", {});
})();
</script>`;

const MD_STYLES = `<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 56px 24px;
    background: #0b0d12; color: #e9ecf3;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.72;
  }
  .prose { max-width: 720px; margin: 0 auto; }
  .prose > :first-child { margin-top: 0; }
  h1, h2, h3, h4 { line-height: 1.25; letter-spacing: -0.02em; margin: 1.8em 0 0.6em; }
  h1 { font-size: 2.2rem; }
  h2 { font-size: 1.55rem; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: .35em; }
  h3 { font-size: 1.2rem; }
  p, li { color: #b9c0cd; }
  a { color: #a99cff; }
  code { background: rgba(255,255,255,.07); padding: .15em .4em; border-radius: 5px; font-size: .88em;
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; color: #d9d3ff; }
  pre { background: #0f1219; border: 1px solid rgba(255,255,255,.07); border-radius: 12px; padding: 18px;
    overflow: auto; }
  pre code { background: transparent; padding: 0; color: #cbd5e1; }
  blockquote { margin: 1.4em 0; padding: 4px 18px; border-left: 2px solid #8b7bff; color: #a5acba; }
  hr { border: 0; border-top: 1px solid rgba(255,255,255,.09); margin: 2em 0; }
  ul, ol { padding-left: 22px; }
  .stamp { max-width: 720px; margin: 48px auto 0; font-size: 11px; letter-spacing: .16em; color: #5b6272;
    text-transform: uppercase; }
</style>`;

const CSS_SAMPLE = `<div class="page">
  <header class="header">
    <span class="brand">Preview</span>
    <nav class="nav"><a href="#">Overview</a><a href="#">Activity</a><a href="#">Settings</a></nav>
  </header>
  <main class="main">
    <p class="eyebrow">STYLESHEET PREVIEW</p>
    <h1>Your styles, applied.</h1>
    <p class="lede">This sample page uses your stylesheet. Edit the CSS and the preview updates on the next run.</p>
    <div class="actions"><button class="button">Primary action</button><button class="button secondary">Secondary</button></div>
    <div class="cards">
      <article class="card"><h2>Card one</h2><p>Surfaces, borders, and text styles all come from your file.</p></article>
      <article class="card"><h2>Card two</h2><p>A second card to check spacing and rhythm.</p></article>
    </div>
    <form class="form"><label>Email<input type="email" placeholder="you@example.com" /></label></form>
  </main>
</div>`;

function inlineAssets(html: string, files: ProjectFile[]): string {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const find = (href: string): ProjectFile | undefined => {
    const clean = href.replace(/^\.\//, "").split("?")[0].split("#")[0];
    return byPath.get(clean) ?? byPath.get(clean.split("/").pop() ?? "");
  };

  let output = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !/\.css($|\?)/i.test(href)) return tag;
    const file = find(href);
    return file ? `<style data-hanre-file="${escapeHtml(file.path)}">\n${file.content}\n</style>` : tag;
  });

  output = output.replace(
    /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      if (!/\.m?js($|\?)/i.test(src)) return tag;
      const file = find(src);
      if (!file) return tag;
      return `<script${before}${after}>\n${file.content}\n</script>`;
    },
  );

  return output;
}

function inject(html: string, snippet: string, title: string): string {
  let output = html;
  if (!/<base\b/i.test(output)) {
    output = /<head[^>]*>/i.test(output)
      ? output.replace(/<head([^>]*)>/i, `<head$1>\n<base target="_blank" />\n<title>${escapeHtml(title)}</title>`)
      : `<head><base target="_blank" />\n<title>${escapeHtml(title)}</title></head>\n${output}`;
  }
  if (/<\/head>/i.test(output)) return output.replace(/<\/head>/i, `${snippet}\n</head>`);
  if (/<body[^>]*>/i.test(output)) return output.replace(/<body([^>]*)>/i, `<body$1>\n${snippet}`);
  return snippet + output;
}

export interface PreviewResult {
  html: string;
  title: string;
  kind: "html" | "markdown" | "css";
  entry: string;
}

export function buildCssPreview(css: string, name: string): PreviewResult {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body>${CSS_SAMPLE}</body></html>`;
  return {
    html: inject(html, BRIDGE, name + " · preview"),
    title: name,
    kind: "css",
    entry: name,
  };
}

export function buildMarkdownPreview(markdown: string, name: string): PreviewResult {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />${MD_STYLES}</head><body><article class="prose">${markdownToHtml(markdown)}</article><p class="stamp">Rendered from ${escapeHtml(name)}</p></body></html>`;
  return {
    html: inject(html, BRIDGE, name),
    title: name,
    kind: "markdown",
    entry: name,
  };
}

export function buildPreview(files: ProjectFile[], entryPath?: string): PreviewResult | null {
  const htmlFiles = files.filter((file) => file.language === "html" || /\.html?$/i.test(file.path));
  let entry = htmlFiles.find((file) => file.path === entryPath);
  if (!entry) entry = htmlFiles.find((file) => file.path.toLowerCase() === "index.html");
  if (!entry) entry = htmlFiles[0];

  if (entry) {
    const html = inject(inlineAssets(entry.content, files), BRIDGE, entry.path);
    return { html, title: entry.path, kind: "html", entry: entry.path };
  }

  const markdown = files.find((file) => file.path === entryPath && file.language === "markdown")
    ?? files.find((file) => file.language === "markdown");
  if (markdown) return buildMarkdownPreview(markdown.content, markdown.path);

  const css = files.find((file) => file.path === entryPath && file.language === "css")
    ?? files.find((file) => file.language === "css");
  if (css) return buildCssPreview(css.content, css.path);

  return null;
}
