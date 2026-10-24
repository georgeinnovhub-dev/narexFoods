import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { createCustomerToken, customerCookieOptions } from "@/lib/customers";
import { CUSTOMER_COOKIE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(120),
});

/** POST /api/account/login — customer sign-in (separate cookie from staff). */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "customer-login"), 8, 60_000)) {
    return fail("Too many login attempts. Please wait a minute.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter a valid email and password.", 422);
  try {
    const customer = await db.customer.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    });
    // Constant-shape response — no user enumeration
    if (!customer || !verifyPassword(parsed.data.password, customer.passwordHash)) {
      return fail("Invalid email or password.", 401);
    }
    if (customer.status !== "active") {
      return fail("This account is not active. Please contact us.", 403);
    }
    const token = createCustomerToken({ customerId: customer.id, email: customer.email, name: customer.name });
    await logAudit({ actor: customer.name, actorId: customer.id, action: "customer.login", target: customer.email });
    const res = ok({ customer: { id: customer.id, name: customer.name, email: customer.email } });
    res.cookies.set(CUSTOMER_COOKIE, token, customerCookieOptions());
    return res;
  } catch (err) {
    safeErrorLog("account.login", err);
    return fail("Login failed. Please try again.", 500);
  }
}
