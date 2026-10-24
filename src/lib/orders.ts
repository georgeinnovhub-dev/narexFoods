import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { resolveZoneForAddress, toResolvedZone, type ResolvedZone } from "@/lib/zones";

/** Unguessable order access reference — never expose orders by sequential id alone (spec §4). */
export function generateOrderReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const bytes = randomBytes(8);
  let ref = "";
  for (const b of bytes) ref += alphabet[b % alphabet.length];
  return `NAR-${ref}`;
}

export function generatePaymentReference(orderRef: string): string {
  return `PAY-${orderRef}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export interface IncomingItem {
  productId: string;
  variantId: string;
  quantity: number;
  addonIds?: string[];
}

export interface PricedLine {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  addons: { name: string; price: number }[];
  lineTotal: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
  unavailable: string[];
  zone: ResolvedZone | null;
}

export interface CouponRow {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotal: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

/**
 * Recalculate + validate the ENTIRE order on the server from database truth.
 * Client prices are never trusted (spec §3, §6).
 */
export async function priceOrder(input: {
  items: IncomingItem[];
  fulfillmentType: string;
  couponCode?: string | null;
  address?: string | null;
}): Promise<PricedOrder> {
  const settings = await getSettings();
  const unavailable: string[] = [];
  const lines: PricedLine[] = [];

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds }, archived: false },
    include: { variants: true, addons: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      unavailable.push("Unknown product");
      continue;
    }
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.available) {
      unavailable.push(`${product.name} — selected option unavailable`);
      continue;
    }
    if (product.soldOut || !product.available || !withinSchedule(product.availableFrom, product.availableTo)) {
      unavailable.push(`${product.name} is currently unavailable`);
      continue;
    }
    const quantity = Math.max(1, Math.min(50, Math.floor(item.quantity)));
    const addons = (item.addonIds ?? [])
      .map((id) => product.addons.find((a) => a.id === id && a.available))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({ name: a.name, price: a.price }));
    const unitPrice = variant.price + addons.reduce((s, a) => s + a.price, 0);
    lines.push({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      unitPrice,
      quantity,
      addons,
      lineTotal: unitPrice * quantity,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Coupon validation — server-side only (spec §12)
  let discount = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const coupon: CouponRow | null = await db.coupon.findUnique({
      where: { code: input.couponCode.trim().toUpperCase() },
    });
    if (coupon && isCouponUsable(coupon, subtotal)) {
      discount =
        coupon.type === "percent"
          ? Math.floor((subtotal * Math.min(coupon.value, 100)) / 100)
          : Math.min(coupon.value, subtotal);
      couponCode = coupon.code;
    }
  }

  const deliveryEnabled = settings.delivery.enabled;
  let deliveryFee = 0;
  let zone: ResolvedZone | null = null;
  if (input.fulfillmentType === "delivery" && deliveryEnabled) {
    // Zone-based fee resolution (spec §7) — falls back to the legacy flat fee
    // only when NO zones are configured at all.
    const zones = await db.deliveryZone.count({ where: { active: true } });
    if (zones > 0) {
      const match = input.address ? await resolveZoneForAddress(input.address) : null;
      if (match) {
        zone = toResolvedZone(match);
        const freeOver = settings.delivery.freeOver;
        deliveryFee = freeOver && subtotal >= freeOver ? 0 : zone.fee;
      }
      // no match -> zone stays null; the API layer refuses the order
    } else {
      deliveryFee =
        settings.delivery.freeOver && subtotal >= settings.delivery.freeOver
          ? 0
          : settings.delivery.baseFee;
    }
  }

  const total = Math.max(0, subtotal - discount + deliveryFee);
  return { lines, subtotal, discount, deliveryFee, total, couponCode, unavailable, zone };
}

export function isCouponUsable(coupon: CouponRow, subtotal: number): boolean {
  if (!coupon.active) return false;
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return false;
  if (coupon.endsAt && coupon.endsAt < now) return false;
  if (subtotal < coupon.minSubtotal) return false;
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) return false;
  return true;
}

function withinSchedule(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true;
  const now = new Date();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= fh * 60 + (fm || 0) && minutes <= th * 60 + (tm || 0);
}

/** Allowed order status transitions (spec §6 — explicit state machine). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  created: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "dispatched", "cancelled"],
  collected: ["completed"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export const DISPATCH_TRANSITIONS: Record<string, string[]> = {
  awaiting: ["assigned", "returned"],
  assigned: ["accepted", "awaiting"], // reassignment back to queue
  accepted: ["collected", "failed"],
  collected: ["out_for_delivery", "failed"],
  out_for_delivery: ["delivered", "failed"],
  delivered: [],
  failed: ["out_for_delivery", "returned"],
  returned: [],
};
