import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function fail(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Minimal in-memory rate limiter for sensitive endpoints (spec §17). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "local";
  return `${scope}:${fwd.split(",")[0].trim()}`;
}

export function safeErrorLog(scope: string, err: unknown) {
  // Redact secrets from logs — message only, never config or keys
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${scope}]`, message);
}
