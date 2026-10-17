import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();

function hash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

const DEFAULT_PREFS = JSON.stringify({
  theme: "dark",
  editorFontSize: 14,
  tabSize: 2,
  wordWrap: false,
  autosave: true,
  lineNumbers: true,
  accent: "violet",
});

type SeedProject = {
  name: string;
  description: string;
  language: string;
  color: string;
  source: string;
  files: { path: string; content: string; isDir?: boolean }[];
  ageDays: number;
};

const AURORA_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aurora Notes</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="app">
    <header class="app__header">
      <div>
        <p class="eyebrow">HANRE STARTER &middot; WEB</p>
        <h1>Aurora Notes</h1>
        <p class="lede">A calm place for quick thoughts. Everything stays in your browser.</p>
      </div>
      <span class="pill"><span class="dot"></span> local-first</span>
    </header>

    <form id="note-form" class="composer">
      <input id="note-title" type="text" placeholder="What is on your mind?" autocomplete="off" required />
      <button type="submit">Add note</button>
    </form>

    <section class="tools">
      <input id="search" type="search" placeholder="Search notes" aria-label="Search notes" />
      <span id="count" class="count">0 notes</span>
    </section>

    <ul id="notes" class="notes"></ul>
    <p id="empty" class="empty">Nothing here yet &#8212; add your first note above.</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const AURORA_CSS = `:root {
  color-scheme: dark;
  --bg: #09060f;
  --ink: #f5f1ff;
  --muted: #a79cc4;
  --line: rgba(255, 255, 255, 0.09);
  --card: rgba(255, 255, 255, 0.045);
  --accent: #c4b5fd;
  --mint: #5eead4;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  padding: 56px 20px;
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  background:
    radial-gradient(55vw 55vw at 8% -10%, rgba(124, 58, 237, 0.45), transparent 62%),
    radial-gradient(48vw 48vw at 108% 8%, rgba(45, 212, 191, 0.2), transparent 60%),
    var(--bg);
  display: flex;
  justify-content: center;
}

.app {
  width: min(640px, 100%);
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--mint);
}

h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(38px, 7vw, 56px);
  letter-spacing: -0.03em;
  line-height: 1;
  background: linear-gradient(100deg, #fff 20%, #c4b5fd 60%, #5eead4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lede {
  color: var(--muted);
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.6;
}

.app__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 11px;
  color: var(--muted);
  background: var(--card);
  backdrop-filter: blur(12px);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mint);
  box-shadow: 0 0 12px var(--mint);
}

.composer {
  display: flex;
  gap: 10px;
  margin: 32px 0 14px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}

.composer input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  padding: 10px 12px;
  outline: none;
}

.composer input::placeholder { color: #8a7fa8; }

.composer button {
  border: 0;
  border-radius: 10px;
  padding: 0 18px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  color: #14082a;
  background: linear-gradient(180deg, #ddd3ff, #b8a5ff);
  cursor: pointer;
  transition: transform 150ms ease, filter 150ms ease;
}

.composer button:hover { transform: translateY(-1px); filter: brightness(1.05); }

.tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.tools input {
  width: 100%;
  border: 1px solid transparent;
  border-bottom-color: var(--line);
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  padding: 8px 2px;
  outline: none;
}

.tools input:focus { border-bottom-color: var(--accent); }

.count { flex: none; font-size: 12px; color: var(--muted); }

.notes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.note {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  backdrop-filter: blur(16px);
  animation: lift 260ms ease both;
}

.note__check {
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: transparent;
  font-size: 11px;
}

.note.done .note__check {
  background: var(--mint);
  border-color: var(--mint);
  color: #062820;
}

.note__body { flex: 1; min-width: 0; }

.note__title {
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.note.done .note__title { color: var(--muted); text-decoration: line-through; }

.note__meta { margin-top: 4px; font-size: 11px; color: #857a9e; }

.note__delete {
  border: 0;
  background: transparent;
  color: #7d7297;
  font: inherit;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}

.note__delete:hover { color: #fda4af; background: rgba(253, 164, 175, 0.08); }

.empty {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: 32px 0;
  border: 1px dashed var(--line);
  border-radius: 14px;
}

@keyframes lift {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 560px) {
  .app__header { flex-direction: column; }
  .composer { flex-direction: column; }
  .composer button { padding: 12px; }
}
`;

const AURORA_JS = `// Aurora Notes — a tiny local-first notes app.
// Try editing the styles, then hit Run to preview the page.

var STORAGE_KEY = 'aurora-notes-v1';

var sampleNotes = [
  { id: 'n1', title: 'Sketch the onboarding flow', done: false, createdAt: Date.now() - 86400000 },
  { id: 'n2', title: 'Read The Pragmatic Programmer, chapter 4', done: true, createdAt: Date.now() - 43200000 },
  { id: 'n3', title: 'Try the Hanre terminal with: tree', done: false, createdAt: Date.now() - 7200000 }
];

var state = { notes: load(), query: '' };

function load() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : sampleNotes.slice();
  } catch (error) {
    return sampleNotes.slice();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
  } catch (error) {
    // Storage can be unavailable in sandboxed previews.
  }
}

function relativeTime(ts) {
  var minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  var hours = Math.round(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return new Date(ts).toLocaleDateString();
}

function render() {
  var list = document.getElementById('notes');
  var empty = document.getElementById('empty');
  var count = document.getElementById('count');
  var query = state.query.toLowerCase();
  var visible = state.notes.filter(function (note) {
    return note.title.toLowerCase().indexOf(query) !== -1;
  });

  list.innerHTML = '';
  visible.forEach(function (note) {
    var li = document.createElement('li');
    li.className = 'note' + (note.done ? ' done' : '');

    var check = document.createElement('button');
    check.className = 'note__check';
    check.type = 'button';
    check.setAttribute('aria-label', note.done ? 'Mark as not done' : 'Mark as done');
    check.textContent = '✓';
    check.addEventListener('click', function () {
      note.done = !note.done;
      persist();
      render();
    });

    var body = document.createElement('div');
    body.className = 'note__body';
    var title = document.createElement('div');
    title.className = 'note__title';
    title.textContent = note.title;
    var meta = document.createElement('div');
    meta.className = 'note__meta';
    meta.textContent = relativeTime(note.createdAt) + (note.done ? ' · completed' : '');
    body.appendChild(title);
    body.appendChild(meta);

    var remove = document.createElement('button');
    remove.className = 'note__delete';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Delete note');
    remove.addEventListener('click', function () {
      state.notes = state.notes.filter(function (item) { return item.id !== note.id; });
      persist();
      render();
    });

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(remove);
    list.appendChild(li);
  });

  count.textContent = visible.length + (visible.length === 1 ? ' note' : ' notes');
  empty.style.display = visible.length ? 'none' : 'block';
  empty.textContent = state.query ? 'No notes match that search.' : 'Nothing here yet — add your first note above.';
}

document.getElementById('note-form').addEventListener('submit', function (event) {
  event.preventDefault();
  var input = document.getElementById('note-title');
  var title = input.value.trim();
  if (!title) return;
  state.notes.unshift({ id: String(Date.now()), title: title, done: false, createdAt: Date.now() });
  input.value = '';
  persist();
  render();
});

document.getElementById('search').addEventListener('input', function (event) {
  state.query = event.target.value;
  render();
});

render();
`;

const AURORA_README = `# Aurora Notes

A small, local-first notes app built with plain HTML, CSS, and JavaScript.

## What is inside

- **index.html** — the page shell
- **styles.css** — aurora gradients, glass panels, responsive layout
- **app.js** — state, rendering, search, localStorage persistence

## Try this

1. Open **index.html** and press Run to see a live preview.
2. Add a note, complete it, search for it.
3. Change the accent color in styles.css — the preview refreshes instantly.
4. Open the terminal and type \`tree\` or \`cat app.js\`.

No build step, no dependencies, no framework.`;

const CLI_JS = `// tiny-tasks-cli — a dependency-free task manager.
// Run this file to see a simulated terminal session.

const store = new Map();

function addTask(title, priority) {
  const id = store.size + 1;
  store.set(id, { id, title, priority: priority || 'medium', done: false });
  console.log('  ✓ added   #' + id + '  ' + title);
  return id;
}

function completeTask(id) {
  const task = store.get(id);
  if (!task) {
    console.log('  ✗ no task with id #' + id);
    return;
  }
  task.done = true;
  console.log('  ✓ done    #' + id + '  ' + task.title);
}

function removeTask(id) {
  if (store.delete(id)) console.log('  ✓ removed #' + id);
  else console.log('  ✗ no task with id #' + id);
}

function listTasks(filter) {
  const rows = [...store.values()].filter((task) => {
    if (filter === 'open') return !task.done;
    if (filter === 'done') return task.done;
    return true;
  });
  const width = Math.max(...rows.map((task) => task.title.length), 10);
  console.log('');
  console.log('  ID   STATUS   PRIORITY   TITLE');
  console.log('  ' + '-'.repeat(42));
  rows.forEach((task) => {
    const status = task.done ? '[x]' : '[ ]';
    console.log(
      '  ' + String(task.id).padEnd(5) +
      status.padEnd(9) +
      task.priority.padEnd(11) +
      task.title.padEnd(width)
    );
  });
  console.log('');
  console.log('  ' + rows.length + ' task(s) · ' + rows.filter((t) => t.done).length + ' complete');
}

console.log('');
console.log('  ◆ tiny-tasks-cli   v1.2.0');
console.log('  a dependency-free task manager');
console.log('');

const ship = addTask('Ship the landing page', 'high');
const docs = addTask('Write the onboarding docs', 'medium');
addTask('Add keyboard shortcuts', 'low');
completeTask(ship);
completeTask(99);
listTasks('open');
removeTask(docs);
listTasks();

console.log('  tip: edit this file, then press Cmd/Ctrl + Enter to run again.');
console.log('');
`;

const CLI_README = `# tiny-tasks-cli

A dependency-free command-line task manager written in plain JavaScript.

## Design notes

- A Map-backed store keeps the demo fast and simple.
- Every command prints human-friendly output.
- No runtime dependencies — this file runs anywhere JavaScript does.

## Run it

Open cli.js and press Run. The output appears in the Output panel and is saved to your run history.

## Next steps

- Swap the Map for SQLite or a JSON file.
- Add due dates and recurring tasks.
- Wrap the functions in a real argument parser.`;

const ANALYSIS_PY = `"""Data Explorer — standard-library-only analytics.

Runs with Python 3 (Pyodide) right in the browser.
"""

from collections import Counter
from statistics import mean, median

SALES = [
    ("Jan", 1240), ("Feb", 1580), ("Mar", 1710), ("Apr", 1490),
    ("May", 2080), ("Jun", 2360), ("Jul", 2190), ("Aug", 2520),
    ("Sep", 2810), ("Oct", 2640), ("Nov", 3120), ("Dec", 3480),
]

REGIONS = [
    ("Kerala", 4820), ("Karnataka", 3660), ("Tamil Nadu", 3110),
    ("Maharashtra", 2740), ("Delhi NCR", 1990), ("Others", 2410),
]

def monthly_report(rows):
    values = [amount for _, amount in rows]
    best_month = max(rows, key=lambda row: row[1])
    worst_month = min(rows, key=lambda row: row[1])
    growth = (values[-1] - values[0]) / values[0] * 100
    return {
        "total": sum(values),
        "average": mean(values),
        "median": median(values),
        "best": best_month,
        "worst": worst_month,
        "growth": growth,
    }

def bar(value, maximum, width=22):
    filled = round(value / maximum * width)
    return "█" * filled + "·" * (width - filled)

print("DATA EXPLORER")
print("=" * 46)
report = monthly_report(SALES)
print(f"Revenue total      {report['total']:,}")
print(f"Monthly average    {report['average']:,.0f}")
print(f"Median month       {report['median']:,.0f}")
print(f"Best month         {report['best'][0]} ({report['best'][1]:,})")
print(f"Growth Jan to Dec  {report['growth']:.1f}%")
print()
print("MONTHLY TREND")
maximum = max(amount for _, amount in SALES)
for month, amount in SALES:
    print(f"{month}  {bar(amount, maximum)}  {amount:>5,}")

print()
print("REVENUE BY REGION")
region_total = sum(amount for _, amount in REGIONS)
for region, amount in sorted(REGIONS, key=lambda row: -row[1]):
    share = amount / region_total * 100
    print(f"{region:<14} {amount:>6,}   {share:>5.1f}%")

print()
labels = Counter()
for month, amount in SALES:
    labels["above average" if amount > report["average"] else "below average"] += 1
print("Months above average:", labels["above average"])
print("Months below average:", labels["below average"])
print()
print("Tip: edit SALES above and press Cmd/Ctrl + Enter to re-run.")
`;

const QUERIES_SQL = `-- Data Explorer · analytical queries
-- The IDE runs SQL files with SQLite in the browser.

-- 1. Monthly revenue with month-over-month growth
WITH monthly AS (
  SELECT strftime('%Y-%m', sold_at) AS month, SUM(amount) AS revenue
  FROM sales
  GROUP BY month
)
SELECT
  month,
  revenue,
  ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month)) /
        NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS growth_pct
FROM monthly
ORDER BY month;

-- 2. Top customers by lifetime revenue
SELECT
  c.name,
  c.region,
  COUNT(o.id)        AS orders,
  SUM(o.amount)      AS lifetime_value,
  ROUND(AVG(o.amount), 2) AS average_order
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id
ORDER BY lifetime_value DESC
LIMIT 10;

-- 3. Regions ranked by revenue share
SELECT
  region,
  SUM(amount) AS revenue,
  ROUND(100.0 * SUM(amount) / (SELECT SUM(amount) FROM sales), 1) AS share_pct
FROM sales s
JOIN customers c ON c.id = s.customer_id
GROUP BY region
ORDER BY revenue DESC;
`;

const ANALYSIS_README = `# Data Explorer

A standard-library Python notebook that turns a year of sales into a readable report.

## Highlights

- Summary statistics with *statistics.mean* and *statistics.median*
- Unicode bar charts with no charting library
- Region breakdown with revenue share
- A matching SQL file with window functions

## Run Python in the browser

Open **analysis.py** and press Run. Hanre loads a local Python (Pyodide) runtime the first time, then executes the file and stores the output in your run history.

The same file also runs in any normal Python 3 environment.`;

const ALGO_JS = `// Algorithms Lab — small, self-contained demonstrations.

function quickSort(values) {
  if (values.length <= 1) return values;
  const pivot = values[Math.floor(values.length / 2)];
  const left = values.filter((value) => value < pivot);
  const middle = values.filter((value) => value === pivot);
  const right = values.filter((value) => value > pivot);
  return [...quickSort(left), ...middle, ...quickSort(right)];
}

function binarySearch(sorted, target) {
  let low = 0;
  let high = sorted.length - 1;
  let steps = 0;
  while (low <= high) {
    steps += 1;
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] === target) return { index: mid, steps };
    if (sorted[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return { index: -1, steps };
}

function time(label, fn) {
  const start = performance.now();
  const result = fn();
  const ms = (performance.now() - start).toFixed(2);
  console.log(label.padEnd(28), ms + ' ms');
  return result;
}

const random = Array.from({ length: 2000 }, () => Math.round(Math.random() * 100000));

console.log('ALGORITHMS LAB');
console.log('='.repeat(42));
const sorted = time('quicksort · 2,000 values', () => quickSort(random));
console.log('sorted correctly'.padEnd(28), sorted.every((v, i) => i === 0 || sorted[i - 1] <= v));
const target = sorted[1234];
const found = time('binary search · target', () => binarySearch(sorted, target));
console.log('found at index'.padEnd(28), found.index, '(' + found.steps + ' steps)');

const sentences = ['the quick brown fox', 'jumps over the lazy dog', 'the fox is quick'];
const frequency = sentences
  .join(' ')
  .split(' ')
  .reduce((acc, word) => ({ ...acc, [word]: (acc[word] || 0) + 1 }), {});
console.log('most common words'.padEnd(28), JSON.stringify(Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 3)));

console.log('');
console.log('Try editing the array size, or add your own algorithm below.');
`;

const ALGO_README = `# Algorithms Lab

A tiny playground for classic algorithms, written in plain JavaScript.

- **quickSort** — divide and conquer, O(n log n) on average
- **binarySearch** — logarithmic lookup with step counting
- **word frequency** — a reduce-based counter

Run algorithms.js to see timings and results. The file uses only features available in the browser sandbox.

> Next: add a test harness that fails loudly when an invariant breaks.`;

const PORTFOLIO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maya Raman · Design Engineer</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="nav">
    <a class="brand" href="#">maya.raman</a>
    <nav>
      <a href="#work">Work</a>
      <a href="#about">About</a>
      <a class="nav__cta" href="#contact">Say hello</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">DESIGN ENGINEER · KOCHI, IN</p>
      <h1>I build calm interfaces for <em>complicated</em> ideas.</h1>
      <p class="lede">Currently crafting developer tools at a small studio. Previously: product design, frontend systems, and far too many side projects.</p>
      <div class="hero__actions">
        <a class="button" href="#work">View selected work</a>
        <a class="link" href="#about">More about me →</a>
      </div>
      <div class="stamp">
        <span class="stamp__dot"></span>
        Available for select projects — Q1 2026
      </div>
    </section>

    <section id="work" class="work">
      <div class="section-head">
        <h2>Selected work</h2>
        <span>2019 — 2026</span>
      </div>
      <article class="project">
        <div class="project__meta">01 · Developer tooling</div>
        <h3>Hanre Studio</h3>
        <p>A browser-native coding workspace for people who do not want to install a compiler to learn one.</p>
        <span class="tag">Product design</span><span class="tag">Frontend</span>
      </article>
      <article class="project">
        <div class="project__meta">02 · Climate data</div>
        <h3>Monsoon Atlas</h3>
        <p>An interactive atlas of rainfall across the Western Ghats, built with a small team of researchers.</p>
        <span class="tag">Data viz</span><span class="tag">Next.js</span>
      </article>
      <article class="project">
        <div class="project__meta">03 · Education</div>
        <h3>Pustaka</h3>
        <p>A quiet reading companion with offline-first sync and a typographic system for Malayalam.</p>
        <span class="tag">Design systems</span><span class="tag">Mobile</span>
      </article>
    </section>

    <section id="about" class="about">
      <h2>About</h2>
      <p>I care about typography, fast software, and the small details that make tools feel inevitable. I write about interface craft and maintain a few open-source libraries.</p>
    </section>
  </main>

  <footer id="contact">
    <p>Let us make something considered.</p>
    <a class="button" href="mailto:hello@maya.example">hello@maya.example</a>
    <p class="fine">© 2026 Maya Raman. Built with Hanre.</p>
  </footer>
</body>
</html>
`;

const PORTFOLIO_CSS = `:root {
  --paper: #f4f1e8;
  --ink: #171512;
  --muted: #6d675c;
  --line: #d8d2c2;
  --accent: #2f5d4f;
  --serif: Georgia, "Times New Roman", serif;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

.nav {
  width: min(1080px, calc(100% - 48px));
  margin: 0 auto;
  padding: 26px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}

.brand {
  font-family: var(--serif);
  font-size: 19px;
  letter-spacing: -0.01em;
}

.nav nav { display: flex; align-items: center; gap: 26px; font-size: 13px; }

.nav__cta {
  padding: 9px 16px;
  border: 1px solid var(--ink);
  border-radius: 999px;
  transition: background 160ms ease, color 160ms ease;
}

.nav__cta:hover { background: var(--ink); color: var(--paper); }

main, footer { width: min(1080px, calc(100% - 48px)); margin: 0 auto; }

.hero { padding: 84px 0 72px; max-width: 840px; }

.eyebrow {
  margin: 0 0 22px;
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--accent);
}

h1 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(42px, 8vw, 82px);
  line-height: 1.02;
  letter-spacing: -0.035em;
}

h1 em { color: var(--accent); }

.lede {
  margin: 26px 0 0;
  max-width: 540px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.7;
}

.hero__actions { display: flex; align-items: center; gap: 24px; margin-top: 34px; }

.button {
  display: inline-block;
  background: var(--ink);
  color: var(--paper);
  padding: 13px 22px;
  border-radius: 999px;
  font-size: 13px;
  transition: transform 160ms ease;
}

.button:hover { transform: translateY(-2px); }

.link { font-size: 13px; border-bottom: 1px solid var(--ink); padding-bottom: 2px; }

.stamp {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 48px;
  font-size: 12px;
  color: var(--muted);
}

.stamp__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3f7d5d;
  box-shadow: 0 0 0 3px rgba(63, 125, 93, 0.16);
}

.work { border-top: 1px solid var(--line); padding-top: 34px; }

.section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }

.section-head h2, .about h2 {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 26px;
  margin: 0;
}

.section-head span { font-size: 11px; color: var(--muted); letter-spacing: 0.12em; }

.project {
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: 8px 32px;
  padding: 28px 0;
  border-top: 1px solid var(--line);
  transition: padding-left 200ms ease;
}

.project:hover { padding-left: 8px; }

.project__meta { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }

.project h3 { margin: 0 0 8px; font-family: var(--serif); font-weight: 400; font-size: 28px; }

.project p { margin: 0 0 14px; color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 560px; }

.tag {
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  margin-right: 6px;
}

.about {
  border-top: 1px solid var(--line);
  margin-top: 20px;
  padding: 32px 0;
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: 32px;
}

.about p { margin: 0; max-width: 560px; color: var(--muted); line-height: 1.7; font-size: 14px; }

footer {
  margin-top: 30px;
  border-top: 1px solid var(--line);
  padding: 48px 0 40px;
}

footer > p:first-child { font-family: var(--serif); font-size: 26px; margin: 0 0 22px; }

.fine { margin-top: 34px; font-size: 11px; color: var(--muted); }

@media (max-width: 700px) {
  .project, .about { grid-template-columns: 1fr; }
  .nav nav { gap: 14px; }
  .nav nav a:not(.nav__cta) { display: none; }
  .hero { padding: 56px 0; }
}
`;

const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Hanre</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, sans-serif; color: #f4f1ff;
      background: radial-gradient(60vw 60vw at 20% 0%, rgba(139,123,255,.35), transparent 60%), #0a0c10;
    }
    .card {
      width: min(520px, calc(100% - 40px)); padding: 40px;
      border: 1px solid rgba(255,255,255,.1); border-radius: 20px;
      background: rgba(255,255,255,.04); backdrop-filter: blur(16px);
    }
    .eyebrow { margin: 0 0 12px; font-size: 11px; letter-spacing: .22em; color: #5eead4; }
    h1 { margin: 0 0 14px; font-size: 34px; letter-spacing: -.03em; }
    p { color: #a5acba; line-height: 1.7; font-size: 14px; }
    code { background: rgba(255,255,255,.08); padding: 2px 6px; border-radius: 5px; font-size: 12px; }
    ul { color: #a5acba; font-size: 14px; line-height: 1.9; padding-left: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <p class="eyebrow">YOUR FIRST PROJECT</p>
    <h1>Welcome to Hanre</h1>
    <p>This is a real workspace. Create files, edit them with the editor, run JavaScript in <code>hello.js</code>, or open the terminal and type <code>tree</code>.</p>
    <ul>
      <li>Press <code>Cmd/Ctrl + K</code> to search everything</li>
      <li>Press <code>Cmd/Ctrl + Enter</code> to run the open file</li>
      <li>Press <code>Cmd/Ctrl + \`</code> to toggle the terminal</li>
    </ul>
    <p>Change this HTML, press Run, and your preview updates.</p>
  </div>
</body>
</html>
`;

const HELLO_JS = `// Your first Hanre script.
// Press Cmd/Ctrl + Enter to run it.

const workspace = {
  name: 'Hanre Studio',
  version: '1.0.0',
  features: ['editor', 'terminal', 'runner', 'github import'],
};

console.log('Hello from', workspace.name, workspace.version);
console.log('');
workspace.features.forEach((feature, index) => {
  console.log('  ' + (index + 1) + '. ' + feature);
});
console.log('');
console.log('Now try editing this file and running it again.');
`;

const WELCOME_NOTES = `# Welcome to your workspace

Hanre is a full coding environment that lives in your browser.

## A few things to try

- Create a project from a template on the Projects page.
- Import any public GitHub repository — files open right in the editor.
- Press Cmd/Ctrl + K anywhere to search files, snippets, tasks, and actions.
- Drag tasks between columns on the Tasks board.
- Run JavaScript instantly, with every run saved to your history.

## Files in this project

- index.html — a live preview you can edit
- hello.js — a runnable script
- notes.md — this file

Delete this project whenever you are ready. It is yours.`;

const PLAYGROUND_JS = `// A scratchpad for ideas. Nothing here is saved automatically.

const fibonacci = (n) => {
  const values = [0, 1];
  for (let i = 2; i < n; i += 1) values.push(values[i - 1] + values[i - 2]);
  return values.slice(0, n);
};

console.log('First 12 Fibonacci numbers:', fibonacci(12).join(', '));

const words = ['hanre', 'studio', 'build', 'something', 'good'];
const shout = words.map((word) => word.toUpperCase()).join(' ');
console.log(shout);
`;

function snippetSeeds(userId: string) {
  return [
    {
      title: "useDebouncedValue",
      description: "Debounce a fast-changing value in React without extra dependencies.",
      language: "typescript",
      tags: ["react", "hooks", "performance"],
      starred: 1,
      code: `import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// usage
// const query = useDebouncedValue(input, 250);`,
    },
    {
      title: "fetchWithRetry",
      description: "Fetch with exponential backoff and a hard attempt limit.",
      language: "javascript",
      tags: ["network", "async"],
      starred: 0,
      code: `export async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500 && attempt < attempts) {
        throw new Error("Server error " + response.status);
      }
      return response;
    } catch (error) {
      lastError = error;
      const backoff = 2 ** attempt * 150;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}`,
    },
    {
      title: "chunk",
      description: "Split an array into fixed-size groups — useful for batching API calls.",
      language: "javascript",
      tags: ["array", "utils"],
      starred: 0,
      code: `function chunk(items, size) {
  if (size < 1) throw new RangeError("size must be positive");
  const output = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

chunk([1, 2, 3, 4, 5, 6, 7], 3);
// [[1, 2, 3], [4, 5, 6], [7]]`,
    },
    {
      title: "word_frequencies",
      description: "Count the most common words in a text, ignoring stop words.",
      language: "python",
      tags: ["text", "collections"],
      starred: 1,
      code: `from collections import Counter
import re

STOP_WORDS = {"the", "a", "an", "and", "or", "to", "of", "in", "is", "it"}

def word_frequencies(text: str, limit: int = 10):
    words = re.findall(r"[a-z']+", text.lower())
    counted = Counter(w for w in words if w not in STOP_WORDS)
    return counted.most_common(limit)

print(word_frequencies("The quiet craft of building tools that feel inevitable."))`,
    },
    {
      title: "Top customers by lifetime revenue",
      description: "Window functions + joins for a clean customer leaderboard.",
      language: "sql",
      tags: ["analytics", "sql"],
      starred: 0,
      code: `SELECT
  c.name,
  c.region,
  COUNT(o.id)               AS orders,
  SUM(o.amount)             AS lifetime_value,
  ROUND(AVG(o.amount), 2)   AS avg_order,
  RANK() OVER (ORDER BY SUM(o.amount) DESC) AS revenue_rank
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.placed_at >= date('now', '-12 months')
GROUP BY c.id
ORDER BY lifetime_value DESC
LIMIT 20;`,
    },
    {
      title: "Glass card",
      description: "A reusable frosted panel with a subtle aurora border.",
      language: "css",
      tags: ["ui", "css"],
      starred: 1,
      code: `.glass-card {
  position: relative;
  padding: 24px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 50px -30px rgba(0, 0, 0, 0.9);
}

.glass-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(120deg, rgba(139, 123, 255, 0.5), transparent 40%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}`,
    },
  ].map((snippet) => ({ ...snippet, userId }));
}

export function ensureDemoUser(db: DatabaseSync): string {
  const email = "demo@hanre.dev";
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (existing) return existing.id;

  const userId = uid();
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, avatar_color, prefs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(userId, email, "Maya Raman", hash("demo1234"), "#8b7bff", DEFAULT_PREFS, ago(96));
  seedDemoWorkspace(db, userId);
  return userId;
}

export function seedStarterContent(db: DatabaseSync, userId: string) {
  const projectId = uid();
  const createdAt = now();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, description, language, color, is_archived, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'starter', ?, ?)",
  ).run(
    projectId,
    userId,
    "Welcome to Hanre",
    "A tiny, runnable project to get you oriented. Edit the HTML, run the script, or delete it.",
    "html",
    "#8b7bff",
    createdAt,
    createdAt,
  );
  const insertFile = db.prepare(
    "INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
  );
  insertFile.run(uid(), projectId, userId, "index.html", "index.html", "html", WELCOME_HTML, createdAt, createdAt);
  insertFile.run(uid(), projectId, userId, "hello.js", "hello.js", "javascript", HELLO_JS, createdAt, createdAt);
  insertFile.run(uid(), projectId, userId, "notes.md", "notes.md", "markdown", WELCOME_NOTES, createdAt, createdAt);

  const insertSnippet = db.prepare(
    "INSERT INTO snippets (id, user_id, title, description, language, code, tags, is_starred, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertSnippet.run(
    uid(), userId, "Array chunk", "Split arrays into batches.", "javascript",
    "function chunk(items, size = 2) {\n  const out = [];\n  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));\n  return out;\n}",
    JSON.stringify(["utils", "array"]), 0, createdAt, createdAt,
  );
  insertSnippet.run(
    uid(), userId, "Fetch with timeout", "Abort long requests without a library.", "javascript",
    "async function fetchJson(url, ms = 4000) {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), ms);\n  try {\n    const res = await fetch(url, { signal: controller.signal });\n    return await res.json();\n  } finally {\n    clearTimeout(timer);\n  }\n}",
    JSON.stringify(["network", "async"]), 1, createdAt, createdAt,
  );

  const insertTask = db.prepare(
    "INSERT INTO tasks (id, user_id, project_id, title, notes, status, priority, due_date, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertTask.run(uid(), userId, null, "Explore the editor shortcuts", "Try Cmd/Ctrl + K, Cmd/Ctrl + Enter, and Cmd/Ctrl + `.", "in_progress", "medium", null, 0, createdAt, createdAt);
  insertTask.run(uid(), userId, null, "Create your first real project", "Start from a template or import a GitHub repository.", "backlog", "high", null, 0, createdAt, createdAt);
  insertTask.run(uid(), userId, projectId, "Customize the welcome page", "Open index.html and make it yours.", "done", "low", null, 0, createdAt, createdAt);

  db.prepare(
    "INSERT INTO activity (id, user_id, kind, message, project_id, created_at) VALUES (?, ?, 'account', 'Created your Hanre workspace', NULL, ?)",
  ).run(uid(), userId, createdAt);
}

function seedDemoWorkspace(db: DatabaseSync, userId: string) {
  const projects: SeedProject[] = [
    {
      name: "Aurora Notes",
      description: "A calm, local-first notes app in plain HTML, CSS, and JavaScript.",
      language: "html",
      color: "#8b7bff",
      source: "template:web",
      ageDays: 12,
      files: [
        { path: "index.html", content: AURORA_HTML },
        { path: "styles.css", content: AURORA_CSS },
        { path: "app.js", content: AURORA_JS },
        { path: "README.md", content: AURORA_README },
      ],
    },
    {
      name: "tiny-tasks-cli",
      description: "A zero-dependency task manager with a friendly terminal output.",
      language: "javascript",
      color: "#5eead4",
      source: "template:node",
      ageDays: 8,
      files: [
        { path: "cli.js", content: CLI_JS },
        { path: "README.md", content: CLI_README },
      ],
    },
    {
      name: "Data Explorer",
      description: "A year of sales turned into a readable report with Python's standard library.",
      language: "python",
      color: "#fbbf24",
      source: "template:python",
      ageDays: 5,
      files: [
        { path: "analysis.py", content: ANALYSIS_PY },
        { path: "queries.sql", content: QUERIES_SQL },
        { path: "README.md", content: ANALYSIS_README },
      ],
    },
    {
      name: "Algorithms Lab",
      description: "Classic algorithms, timings, and invariants in plain JavaScript.",
      language: "javascript",
      color: "#60a5fa",
      source: "template:node",
      ageDays: 3,
      files: [
        { path: "algorithms.js", content: ALGO_JS },
        { path: "README.md", content: ALGO_README },
      ],
    },
    {
      name: "Portfolio 2026",
      description: "An editorial one-pager for a design engineer — warm paper, quiet motion.",
      language: "html",
      color: "#fb7185",
      source: "template:web",
      ageDays: 1,
      files: [
        { path: "index.html", content: PORTFOLIO_HTML },
        { path: "styles.css", content: PORTFOLIO_CSS },
      ],
    },
  ];

  const projectIds: Record<string, string> = {};
  const fileIds: Record<string, string> = {};
  const insertFile = db.prepare(
    "INSERT INTO files (id, project_id, user_id, path, name, is_dir, language, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
  );
  const insertProject = db.prepare(
    "INSERT INTO projects (id, user_id, name, description, language, color, is_archived, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  for (const project of projects) {
    const id = uid();
    projectIds[project.name] = id;
    const createdAt = ago(project.ageDays, 3);
    const updatedAt = ago(project.ageDays, 0);
    insertProject.run(
      id, userId, project.name, project.description, project.language,
      project.color, 0, project.source, createdAt, updatedAt,
    );
    for (const file of project.files) {
      const fileId = uid();
      fileIds[project.name + "/" + file.path] = fileId;
      insertFile.run(
        fileId, id, userId, file.path, file.path, languageFor(file.path),
        file.content, createdAt, updatedAt,
      );
    }
  }

  const snippets = snippetSeeds(userId);
  const insertSnippet = db.prepare(
    "INSERT INTO snippets (id, user_id, title, description, language, code, tags, is_starred, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  snippets.forEach((snippet, index) => {
    insertSnippet.run(
      uid(), userId, snippet.title, snippet.description, snippet.language,
      snippet.code, JSON.stringify(snippet.tags), snippet.starred,
      ago(20 - index * 2), ago(20 - index * 2),
    );
  });

  const tasks: {
    title: string;
    notes: string;
    status: string;
    priority: string;
    project: string | null;
    due: string | null;
    ageDays: number;
  }[] = [
    { title: "Ship the aurora empty state", notes: "Illustration + copy for when there are no notes.", status: "in_progress", priority: "high", project: "Aurora Notes", due: ago(-2), ageDays: 6 },
    { title: "Add keyboard shortcut hints", notes: "Show Cmd+K hint in the toolbar on first visit.", status: "backlog", priority: "medium", project: "Aurora Notes", due: null, ageDays: 3 },
    { title: "Export notes as markdown", notes: "One .md file per note inside a zip.", status: "backlog", priority: "low", project: "Aurora Notes", due: null, ageDays: 2 },
    { title: "Write onboarding docs", notes: "Cover projects, imports, and the terminal.", status: "review", priority: "medium", project: "tiny-tasks-cli", due: ago(-1), ageDays: 5 },
    { title: "Add due dates to tasks", notes: "Confirm format: ISO strings in SQLite.", status: "in_progress", priority: "urgent", project: "tiny-tasks-cli", due: ago(0, 6), ageDays: 4 },
    { title: "Cache region aggregates", notes: "Materialize the region rollup once per hour.", status: "backlog", priority: "medium", project: "Data Explorer", due: ago(-6), ageDays: 7 },
    { title: "Add growth chart to report", notes: "Unicode bars are fun, but a real sparkline would help.", status: "review", priority: "high", project: "Data Explorer", due: ago(-3), ageDays: 6 },
    { title: "Benchmark quicksort vs built-in", notes: "Run 100k values, compare timings.", status: "done", priority: "low", project: "Algorithms Lab", due: null, ageDays: 8 },
    { title: "Fix portfolio mobile nav", notes: "Links were hidden below 700px — add a compact menu.", status: "done", priority: "high", project: "Portfolio 2026", due: null, ageDays: 2 },
    { title: "Publish portfolio to production", notes: "Point the domain, run a Lighthouse pass.", status: "backlog", priority: "urgent", project: "Portfolio 2026", due: ago(-9), ageDays: 1 },
    { title: "Try Hanre's GitHub import", notes: "Pick a small public repo and open it in the editor.", status: "done", priority: "medium", project: null, due: null, ageDays: 4 },
  ];
  const insertTask = db.prepare(
    "INSERT INTO tasks (id, user_id, project_id, title, notes, status, priority, due_date, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  tasks.forEach((task, index) => {
    insertTask.run(
      uid(), userId, task.project ? projectIds[task.project] : null, task.title, task.notes,
      task.status, task.priority, task.due, index,
      ago(task.ageDays, 2), ago(task.ageDays, 1),
    );
  });

  const runs: {
    project: string;
    file: string;
    command: string;
    language: string;
    status: string;
    output: string;
    ms: number;
    days: number;
    hours: number;
  }[] = [
    { project: "Algorithms Lab", file: "algorithms.js", command: "node algorithms.js", language: "javascript", status: "success", output: "ALGORITHMS LAB\n==========================================\nquicksort · 2,000 values   4.62 ms\nsorted correctly            true\nbinary search · target     0.11 ms\nfound at index             1234 (10 steps)\nmost common words          [[\"the\",2],[\"quick\",2],[\"fox\",2]]", ms: 22, days: 0, hours: 2 },
    { project: "Data Explorer", file: "analysis.py", command: "python analysis.py", language: "python", status: "success", output: "DATA EXPLORER\n==============================================\nRevenue total      29,220\nMonthly average    2,435\nMedian month       2,355\nBest month         Dec (3,480)\nGrowth Jan to Dec  180.6%\n\nMONTHLY TREND\nJan  ███████···············  1,240\nFeb  █████████···········  1,580\nMar  ██████████··········  1,710", ms: 480, days: 0, hours: 5 },
    { project: "tiny-tasks-cli", file: "cli.js", command: "node cli.js", language: "javascript", status: "success", output: "◆ tiny-tasks-cli   v1.2.0\na dependency-free task manager\n\n  ✓ added   #1  Ship the landing page\n  ✓ added   #2  Write the onboarding docs\n  ✓ added   #3  Add keyboard shortcuts\n  ✓ done    #1  Ship the landing page\n\n  ID   STATUS   PRIORITY   TITLE\n  ------------------------------------------\n  2    [ ]      medium     Write the onboarding docs\n  3    [ ]      low        Add keyboard shortcuts\n\n  3 task(s) · 1 complete", ms: 34, days: 1, hours: 1 },
    { project: "Aurora Notes", file: "index.html", command: "preview index.html", language: "html", status: "success", output: "Preview rendered · 0 console errors", ms: 12, days: 1, hours: 4 },
    { project: "Aurora Notes", file: "app.js", command: "node app.js", language: "javascript", status: "error", output: "ReferenceError: document is not defined\n\nThis file runs in a browser environment. Open index.html and press Run to preview the page instead.", ms: 8, days: 2, hours: 2 },
    { project: "Algorithms Lab", file: "algorithms.js", command: "node algorithms.js", language: "javascript", status: "success", output: "ALGORITHMS LAB\n==========================================\nquicksort · 2,000 values   5.14 ms\nsorted correctly            true\nbinary search · target     0.09 ms\nfound at index             1234 (10 steps)", ms: 19, days: 3, hours: 1 },
    { project: "Data Explorer", file: "analysis.py", command: "python analysis.py", language: "python", status: "success", output: "DATA EXPLORER\n==============================================\nRevenue total      29,220\nMonthly average    2,435", ms: 511, days: 4, hours: 3 },
    { project: "Portfolio 2026", file: "index.html", command: "preview index.html", language: "html", status: "success", output: "Preview rendered · 0 console errors", ms: 9, days: 5, hours: 1 },
    { project: "tiny-tasks-cli", file: "cli.js", command: "node cli.js", language: "javascript", status: "success", output: "◆ tiny-tasks-cli   v1.2.0\n\n  3 task(s) · 1 complete", ms: 28, days: 6, hours: 2 },
    { project: "Aurora Notes", file: "index.html", command: "preview index.html", language: "html", status: "success", output: "Preview rendered · 0 console errors", ms: 11, days: 7, hours: 5 },
    { project: "Algorithms Lab", file: "algorithms.js", command: "node algorithms.js", language: "javascript", status: "success", output: "ALGORITHMS LAB\n...\nsorted correctly true", ms: 25, days: 8, hours: 4 },
    { project: "Data Explorer", file: "queries.sql", command: "sql queries.sql", language: "sql", status: "unsupported", output: "SQL execution needs the browser runtime. Open the file and press Run in the IDE to execute it with SQLite.", ms: 0, days: 9, hours: 1 },
    { project: "Aurora Notes", file: "app.js", command: "node app.js", language: "javascript", status: "error", output: "ReferenceError: document is not defined", ms: 7, days: 10, hours: 2 },
    { project: "Portfolio 2026", file: "index.html", command: "preview index.html", language: "html", status: "success", output: "Preview rendered · 0 console errors", ms: 13, days: 12, hours: 4 },
  ];

  const insertRun = db.prepare(
    "INSERT INTO runs (id, user_id, project_id, file_id, command, language, status, output, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  runs.forEach((run) => {
    insertRun.run(
      uid(), userId, projectIds[run.project], fileIds[run.project + "/" + run.file] ?? null,
      run.command, run.language, run.status, run.output, run.ms, ago(run.days, run.hours),
    );
  });

  const activity = [
    { kind: "run", message: "Ran analysis.py in Data Explorer", project: "Data Explorer", days: 0, hours: 5 },
    { kind: "file", message: "Edited styles.css in Aurora Notes", project: "Aurora Notes", days: 0, hours: 7 },
    { kind: "project", message: "Created Portfolio 2026", project: "Portfolio 2026", days: 1, hours: 2 },
    { kind: "task", message: "Completed “Fix portfolio mobile nav”", project: "Portfolio 2026", days: 2, hours: 1 },
    { kind: "run", message: "Ran algorithms.js in Algorithms Lab", project: "Algorithms Lab", days: 3, hours: 4 },
    { kind: "snippet", message: "Starred “Glass card”", project: null, days: 4, hours: 2 },
    { kind: "project", message: "Imported files into Data Explorer", project: "Data Explorer", days: 5, hours: 6 },
    { kind: "file", message: "Renamed notes_app.js to app.js", project: "Aurora Notes", days: 6, hours: 3 },
  ];
  const insertActivity = db.prepare(
    "INSERT INTO activity (id, user_id, kind, message, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  activity.forEach((item) => {
    insertActivity.run(
      uid(), userId, item.kind, item.message,
      item.project ? projectIds[item.project] : null,
      ago(item.days, item.hours),
    );
  });
}

export function seedDemoUser(db: DatabaseSync) {
  ensureDemoUser(db);
}

function languageFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", ts: "typescript", tsx: "typescript",
    jsx: "javascript", py: "python", html: "html", htm: "html", css: "css",
    json: "json", sql: "sql", md: "markdown", sh: "shell", cpp: "cpp", rs: "rust",
    java: "java", php: "php", yml: "yaml", yaml: "yaml", xml: "xml",
  };
  return map[ext] ?? "plaintext";
}
