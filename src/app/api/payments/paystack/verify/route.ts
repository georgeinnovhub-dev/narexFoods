import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/paystack/verify?reference= — server-side verification (spec §7).
 * A browser reaching a success page is NEVER proof of payment — only the
 * verified provider API response marks the payment paid.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const providerRef = searchParams.get("reference");
  if (!providerRef) return fail("Payment reference is required.", 422);

  const settings = await getSettings();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!settings.payments.paystack.enabled || !secretKey) {
    return fail("Card payment is not available.", 409);
  }

  try {
    const payment = await db.payment.findUnique({ where: { reference: providerRef } });
    if (!payment) return fail("Payment not found.", 404);
    if (payment.status === "paid") {
      return ok({ status: "paid", message: "Payment verified." });
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(providerRef)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number; currency: string; metadata?: { orderReference?: string } };
    };

    const order = await db.order.findUnique({ where: { id: payment.orderId } });
    if (!data.status || !data.data) {
      await db.paymentEvent.create({ data: { paymentId: payment.id, type: "verify", status: "failed", detail: "verification request failed" } });
      return fail("Could not verify the payment.", 502);
    }

    const tx = data.data;
    // Match amount, currency and order reference before marking paid (spec §7)
    const orderRefFromMeta = tx.metadata?.orderReference;
    const matches =
      tx.status === "success" &&
      tx.amount === payment.amount &&
      tx.currency === "GHS" &&
      order &&
      (!orderRefFromMeta || orderRefFromMeta === order.reference);

    if (matches) {
      await db.$transaction([
        db.payment.update({
          where: { id: payment.id },
          data: { status: "paid", providerRef: providerRef },
        }),
        db.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "paid",
            events: { create: { type: "payment", message: "Card payment verified successfully", actor: "paystack" } },
          },
        }),
        db.paymentEvent.create({ data: { paymentId: payment.id, type: "verify", status: "ok", detail: `verified amount=${tx.amount}` } }),
      ]);
      return ok({ status: "paid", message: "Payment verified." });
    }

    await db.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    await db.paymentEvent.create({
      data: { paymentId: payment.id, type: "reconciliation", status: "mismatch", detail: `tx status=${tx.status} amount=${tx.amount}` },
    });
    return ok({ status: "unmatched", message: "Payment could not be matched to this order. Our team will review it." });
  } catch (err) {
    safeErrorLog("paystack.verify", err);
    return fail("Verification failed.", 502);
  }
}
