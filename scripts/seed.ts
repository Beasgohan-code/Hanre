/**
 * Seed the demo workspace.
 *
 *   npm run seed            ensure the demo account exists (safe to re-run)
 *   npm run seed -- --reset delete the demo account and rebuild it from scratch
 *
 * The app also seeds automatically the first time it opens an empty database,
 * so this script is mainly useful for demos, screenshots, and CI.
 */
import { getDb } from "../lib/db";
import { ensureDemoUser } from "../lib/seed";

const reset = process.argv.includes("--reset");
const db = getDb();

if (reset) {
  const removed = db.prepare("DELETE FROM users WHERE email = ?").run("demo@hanre.dev");
  console.log(`• Removed the previous demo account (${Number(removed.changes)} user row).`);
}

const userId = ensureDemoUser(db);

const one = (sql: string, ...params: (string | number)[]) =>
  Number((db.prepare(sql).get(...params) as { n: number }).n);

const counts = {
  projects: one("SELECT COUNT(*) AS n FROM projects WHERE user_id = ?", userId),
  files: one("SELECT COUNT(*) AS n FROM files WHERE user_id = ?", userId),
  snippets: one("SELECT COUNT(*) AS n FROM snippets WHERE user_id = ?", userId),
  tasks: one("SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?", userId),
  runs: one("SELECT COUNT(*) AS n FROM runs WHERE user_id = ?", userId),
  activity: one("SELECT COUNT(*) AS n FROM activity WHERE user_id = ?", userId),
};

console.log(`
  Hanre Studio · demo workspace ready
  ───────────────────────────────────
  email     demo@hanre.dev
  password  demo1234

  projects  ${counts.projects}
  files     ${counts.files}
  snippets  ${counts.snippets}
  tasks     ${counts.tasks}
  runs      ${counts.runs}
  activity  ${counts.activity}

  Open http://localhost:3000/login and choose “Try the demo”.
`);
