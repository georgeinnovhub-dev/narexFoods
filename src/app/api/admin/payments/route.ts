import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET /api/admin/payments?status=&provider=&page= — payment attempts + evidence review queue (spec §10). */
export async function GET(req: Request) {
  const auth = await requireStaff("payments.review");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const provider = searchParams.get("provider") || undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Number(searchParams.get("pageSize")) || 20);

  try {
    const where: Prisma.PaymentWhereInput = {};
    if (status && status !== "all") where.status = status;
    if (provider && provider !== "all") where.provider = provider;
    const [total, payments, exceptions] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        include: { order: { select: { reference: true, customerName: true, customerPhone: true, total: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.paymentEvent.findMany({
        where: { type: "reconciliation" },
        include: { payment: { select: { reference: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return ok({
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderReference: p.order.reference,
        customerName: p.order.customerName,
        customerPhone: p.order.customerPhone,
        provider: p.provider,
        method: p.method,
        status: p.status,
        amount: p.amount,
        orderTotal: p.order.total,
        reference: p.reference,
        evidenceName: p.evidenceName,
        hasEvidence: Boolean(p.evidencePath),
        evidenceUrl: p.evidencePath ? `/api/evidence/${p.id}` : null,
        reviewNote: p.reviewNote,
        reviewedBy: p.reviewedBy,
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        detail: e.detail,
        status: e.status,
        paymentReference: e.payment?.reference,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    safeErrorLog("admin.payments.GET", err);
    return fail("Failed to load payments.", 500);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(300).optional(),
});

/** PATCH /api/admin/payments — approve/reject evidence with recorded reviewer + reason. */
export async function PATCH(req: Request) {
  const auth = await requireStaff("payments.review");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { id, action, note } = parsed.data;
  if (action === "reject" && !note) return fail("A rejection reason is required.", 422);

  try {
    const payment = await db.payment.findUnique({ where: { id }, include: { order: true } });
    if (!payment) return fail("Payment not found.", 404);
    if (payment.provider === "paystack") {
      return fail("Paystack payments are verified automatically by the provider — manual approval is disabled.", 409);
    }
    if (payment.status === "paid") return fail("This payment is already approved.", 409);

    const approved = action === "approve";
    await db.$transaction([
      db.payment.update({
        where: { id },
        data: {
          status: approved ? "paid" : "rejected",
          reviewedBy: auth.session.name,
          reviewedAt: new Date(),
          reviewNote: note || (approved ? "Evidence verified" : undefined),
        },
      }),
      db.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: approved ? "paid" : "unpaid",
          events: {
            create: {
              type: "payment",
              message: approved
                ? `Payment verified and approved by ${auth.session.name}`
                : `Payment evidence rejected by ${auth.session.name}: ${note}`,
              actor: auth.session.name,
            },
          },
        },
      }),
      db.paymentEvent.create({
        data: { paymentId: id, type: "review", status: approved ? "approved" : "rejected", detail: note, },
      }),
    ]);

    const { notify } = await import("@/lib/outbox");
    await notify({
      type: approved ? "receipt_approved" : "receipt_rejected",
      subject: `Payment ${approved ? "approved" : "rejected"} for order ${payment.order.reference}`,
      recipient: payment.order.customerEmail || undefined,
      payload: { reference: payment.order.reference, note },
    });
    await logAudit({
      actor: auth.session.name, actorId: auth.session.staffId,
      action: approved ? "payment.approve" : "payment.reject",
      target: payment.order.reference, meta: { note, amount: payment.amount },
    });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.payments.PATCH", err);
    return fail("Failed to review payment.", 500);
  }
}
