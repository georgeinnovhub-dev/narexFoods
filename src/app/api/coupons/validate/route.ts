import { z } from "zod";
import { ok, fail, readJson, rateLimit, clientKey } from "@/lib/api";
import { isCouponUsable, priceOrder } from "@/lib/orders";
import { db } from "@/lib/db";
import type { CouponValidateResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(2).max(30),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string(),
        quantity: z.number().int().min(1).max(50),
        addonIds: z.array(z.string()).default([]),
      })
    )
    .min(1),
  fulfillmentType: z.enum(["pickup", "delivery"]).default("pickup"),
});

/** POST /api/coupons/validate — server-side coupon validation with real cart pricing. */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "coupon"), 15, 60_000)) {
    return fail("Too many attempts. Please wait a moment.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { code, items, fulfillmentType } = parsed.data;

  try {
    const priced = await priceOrder({ items, fulfillmentType, couponCode: null });
    const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });

    const base: CouponValidateResponse = { valid: false, discount: 0, message: "" };
    if (!coupon) {
      return ok({ ...base, message: "This coupon code does not exist." });
    }
    if (!isCouponUsable(coupon, priced.subtotal)) {
      let message = "This coupon is not valid for your order.";
      if (!coupon.active) message = "This coupon is no longer active.";
      else if (priced.subtotal < coupon.minSubtotal)
        message = `This coupon requires a minimum subtotal of GH₵${(coupon.minSubtotal / 100).toFixed(2)}.`;
      else if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions)
        message = "This coupon has reached its redemption limit.";
      else message = "This coupon is not active yet or has expired.";
      return ok({ ...base, message });
    }

    const discount =
      coupon.type === "percent"
        ? Math.floor((priced.subtotal * Math.min(coupon.value, 100)) / 100)
        : Math.min(coupon.value, priced.subtotal);

    const response: CouponValidateResponse = {
      valid: true,
      code: coupon.code,
      discount,
      message:
        coupon.type === "percent"
          ? `${coupon.value}% off applied!`
          : `GH₵${(coupon.value / 100).toFixed(2)} off applied!`,
    };
    return ok(response);
  } catch {
    return fail("Could not validate the coupon. Try again.", 500);
  }
}
