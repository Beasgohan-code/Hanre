import { getDb, nowIso, uid } from "./db";
import type { Share } from "./types";

type Row = Record<string, unknown>;

function mapShare(row: Row): Share {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    slug: String(row.slug),
    views: Number(row.views ?? 0),
    createdAt: String(row.created_at),
  };
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function slug(length = 10) {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function getShare(userId: string, projectId: string): Share | null {
  const row = getDb()
    .prepare(
      `SELECT s.* FROM shares s JOIN projects p ON p.id = s.project_id
       WHERE s.project_id = ? AND p.user_id = ?`,
    )
    .get(projectId, userId) as Row | undefined;
  return row ? mapShare(row) : null;
}

export function createShare(userId: string, projectId: string): Share {
  const existing = getShare(userId, projectId);
  if (existing) return existing;

  const db = getDb();
  let candidate = slug();
  while (db.prepare("SELECT id FROM shares WHERE slug = ?").get(candidate)) {
    candidate = slug();
  }
  const id = uid();
  db.prepare("INSERT INTO shares (id, project_id, slug, views, created_at) VALUES (?, ?, ?, 0, ?)").run(
    id,
    projectId,
    candidate,
    nowIso(),
  );
  return { id, projectId, slug: candidate, views: 0, createdAt: nowIso() };
}

export function revokeShare(userId: string, projectId: string): boolean {
  const result = getDb()
    .prepare(
      `DELETE FROM shares WHERE project_id = ?
       AND project_id IN (SELECT id FROM projects WHERE id = ? AND user_id = ?)`,
    )
    .run(projectId, projectId, userId);
  return Number(result.changes ?? 0) > 0;
}

export function getShareBySlug(value: string): Share | null {
  const row = getDb().prepare("SELECT * FROM shares WHERE slug = ?").get(value) as Row | undefined;
  return row ? mapShare(row) : null;
}

export function bumpShareViews(shareId: string) {
  getDb().prepare("UPDATE shares SET views = views + 1 WHERE id = ?").run(shareId);
}
