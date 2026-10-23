import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/outbox";
import { DISPATCH_TRANSITIONS } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import type { DispatchAssignmentDTO, DispatcherDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dispatch?view=queue|assignments|mine
 * Dispatchers may only see their own assigned orders (spec §9 — least privilege).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "queue";

  try {
    // Dispatcher self-service view
    if (view === "mine") {
      const auth = await requireStaff();
      if ("error" in auth) return fail(auth.error, auth.status);
      const profile = await db.dispatchProfile.findUnique({
        where: { staffId: auth.session.staffId },
        include: {
          assignments: {
            include: { order: true, dispatcher: { include: { staff: true } } },
            orderBy: { createdAt: "desc" },
            take: 40,
          },
        },
      });
      if (!profile) return fail("No dispatch profile found for this account.", 404);
      return ok({ assignments: profile.assignments.map(serializeAssignment), availability: profile.availability });
    }

    const auth = await requireStaff("dispatch.manage");
    if ("error" in auth) return fail(auth.error, auth.status);

    const [assignments, dispatchers, settings] = await Promise.all([
      db.dispatchAssignment.findMany({
        include: { order: true, dispatcher: { include: { staff: true } } },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.dispatchProfile.findMany({
        include: {
          staff: true,
          assignments: { where: { status: { in: ["assigned", "accepted", "collected", "out_for_delivery"] } } },
        },
      }),
      getSettings(),
    ]);

    const completedCounts = await db.dispatchAssignment.groupBy({
      by: ["dispatcherId"],
      where: { status: "delivered" },
      _count: true,
    });

    const dispatcherDTOs: DispatcherDTO[] = dispatchers.map((d) => ({
      id: d.id,
      staffId: d.staffId,
      name: d.staff.name,
      email: d.staff.email,
      phone: d.phone,
      vehicle: d.vehicle,
      availability: d.availability,
      status: d.staff.status,
      activeAssignments: d.assignments.length,
      completedCount: completedCounts.find((c) => c.dispatcherId === d.id)?._count ?? 0,
    }));

    // Delivery orders without an assignment become queue candidates
    const queueOrders = await db.order.findMany({
      where: { fulfillmentType: "delivery", status: { notIn: ["cancelled", "rejected", "completed"] }, assignment: null },
      include: { assignment: true },
      orderBy: { createdAt: "asc" },
    });

    return ok({
      assignments: assignments.map(serializeAssignment),
      dispatchers: dispatcherDTOs,
      queue: queueOrders.map((o) => ({
        orderId: o.id,
        reference: o.reference,
        customerName: o.customerName,
        address: o.address,
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        paymentStatus: o.paymentStatus,
      })),
      serviceAreas: settings.delivery.areas,
      baseFee: settings.delivery.baseFee,
      deliveryEnabled: settings.delivery.enabled,
    });
  } catch (err) {
    safeErrorLog("admin.dispatch.GET", err);
    return fail("Failed to load dispatch data.", 500);
  }
}

const postSchema = z.object({
  action: z.enum(["assign", "unassign"]),
  orderId: z.string().optional(),
  dispatcherId: z.string().nullable().optional(),
  assignmentId: z.string().optional(),
  fee: z.number().int().min(0).optional(),
  note: z.string().max(300).optional(),
});

/** POST /api/admin/dispatch — manual assignment / reassignment (spec §9). */
export async function POST(req: Request) {
  const auth = await requireStaff("dispatch.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = postSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { action, orderId, dispatcherId, assignmentId, fee, note } = parsed.data;

  try {
    if (action === "assign" && orderId) {
      const order = await db.order.findUnique({ where: { id: orderId } });
      if (!order) return fail("Order not found.", 404);
      if (order.fulfillmentType !== "delivery") return fail("Only delivery orders can be dispatched.", 409);
      const dispatcher = dispatcherId
        ? await db.dispatchProfile.findUnique({ where: { id: dispatcherId }, include: { staff: true } })
        : null;
      const existing = await db.dispatchAssignment.findUnique({ where: { orderId } });
      const assignment = await db.dispatchAssignment.upsert({
        where: { orderId },
        create: {
          orderId,
          dispatcherId: dispatcher?.id ?? null,
          status: dispatcher ? "assigned" : "awaiting",
          fee: fee ?? order.deliveryFee,
          note,
          assignedBy: auth.session.name,
          assignedAt: dispatcher ? new Date() : null,
        },
        update: {
          dispatcherId: dispatcher?.id ?? null,
          status: dispatcher ? "assigned" : "awaiting",
          fee: fee ?? order.deliveryFee,
          note,
          assignedBy: auth.session.name,
          assignedAt: dispatcher ? new Date() : null,
        },
        include: { order: true, dispatcher: { include: { staff: true } } },
      });
      await db.order.update({
        where: { id: orderId },
        data: { events: { create: { type: "dispatch", message: dispatcher ? `Assigned to ${dispatcher.staff.name}` : "Awaiting dispatcher assignment", actor: auth.session.name } } },
      });
      if (dispatcher) {
        await notify({ type: "dispatch_assigned", subject: `Dispatch assigned: ${order.reference}`, payload: { reference: order.reference, dispatcher: dispatcher.staff.name } });
      }
      await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "dispatch.assign", target: order.reference, meta: { dispatcher: dispatcher?.staff.name } });
      return ok({ assignment: serializeAssignment(assignment) });
    }

    if (action === "unassign" && assignmentId) {
      await db.dispatchAssignment.update({
        where: { id: assignmentId },
        data: { dispatcherId: null, status: "awaiting", assignedAt: null, assignedBy: auth.session.name },
      });
      await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "dispatch.unassign", target: assignmentId });
      return ok({ success: true });
    }
    return fail("Invalid action.", 422);
  } catch (err) {
    safeErrorLog("admin.dispatch.POST", err);
    return fail("Failed to assign dispatch.", 500);
  }
}

const patchSchema = z.object({
  assignmentId: z.string().min(1),
  status: z.enum(["accepted", "collected", "out_for_delivery", "delivered", "failed", "returned", "awaiting"]),
  reason: z.string().max(300).optional(),
});

/** PATCH /api/admin/dispatch — assignment lifecycle transitions (dispatcher or manager). */
export async function PATCH(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { assignmentId, status, reason } = parsed.data;

  try {
    const assignment = await db.dispatchAssignment.findUnique({
      where: { id: assignmentId },
      include: { order: true, dispatcher: { include: { staff: true } } },
    });
    if (!assignment) return fail("Assignment not found.", 404);

    // Dispatchers may only touch their own assignments; managers need dispatch.manage
    const isManager = auth.session.permissions.includes("dispatch.manage");
    const isOwnDispatcher = assignment.dispatcher?.staffId === auth.session.staffId;
    if (!isManager && !isOwnDispatcher) {
      return fail("You can only update your own assigned deliveries.", 403);
    }

    const allowed = DISPATCH_TRANSITIONS[assignment.status] || [];
    if (!allowed.includes(status)) {
      return fail(`Cannot move delivery from "${assignment.status}" to "${status}".`, 409);
    }
    if ((status === "failed" || status === "returned") && !reason) {
      return fail("A reason is required for failed deliveries.", 422);
    }

    const now = new Date();
    const updated = await db.dispatchAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        failureReason: status === "failed" || status === "returned" ? reason : assignment.failureReason,
        acceptedAt: status === "accepted" ? now : assignment.acceptedAt,
        collectedAt: status === "collected" ? now : assignment.collectedAt,
        deliveredAt: status === "delivered" ? now : assignment.deliveredAt,
      },
      include: { order: true, dispatcher: { include: { staff: true } } },
    });

    const messages: Record<string, string> = {
      accepted: "Delivery accepted by dispatcher",
      collected: "Order collected from kitchen",
      out_for_delivery: "Out for delivery",
      delivered: "Delivered successfully",
      failed: `Delivery failed: ${reason}`,
      returned: `Order returned: ${reason}`,
      awaiting: "Returned to assignment queue",
    };
    // Mirror dispatch state onto the customer-visible order timeline
    const orderStatusMap: Record<string, string> = { delivered: "completed" };
    await db.order.update({
      where: { id: assignment.orderId },
      data: {
        events: { create: { type: "dispatch", message: messages[status] || status, actor: auth.session.name } },
        ...(orderStatusMap[status] ? { status: orderStatusMap[status] } : {}),
      },
    });
    if (status === "delivered") {
      await notify({ type: "dispatch_completed", subject: `Order ${assignment.order.reference} delivered`, payload: { reference: assignment.order.reference } });
    }
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: `dispatch.${status}`, target: assignment.order.reference, meta: { reason } });
    return ok({ assignment: serializeAssignment(updated) });
  } catch (err) {
    safeErrorLog("admin.dispatch.PATCH", err);
    return fail("Failed to update assignment.", 500);
  }
}

type AssignmentWithRelations = {
  id: string; orderId: string; status: string; fee: number; note: string | null;
  failureReason: string | null; dispatcherId: string | null; assignedAt: Date | null;
  deliveredAt: Date | null; createdAt: Date;
  order: { reference: string; customerName: string; customerPhone: string; address: string | null; status: string; total: number };
  dispatcher: { staff: { name: string } } | null;
};

function serializeAssignment(a: AssignmentWithRelations): DispatchAssignmentDTO {
  return {
    id: a.id,
    orderId: a.orderId,
    orderReference: a.order.reference,
    customerName: a.order.customerName,
    customerPhone: a.order.customerPhone,
    address: a.order.address,
    status: a.status,
    fee: a.fee,
    note: a.note,
    failureReason: a.failureReason,
    dispatcherId: a.dispatcherId,
    dispatcherName: a.dispatcher?.staff?.name ?? null,
    assignedAt: a.assignedAt?.toISOString() ?? null,
    deliveredAt: a.deliveredAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    orderStatus: a.order.status,
    orderTotal: a.order.total,
  };
}
