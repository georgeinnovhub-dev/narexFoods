import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(120),
});

export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "login"), 8, 60_000)) {
    return fail("Too many login attempts. Please wait a minute.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter a valid email and password.", 422);

  try {
    const staff = await db.staffMember.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
      include: { role: true },
    });
    // Constant-shape response — no user enumeration
    if (!staff || !staff.passwordHash || !verifyPassword(parsed.data.password, staff.passwordHash)) {
      return fail("Invalid email or password.", 401);
    }
    if (staff.status === "suspended") return fail("This account has been suspended. Contact your administrator.", 403);
    if (staff.status === "pending") return fail("Your account is awaiting approval.", 403);

    const permissions: string[] = JSON.parse(staff.role.permissions || "[]");
    const token = createSessionToken({
      sid: crypto.randomUUID(),
      staffId: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role.name,
      permissions,
    });

    await db.staffMember.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await logAudit({ actor: staff.name, actorId: staff.id, action: "auth.login", target: staff.email });

    const res = ok({
      staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role.name, permissions },
    });
    const opts = sessionCookieOptions();
    res.cookies.set(SESSION_COOKIE, token, opts);
    return res;
  } catch (err) {
    safeErrorLog("auth.login", err);
    return fail("Login failed. Please try again.", 500);
  }
}
