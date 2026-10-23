import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { safeErrorLog } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/paystack/webhook — signature-verified, replay-resistant webhook (spec §7).
 * Only `charge.success` events move payments; duplicates are ignored via providerRef state.
 */
export async function POST(req: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return new Response("not configured", { status: 409 });

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";
    const expected = createHmac("sha512", secretKey).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response("invalid signature", { status: 401 });
    }

    const event = JSON.parse(raw) as { event: string; data?: { reference?: string; amount?: number; status?: string } };
    if (event.event !== "charge.success" || !event.data?.reference) {
      await db.paymentEvent.create({ data: { type: "webhook", status: "ignored", detail: event.event } });
      return new Response("ok", { status: 200 });
    }

    const payment = await db.payment.findUnique({
      where: { reference: event.data.reference },
      include: { order: true },
    });
    if (!payment) {
      await db.paymentEvent.create({ data: { type: "webhook", status: "unknown_ref", detail: event.data.reference } });
      return new Response("ok", { status: 200 });
    }

    // Idempotency: never double-apply a financial event
    if (payment.status === "paid") return new Response("ok", { status: 200 });

    // Match amount before trusting the webhook
    if (event.data.amount !== payment.amount) {
      await db.paymentEvent.create({
        data: { paymentId: payment.id, type: "reconciliation", status: "amount_mismatch", detail: `webhook=${event.data.amount} expected=${payment.amount}` },
      });
      return new Response("ok", { status: 200 });
    }

    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: "paid", providerRef: event.data.reference } }),
      db.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: "paid",
          events: { create: { type: "payment", message: "Payment confirmed via card (webhook)", actor: "paystack" } },
        },
      }),
      db.paymentEvent.create({ data: { paymentId: payment.id, type: "webhook", status: "ok", detail: "charge.success applied" } }),
    ]);
    return new Response("ok", { status: 200 });
  } catch (err) {
    safeErrorLog("paystack.webhook", err);
    return new Response("error", { status: 500 });
  }
}
