import { NextResponse } from "next/server";
import { ApiError } from "./errors";
import { requireUser } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function guard<T>(fn: () => Promise<T>): Promise<NextResponse | T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message, err.status);
    console.error("[hanre/api]", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return fail(message.includes("UNIQUE") ? "That item already exists." : "Something went wrong on our side.", 500);
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid request body.");
  }
}

export function str(value: unknown, label: string, opts: { min?: number; max?: number; optional?: boolean } = {}) {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return "";
    throw new ApiError(400, `${label} is required.`);
  }
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text.`);
  const trimmed = value.trim();
  if (opts.optional && trimmed === "") return "";
  if (opts.min && trimmed.length < opts.min) throw new ApiError(400, `${label} must be at least ${opts.min} characters.`);
  if (opts.max && trimmed.length > opts.max) throw new ApiError(400, `${label} must be under ${opts.max} characters.`);
  return trimmed;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function authed(): Promise<{ user: Awaited<ReturnType<typeof requireUser>> }> {
  const user = await requireUser();
  return { user };
}
