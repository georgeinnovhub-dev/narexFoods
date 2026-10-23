import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().min(4) });

/**
 * POST /api/payments/paystack/init — server-side initialization with the validated order amount.
 * The Paystack secret key lives ONLY in the server env. Provider stays disabled until configured.
 */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "pay-init"), 10, 60_000)) {
    return fail("Too many attempts. Please wait a moment.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);

  const settings = await getSettings();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!settings.payments.paystack.enabled || !secretKey) {
    return fail("Card payment is not available right now. Please use mobile money instead.", 409);
  }

  try {
    const order = await db.order.findUnique({
      where: { reference: parsed.data.reference.toUpperCase() },
      include: { payments: true },
    });
    if (!order) return fail("Order not found.", 404);
    if (order.paymentStatus === "paid") return fail("This order is already paid.", 409);

    const email = order.customerEmail || `${order.customerPhone.replace(/\s/g, "")}@narex-orders.local`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: order.total, // pesewas = Paystack's lowest denomination for GHS (kobo/pesewa parity)
        currency: "GHS",
        reference: `${order.reference}-${Date.now().toString(36).toUpperCase()}`,
        metadata: { orderReference: order.reference },
      }),
    });
    const data = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!data.status || !data.data) {
      await db.paymentEvent.create({ data: { type: "init", status: "failed", detail: data.message } });
      return fail("Payment initialization failed. Please try another method.", 502);
    }

    await db.payment.create({
      data: {
        orderId: order.id,
        provider: "paystack",
        method: "card",
        status: "processing",
        amount: order.total,
        reference: data.data.reference,
      },
    });
    await db.paymentEvent.create({ data: { type: "init", status: "ok", detail: `initialized ${data.data.reference}` } });
    await db.order.update({
      where: { id: order.id },
      data: { events: { create: { type: "payment", message: "Card payment initialized", actor: "system" } } },
    });

    return ok({ authorizationUrl: data.data.authorization_url, providerReference: data.data.reference });
  } catch (err) {
    safeErrorLog("paystack.init", err);
    return fail("Payment initialization failed.", 502);
  }
}
