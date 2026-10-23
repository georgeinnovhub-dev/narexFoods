import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { priceOrder, generateOrderReference } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { notify } from "@/lib/outbox";
import { logAudit } from "@/lib/audit";
import { serializeOrder, ORDER_INCLUDE } from "@/lib/serialize";
import type { CreateOrderResponse, OrderDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        addonIds: z.array(z.string()).max(10).default([]),
      })
    )
    .min(1)
    .max(30),
  fulfillmentType: z.enum(["pickup", "delivery"]),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(9).max(15).regex(/^[0-9+\s-]+$/, "Enter a valid phone number"),
  customerEmail: z.string().email().max(120).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  couponCode: z.string().max(30).optional().or(z.literal("")),
});

/** POST /api/orders — create a durable order with server-side recalculation + idempotency. */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "checkout"), 10, 60_000)) {
    return fail("Too many attempts. Please wait a moment.", 429);
  }
  const body = await readJson(req);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Invalid checkout data", 422);
  }
  const data = parsed.data;

  try {
    // Idempotency — repeated submissions never duplicate orders (spec §6.13)
    const existing = await db.order.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      const settings = await getSettings();
      const dto = serializeOrder(existing);
      const response: CreateOrderResponse = {
        order: dto,
        whatsappUrl: buildWhatsAppUrl(settings, { ...dto, items: dto.items }),
        existing: true,
      };
      return ok(response);
    }

    const settings = await getSettings();
    if (!settings.ordering.enabled) {
      return fail(settings.ordering.pauseNote, 409, { orderingPaused: true });
    }

    if (data.fulfillmentType === "delivery") {
      if (!settings.delivery.enabled) {
        return fail("Delivery is currently unavailable. Please choose pickup.", 409);
      }
      if (!data.address || data.address.trim().length < 5) {
        return fail("Please provide a delivery address.", 422);
      }
    }

    // Full server-side recalculation from DB truth — client prices never trusted
    const priced = await priceOrder({
      items: data.items,
      fulfillmentType: data.fulfillmentType,
      couponCode: data.couponCode || null,
    });

    if (priced.unavailable.length > 0) {
      return fail("Some items in your cart are unavailable:", 409, { unavailable: priced.unavailable });
    }
    if (priced.lines.length === 0) {
      return fail("Your cart is empty or items are unavailable.", 422);
    }

    const reference = generateOrderReference();
    const now = new Date();

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          reference,
          idempotencyKey: data.idempotencyKey,
          status: "created",
          paymentStatus: "unpaid",
          fulfillmentType: data.fulfillmentType,
          customerName: data.customerName.trim(),
          customerPhone: data.customerPhone.replace(/\s/g, ""),
          customerEmail: data.customerEmail || null,
          address: data.fulfillmentType === "delivery" ? data.address?.trim() : null,
          note: data.note || null,
          subtotal: priced.subtotal,
          discount: priced.discount,
          deliveryFee: priced.deliveryFee,
          total: priced.total,
          couponCode: priced.couponCode,
          items: {
            create: priced.lines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              variantId: l.variantId,
              variantName: l.variantName,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              addons: JSON.stringify(l.addons),
              lineTotal: l.lineTotal,
            })),
          },
          events: {
            create: {
              type: "status_change",
              message: "Order created",
              actor: "customer",
            },
          },
          payments: {
            create: {
              provider: "manual",
              method: "mobile_money",
              status: "pending",
              amount: priced.total,
              reference: `PAY-${reference}-${now.getTime().toString(36).toUpperCase()}`,
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      // Record coupon redemption transactionally (prevents abuse races)
      if (priced.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: priced.couponCode } });
        if (coupon) {
          await tx.couponRedemption.create({
            data: { couponId: coupon.id, orderId: created.id, discount: priced.discount },
          });
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { redeemedCount: { increment: 1 } },
          });
        }
      }
      return created;
    });

    const dto = serializeOrder(order);
    const whatsappUrl = buildWhatsAppUrl(settings, { ...dto, items: dto.items });

    // Email/order notifications go through the outbox — never block ordering
    await notify({
      type: "new_order",
      subject: `New order ${dto.reference} — GH₵${(dto.total / 100).toFixed(2)}`,
      payload: {
        reference: dto.reference,
        total: dto.total,
        items: dto.items.length,
        fulfillmentType: dto.fulfillmentType,
      },
    });
    await logAudit({ actor: "customer", action: "order.create", target: dto.reference, meta: { total: dto.total } });

    const response: CreateOrderResponse = { order: dto, whatsappUrl };
    return ok(response, { status: 201 });
  } catch (err) {
    safeErrorLog("orders.POST", err);
    return fail("We could not create your order. Please try again.", 500);
  }
}

/**
 * GET /api/orders?reference=&phone= — order tracking.
 * Requires BOTH the unguessable reference AND the matching phone number,
 * so orders are never exposed by predictable IDs (spec §4, §17).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = (searchParams.get("reference") || "").trim().toUpperCase();
  const phone = (searchParams.get("phone") || "").replace(/\s/g, "");

  if (!reference || !phone) {
    return fail("Order reference and phone number are required.", 422);
  }
  if (!rateLimit(clientKey(req, "track"), 20, 60_000)) {
    return fail("Too many attempts. Please wait a moment.", 429);
  }

  try {
    const order = await db.order.findUnique({ where: { reference }, include: ORDER_INCLUDE });
    if (!order || order.customerPhone !== phone) {
      return fail("No order found with that reference and phone number.", 404);
    }
    const dto: OrderDTO = serializeOrder(order);
    return ok({ order: dto });
  } catch (err) {
    safeErrorLog("orders.GET", err);
    return fail("Something went wrong. Please try again.", 500);
  }
}
