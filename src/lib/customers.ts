import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_TTL_SECONDS,
  type CustomerSessionPayload,
} from "@/lib/permissions";
import {
  createSessionToken,
  verifySignedToken,
  sessionCookieOptions,
} from "@/lib/auth";

/**
 * Customer account sessions (spec §16) — separate HMAC cookie from staff so a
 * customer session can never be confused with a staff session. Stateless token
 * + fresh DB check on every protected read.
 */

export function createCustomerToken(payload: {
  customerId: string;
  email: string;
  name: string;
}): string {
  return createSessionToken({ ...payload, typ: "customer" });
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySignedToken<CustomerSessionPayload>(token);
  if (!payload || payload.typ !== "customer") return null;
  return payload;
}

/** Fresh customer check against DB (suspension applies instantly). */
export async function requireCustomer(): Promise<
  { session: CustomerSessionPayload } | { error: string; status: number }
> {
  const session = await getCustomerSession();
  if (!session) return { error: "Please sign in to continue.", status: 401 };
  const customer = await db.customer.findUnique({ where: { id: session.customerId } });
  if (!customer || customer.status !== "active") {
    return { error: "This account is not active.", status: 403 };
  }
  return { session };
}

export function customerCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: CUSTOMER_TTL_SECONDS,
  };
}
