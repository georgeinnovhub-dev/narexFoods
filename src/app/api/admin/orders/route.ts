import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { serializeOrder, ORDER_INCLUDE } from "@/lib/serialize";
import type { AdminOrderListResponse } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET /api/admin/orders — searchable, filterable, paginated (spec §10). */
export async function GET(req: Request) {
  const auth = await requireStaff("orders.manage");
  if ("error" in auth) return fail(auth.error, auth.status);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;
  const fulfillmentType = searchParams.get("fulfillmentType") || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize")) || 20));

  try {
    const where: Prisma.OrderWhereInput = {};
    if (status && status !== "all") where.status = status;
    if (paymentStatus && paymentStatus !== "all") where.paymentStatus = paymentStatus;
    if (fulfillmentType && fulfillmentType !== "all") where.fulfillmentType = fulfillmentType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (q) {
      where.OR = [
        { reference: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ];
    }

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const response: AdminOrderListResponse = {
      orders: orders.map(serializeOrder),
      total,
      page,
      pageSize,
    };
    return ok(response);
  } catch (err) {
    safeErrorLog("admin.orders.GET", err);
    return fail("Failed to load orders.", 500);
  }
}

const patchSchema = z.object({
  action: z.enum(["status", "note", "mark_paid"]),
  status: z.enum(["accepted", "rejected", "preparing", "ready", "collected", "dispatched", "completed", "cancelled"]).optional(),
  reason: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
});

/** PATCH /api/admin/orders — status transitions, notes, offline payment marking. State machine enforced. */
export async function PATCH(req: Request) {
  const auth = await requireStaff("orders.manage");
  if ("error" in auth) return fail(auth.error, auth.status);

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid request", 422);
  const { action, status, reason, note } = parsed.data;

  try {
    if (action === "status") {
      if (!status || !reason) return fail("Status and reason are required.", 422);
      const order = await db.order.findUnique({ where: { id: body!.id } });
      if (!order) return fail("Order not found.", 404);
      const allowed = (await import("@/lib/orders")).ORDER_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        return fail(`Cannot move order from "${order.status}" to "${status}".`, 409);
      }
      const updated = await db.order.update({
        where: { id: order.id },
        data: {
          status,
          cancelledReason: status === "cancelled" || status === "rejected" ? reason : order.cancelledReason,
          events: { create: { type: "status_change", message: `Status: ${order.status} → ${status}. ${reason}`, actor: auth.session.name } },
        },
        include: ORDER_INCLUDE,
      });
      const { notify } = await import("@/lib/outbox");
      if (status === "accepted") await notify({ type: "order_accepted", subject: `Order ${order.reference} accepted`, payload: { reference: order.reference } });
      if (status === "cancelled" || status === "rejected") await notify({ type: "order_cancelled", subject: `Order ${order.reference} ${status}`, payload: { reference: order.reference, reason } });
      await (await import("@/lib/audit")).logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: `order.${status}`, target: order.reference });
      return ok({ order: serializeOrder(updated) });
    }

    if (action === "note") {
      if (!note) return fail("Note text is required.", 422);
      const updated = await db.order.update({
        where: { id: body!.id! },
        data: { events: { create: { type: "note", message: note, actor: auth.session.name } } },
        include: ORDER_INCLUDE,
      });
      return ok({ order: serializeOrder(updated) });
    }

    // mark_paid — offline cash payment confirmation by authorized reviewer (audited)
    const payAuth = await requireStaff("payments.review");
    if ("error" in payAuth) return fail(payAuth.error, payAuth.status);
    const order = await db.order.findUnique({ where: { id: body!.id! }, include: { payments: true } });
    if (!order) return fail("Order not found.", 404);
    if (order.paymentStatus === "paid") return fail("Order is already marked paid.", 409);
    const manualPayment = order.payments.find((p) => p.provider === "manual");
    await db.$transaction([
      ...(manualPayment
        ? [db.payment.update({ where: { id: manualPayment.id }, data: { status: "paid", reviewedBy: auth.session.name, reviewedAt: new Date(), reviewNote: "Marked paid in person (cash)" } })]
        : [db.payment.create({ data: { orderId: order.id, provider: "cash", method: "cash", status: "paid", amount: order.total, reference: `CASH-${order.reference}-${Date.now().toString(36).toUpperCase()}`, reviewedBy: auth.session.name, reviewedAt: new Date() } })]),
      db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "paid",
          events: { create: { type: "payment", message: "Payment received (cash) and verified by staff", actor: auth.session.name } },
        },
      }),
    ]);
    await (await import("@/lib/audit")).logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "payment.mark_paid", target: order.reference, meta: { amount: order.total } });
    const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE });
    return ok({ order: updated ? serializeOrder(updated) : null });
  } catch (err) {
    safeErrorLog("admin.orders.PATCH", err);
    return fail("Failed to update order.", 500);
  }
}
