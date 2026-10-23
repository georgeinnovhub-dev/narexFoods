import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "@/lib/permissions";

const SECRET =
  process.env.AUTH_SECRET || "narex-dev-secret-change-in-production-iDe8";

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Read the current staff session from cookies (server-side). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Fresh permission check against DB (handles role changes + suspension instantly). */
export async function requireStaff(
  permission?: string
): Promise<{ session: SessionPayload } | { error: string; status: number }> {
  const session = await getSession();
  if (!session) return { error: "Authentication required", status: 401 };
  const staff = await db.staffMember.findUnique({
    where: { id: session.staffId },
    include: { role: true },
  });
  if (!staff || staff.status !== "active") {
    return { error: "Account is not active", status: 403 };
  }
  const permissions: string[] = JSON.parse(staff.role.permissions || "[]");
  if (permission && !permissions.includes(permission)) {
    return { error: "You do not have permission to perform this action", status: 403 };
  }
  return { session: { ...session, permissions } };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  };
}
