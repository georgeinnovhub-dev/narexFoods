import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireCustomer } from "@/lib/customers";
import { serializeOrder, ORDER_INCLUDE } from "@/lib/serialize";
import type { AccountOrdersResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/account/orders — the signed-in customer's own orders (spec §16). */
export async function GET() {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const orders = await db.order.findMany({
      where: { customerId: auth.session.customerId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const response: AccountOrdersResponse = { orders: orders.map(serializeOrder) };
    return ok(response);
  } catch (err) {
    safeErrorLog("account.orders.GET", err);
    return fail("Could not load your orders.", 500);
  }
}
