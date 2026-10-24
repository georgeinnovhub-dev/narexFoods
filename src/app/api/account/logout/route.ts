import { ok } from "@/lib/api";
import { CUSTOMER_COOKIE, CUSTOMER_TTL_SECONDS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** POST /api/account/logout — clear the customer session cookie. */
export async function POST() {
  const res = ok({ success: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  void CUSTOMER_TTL_SECONDS;
  return res;
}
