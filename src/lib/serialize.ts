import { db } from "@/lib/db";
import type { Order, OrderItem } from "@prisma/client";
import type { OrderDTO, PaymentDTO } from "@/lib/types";

type OrderWithRelations = Order & {
  items: OrderItem[];
  events: { id: string; type: string; message: string; actor: string; createdAt: Date }[];
  payments: {
    id: string; provider: string; method: string; status: string; amount: number;
    reference: string; evidenceName: string | null; reviewNote: string | null;
    reviewedBy: string | null; reviewedAt: Date | null; createdAt: Date; evidencePath: string | null;
  }[];
  assignment?: { id: string; status: string; fee: number; dispatcher: { staff: { name: string } } | null } | null;
};

export function serializeOrder(o: OrderWithRelations): OrderDTO {
  return {
    id: o.id,
    reference: o.reference,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentType: o.fulfillmentType,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    address: o.address,
    note: o.note,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    couponCode: o.couponCode,
    whatsappSent: o.whatsappSent,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      addons: safeParse(i.addons, []),
      lineTotal: i.lineTotal,
    })),
    events: o.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
    payments: o.payments.map<PaymentDTO>((p) => ({
      id: p.id,
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: p.amount,
      reference: p.reference,
      evidenceName: p.evidenceName,
      hasEvidence: Boolean(p.evidencePath),
      reviewNote: p.reviewNote,
      reviewedBy: p.reviewedBy,
      reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    assignment: o.assignment
      ? {
          id: o.assignment.id,
          status: o.assignment.status,
          dispatcherName: o.assignment.dispatcher?.staff?.name ?? null,
          fee: o.assignment.fee,
        }
      : null,
  };
}

export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const ORDER_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  assignment: { include: { dispatcher: { include: { staff: true } } } },
};
