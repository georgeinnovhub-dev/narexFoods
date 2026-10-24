import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import type { ReportsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** GET /api/admin/reports?from=&to=&format=json|csv — database-side aggregation (spec §11). */
export async function GET(req: Request) {
  const auth = await requireStaff("reports.view");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultFrom = startOfDay(new Date(now.getTime() - 29 * 86400_000));
  const from = searchParams.get("from") ? startOfDay(new Date(searchParams.get("from") as string)) : defaultFrom;
  const to = searchParams.get("to") ? new Date(`${searchParams.get("to")}T23:59:59.999`) : now;
  const format = searchParams.get("format") || "json";

  try {
    const rangeWhere = { createdAt: { gte: from, lte: to } };

    const [orders, orderItems, coupons, dispatchDone, dispatchFailed, payments] = await Promise.all([
      db.order.findMany({
        where: rangeWhere,
        select: { createdAt: true, total: true, discount: true, paymentStatus: true, status: true, couponCode: true },
      }),
      db.orderItem.findMany({
        where: { order: rangeWhere },
        select: { productName: true, variantName: true, quantity: true, lineTotal: true },
      }),
      db.couponRedemption.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { coupon: { select: { code: true } } },
      }),
      db.dispatchAssignment.findMany({
        where: { deliveredAt: { gte: from, lte: to }, status: "delivered" },
        select: { assignedAt: true, deliveredAt: true },
      }),
      db.dispatchAssignment.count({ where: { updatedAt: { gte: from, lte: to }, status: "failed" } }),
      db.payment.findMany({
        where: { status: "paid", createdAt: { gte: from, lte: to } },
        select: { provider: true, amount: true },
      }),
    ]);

    // Daily aggregation
    const dayMap = new Map<string, { orders: number; revenue: number; collected: number }>();
    for (let d = startOfDay(from); d <= to; d = new Date(d.getTime() + 86400_000)) {
      dayMap.set(startOfDay(d).toISOString().slice(0, 10), { orders: 0, revenue: 0, collected: 0 });
    }
    let grossValue = 0;
    let discounts = 0;
    let collected = 0;
    let unpaid = 0;
    const byStatus = new Map<string, number>();
    for (const o of orders) {
      const key = startOfDay(o.createdAt).toISOString().slice(0, 10);
      const day = dayMap.get(key);
      if (day) day.orders += 1;
      grossValue += o.total;
      discounts += o.discount;
      byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
      if (o.paymentStatus === "paid") {
        collected += o.total;
        if (day) day.collected += o.total;
      } else if (!["cancelled", "rejected"].includes(o.status)) {
        unpaid += o.total;
      }
    }

    // Product aggregation
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of orderItems) {
      const key = `${item.productName}||${item.variantName}`;
      const entry = prodMap.get(key) || { qty: 0, revenue: 0 };
      entry.qty += item.quantity;
      entry.revenue += item.lineTotal;
      prodMap.set(key, entry);
    }

    const couponMap = new Map<string, { redemptions: number; discount: number }>();
    for (const r of coupons) {
      const entry = couponMap.get(r.coupon.code) || { redemptions: 0, discount: 0 };
      entry.redemptions += 1;
      entry.discount += r.discount;
      couponMap.set(r.coupon.code, entry);
    }

    const deliveryTimes = dispatchDone
      .filter((d) => d.assignedAt && d.deliveredAt)
      .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
    const avgMinutes = deliveryTimes.length ? Math.round(deliveryTimes.reduce((s, m) => s + m, 0) / deliveryTimes.length) : null;

    const methodMap = new Map<string, { count: number; amount: number }>();
    for (const p of payments) {
      const entry = methodMap.get(p.provider) || { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += p.amount;
      methodMap.set(p.provider, entry);
    }

    const report: ReportsResponse = {
      range: { from: from.toISOString(), to: to.toISOString() },
      ordersByDay: [...dayMap.entries()].map(([date, v]) => ({ date, ...v })),
      totals: {
        orders: orders.length,
        grossValue,
        collected, // definition: sum of order totals where paymentStatus = paid
        discounts,
        unpaid,
        averageOrderValue: orders.length ? Math.round(grossValue / orders.length) : 0,
      },
      byProduct: [...prodMap.entries()].map(([key, v]) => {
        const [productName, variantName] = key.split("||");
        return { productName, variantName, ...v };
      }).sort((a, b) => b.revenue - a.revenue),
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      couponUsage: [...couponMap.entries()].map(([code, v]) => ({ code, ...v })),
      dispatchPerformance: {
        delivered: dispatchDone.length,
        failed: dispatchFailed,
        averageMinutes: avgMinutes,
      },
      paymentMethods: [...methodMap.entries()].map(([provider, v]) => ({ provider, ...v })),
    };

    if (format === "csv") {
      // CSV export respects permissions (this handler already requires reports.view)
      const lines: string[] = [];
      lines.push(`NAREX Foods Sales Report,${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)},Currency: GHS,Generated: ${new Date().toISOString()}`);
      lines.push("");
      lines.push("Date,Orders,Order Value (GHS),Collected (GHS)");
      for (const day of report.ordersByDay) {
        lines.push(`${day.date},${day.orders},${(day.revenue / 100).toFixed(2)},${(day.collected / 100).toFixed(2)}`);
      }
      lines.push("");
      lines.push("Product,Variant,Qty Sold,Revenue (GHS)");
      for (const p of report.byProduct) {
        lines.push(`"${p.productName}","${p.variantName}",${p.qty},${(p.revenue / 100).toFixed(2)}`);
      }
      lines.push("");
      lines.push(`TOTALS,Orders: ${report.totals.orders},Gross: GH₵${(report.totals.grossValue / 100).toFixed(2)},Collected: GH₵${(report.totals.collected / 100).toFixed(2)},Discounts: GH₵${(report.totals.discounts / 100).toFixed(2)},Unpaid: GH₵${(report.totals.unpaid / 100).toFixed(2)},AOV: GH₵${(report.totals.averageOrderValue / 100).toFixed(2)}`);
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="narex-report-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return ok(report);
  } catch (err) {
    safeErrorLog("admin.reports", err);
    return fail("Failed to generate report.", 500);
  }
}
