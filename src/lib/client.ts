"use client";

/** Same-origin API client helpers. Never use absolute URLs. */

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    Object.assign(err, { status: res.status, data });
    throw err;
  }
  return data as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    Object.assign(err, { status: res.status, data });
    throw err;
  }
  return data as T;
}

export { formatGHS } from "@/lib/money";
