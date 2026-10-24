import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import type { OverviewStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** GET /api/admin/overview — real persisted metrics with explicit definitions (spec §10, §11). */
export async function GET() {
  const auth = await requireStaff("orders.manage");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const now = new Date();
    const today = startOfDay(now);
    const trendStart = startOfDay(new Date(now.getTime() - 13 * 86400_000));

    const [totalOrders, newOrders, pendingVerification, paidAgg, outstandingAgg, todayCount] =
      await Promise.all([
        db.order.count(),
        db.order.count({ where: { status: "created" } }),
        db.order.count({ where: { paymentStatus: "pending_verification" } }),
        db.order.aggregate({ where: { paymentStatus: "paid" }, _count: true, _sum: { total: true } }),
        db.order.aggregate({
          where: { paymentStatus: { in: ["unpaid", "pending_verification"] }, status: { notIn: ["cancelled", "rejected"] } },
          _sum: { total: true },
        }),
        db.order.count({ where: { createdAt: { gte: today } } }),
      ]);

    const revenueCollected = paidAgg._sum.total ?? 0;
    const paidOrders = paidAgg._count;

    const statusDistribution = await db.order.groupBy({
      by: ["status"],
      _count: true,
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400_000) } },
    });

    const bestSellerRows = await db.orderItem.groupBy({
      by: ["productName", "variantName"],
      _sum: { quantity: true, lineTotal: true },
      _count: true,
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const trendRows = await db.order.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true, total: true, paymentStatus: true },
    });
    const trendMap = new Map<string, { orders: number; revenue: number; collected: number }>();
    for (let i = 0; i < 14; i++) {
      const d = startOfDay(new Date(trendStart.getTime() + i * 86400_000));
      trendMap.set(d.toISOString().slice(0, 10), { orders: 0, revenue: 0, collected: 0 });
    }
    for (const row of trendRows) {
      const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (entry) {
        entry.orders += 1;
        entry.revenue += row.total;
        if (row.paymentStatus === "paid") entry.collected += row.total;
      }
    }

    // Operational alerts
    const alerts: string[] = [];
    if (pendingVerification > 0) alerts.push(`${pendingVerification} payment(s) awaiting review`);
    if (newOrders > 0) alerts.push(`${newOrders} new order(s) to accept`);
    const outboxPending = await db.notificationOutbox.count({ where: { status: "pending" } });
    if (outboxPending > 5) alerts.push(`${outboxPending} notifications queued in outbox`);
    const soldOut = await db.product.count({ where: { soldOut: true, archived: false } });
    if (soldOut > 0) alerts.push(`${soldOut} product(s) marked sold out`);

    const stats: OverviewStats = {
      totalOrders,
      newOrders,
      pendingVerification,
      paidOrders,
      revenueCollected, // definition: sum of totals of orders with paymentStatus=paid
      outstandingAmount: outstandingAgg._sum.total ?? 0,
      averageOrderValue: paidOrders ? Math.round(revenueCollected / paidOrders) : 0,
      ordersToday: todayCount,
      statusDistribution: statusDistribution.map((s) => ({ status: s.status, count: s._count })),
      bestSellers: bestSellerRows.map((b) => ({
        productName: b.productName,
        variantName: b.variantName,
        qty: b._sum.quantity ?? 0,
        revenue: b._sum.lineTotal ?? 0,
      })),
      salesTrend: [...trendMap.entries()].map(([date, v]) => ({ date, orders: v.orders, revenue: v.collected })),
      alerts,
    };
    return ok(stats);
  } catch (err) {
    safeErrorLog("admin.overview", err);
    return fail("Failed to load overview.", 500);
  }
}
