import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { createCustomerToken, customerCookieOptions } from "@/lib/customers";
import { CUSTOMER_COOKIE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().min(9).max(15).regex(/^[0-9+\s-]+$/, "Enter a valid phone number"),
  password: z.string().min(8).max(120),
});

/** POST /api/account/register — customer self-service registration (spec §16). */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "register"), 5, 60_000)) {
    return fail("Too many attempts. Please wait a minute.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Please complete all fields.", 422);
  }
  const d = parsed.data;
  try {
    const email = d.email.toLowerCase().trim();
    const existing = await db.customer.findUnique({ where: { email } });
    if (existing) {
      return fail("An account with this email already exists. Please sign in.", 409);
    }
    const customer = await db.customer.create({
      data: {
        email,
        name: d.name.trim(),
        phone: d.phone.replace(/\s/g, ""),
        passwordHash: hashPassword(d.password),
      },
    });
    await logAudit({ actor: customer.name, actorId: customer.id, action: "customer.register", target: email });

    const token = createCustomerToken({ customerId: customer.id, email: customer.email, name: customer.name });
    const res = ok({ customer: { id: customer.id, name: customer.name, email: customer.email } });
    res.cookies.set(CUSTOMER_COOKIE, token, customerCookieOptions());
    return res;
  } catch (err) {
    safeErrorLog("account.register", err);
    return fail("Registration failed. Please try again.", 500);
  }
}
