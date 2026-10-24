import { formatGHS } from "@/lib/money";
import type { SiteSettings } from "@/lib/settings";

export interface WhatsAppOrderLine {
  productName: string;
  variantName: string;
  quantity: number;
  lineTotal: number;
  addons?: { name: string; price: number }[];
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  created: "Order created",
  accepted: "Order accepted by staff",
  rejected: "Order rejected",
  preparing: "Being prepared",
  ready: "Ready",
  collected: "Collected",
  dispatched: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending_verification: "Pending verification",
  paid: "Payment received & verified",
  failed: "Payment failed",
  refunded: "Refunded",
};

export const DISPATCH_STATUS_LABELS: Record<string, string> = {
  awaiting: "Awaiting assignment",
  assigned: "Assigned",
  accepted: "Accepted by dispatcher",
  collected: "Collected from kitchen",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Failed delivery",
  returned: "Returned",
};

/** Build the prepared, URL-encoded WhatsApp handoff message for an order (spec §6, §9, §12). */
export function buildWhatsAppUrl(
  settings: SiteSettings,
  order: {
    reference: string;
    customerName: string;
    fulfillmentType: string;
    address?: string | null;
    zoneName?: string | null;
    landmark?: string | null;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    giftMessage?: string | null;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    couponCode?: string | null;
    items: WhatsAppOrderLine[];
  }
): string {
  const lines: string[] = [];
  lines.push(`Hello ${settings.brand.name}! I would like to place an order.`);
  lines.push("");
  lines.push(`*Order reference:* ${order.reference}`);
  lines.push(`*Name:* ${order.customerName}`);
  lines.push(`*Type:* ${order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}`);
  if (order.recipientName) {
    lines.push(`*This is a gift for:* ${order.recipientName}${order.recipientPhone ? ` (${order.recipientPhone})` : ""}`);
    if (order.giftMessage) lines.push(`*Gift message:* "${order.giftMessage}"`);
  }
  if (order.scheduledDate) {
    lines.push(`*Requested for:* ${order.scheduledDate}${order.scheduledTime ? `, ${order.scheduledTime}` : ""}`);
  }
  if (order.fulfillmentType === "delivery" && order.address) {
    lines.push(`*Delivery address:* ${order.address}`);
    if (order.zoneName) lines.push(`*Delivery area:* ${order.zoneName}`);
    if (order.landmark) lines.push(`*Landmark:* ${order.landmark}`);
  }
  lines.push("");
  lines.push("*Order summary*");
  for (const item of order.items) {
    const addons = item.addons?.length
      ? ` (+ ${item.addons.map((a) => a.name).join(", ")})`
      : "";
    lines.push(
      `• ${item.quantity} × ${item.productName} (${item.variantName})${addons} — ${formatGHS(item.lineTotal)}`
    );
  }
  lines.push("");
  lines.push(`Subtotal: ${formatGHS(order.subtotal)}`);
  if (order.discount > 0) {
    lines.push(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}: -${formatGHS(order.discount)}`);
  }
  if (order.fulfillmentType === "delivery") {
    lines.push(`Delivery fee: ${formatGHS(order.deliveryFee)}`);
  }
  lines.push(`*Total: ${formatGHS(order.total)}*`);
  lines.push("");
  lines.push("Please confirm my order. Thank you!");

  const intl = settings.contact.whatsappIntl || "233559291195";
  return `https://wa.me/${intl}?text=${encodeURIComponent(lines.join("\n"))}`;
}
