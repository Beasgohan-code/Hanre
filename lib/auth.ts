import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, nowIso, uid } from "./db";
import { ApiError } from "./errors";
import type { User, UserPrefs } from "./types";
import { DEFAULT_PREFS } from "./types";

const COOKIE = "hanre_session";
const SESSION_DAYS = 30;

const attemptBuckets = new Map<string, { count: number; resetAt: number }>();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const derived = crypto.scryptSync(password, salt, 64, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    const expected = Buffer.from(hash, "hex");
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function rateLimit(key: string, limit = 12, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucket = attemptBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    attemptBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");
  }
}

function parsePrefs(raw: string): UserPrefs {
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    avatarColor: String(row.avatar_color ?? "#8b7bff"),
    prefs: parsePrefs(String(row.prefs ?? "{}")),
    createdAt: String(row.created_at),
  };
}

export function getUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(input: {
  name: string;
  email: string;
  password: string;
  avatarColor?: string;
}): User {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new ApiError(409, "An account with this email already exists.");
  const id = uid();
  const colors = ["#8b7bff", "#5eead4", "#f0abfc", "#fbbf24", "#60a5fa", "#fb7185"];
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, avatar_color, prefs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    email,
    input.name.trim(),
    hashPassword(input.password),
    input.avatarColor ?? colors[Math.floor(Math.random() * colors.length)],
    JSON.stringify(DEFAULT_PREFS),
    nowIso(),
  );
  return getUserById(id)!;
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(uid(), userId, tokenHash, expires.toISOString(), nowIso());
  return { token, expiresAt: expires.toISOString() };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }
  store.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const row = getDb()
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenHash, nowIso()) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export function updateProfile(
  userId: string,
  patch: { name?: string; email?: string; avatarColor?: string; prefs?: UserPrefs },
): User {
  const db = getDb();
  const current = getUserById(userId);
  if (!current) throw new ApiError(404, "Account not found.");
  const email = patch.email ? normalizeEmail(patch.email) : current.email;
  if (patch.email && !validateEmail(email)) throw new ApiError(400, "Enter a valid email address.");
  if (patch.email && patch.email !== current.email) {
    const exists = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, userId);
    if (exists) throw new ApiError(409, "That email is already in use.");
  }
  const prefs = { ...current.prefs, ...(patch.prefs ?? {}) };
  db.prepare(
    "UPDATE users SET name = ?, email = ?, avatar_color = ?, prefs = ? WHERE id = ?",
  ).run(
    (patch.name ?? current.name).trim() || current.name,
    email,
    patch.avatarColor ?? current.avatarColor,
    JSON.stringify(prefs),
    userId,
  );
  return getUserById(userId)!;
}

export function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  const db = getDb();
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as
    | { password_hash: string }
    | undefined;
  if (!row) throw new ApiError(404, "Account not found.");
  if (!verifyPassword(currentPassword, row.password_hash)) {
    throw new ApiError(400, "Your current password is incorrect.");
  }
  if (nextPassword.length < 8) throw new ApiError(400, "New password must be at least 8 characters.");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(nextPassword), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
