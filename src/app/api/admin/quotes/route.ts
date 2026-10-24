import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/outbox";
import type { AdminQuoteListResponse, CateringQuoteDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const QUOTE_STATUSES = ["pending", "reviewing", "quoted", "approved", "rejected", "converted"];

function serializeQuote(q: {
  id: string; reference: string; name: string; phone: string; email: string | null;
  organization: string | null; serviceType: string; people: number; mealsPerPerson: number;
  eventDate: string | null; eventTime: string | null; venue: string | null; items: string;
  message: string | null; status: string; quotedTotal: number | null; depositAmount: number | null;
  adminNote: string | null; handledBy: string | null; createdAt: Date; updatedAt: Date;
}): CateringQuoteDTO {
  let items: { label: string; qty: number; note?: string }[] = [];
  try {
    const parsed = JSON.parse(q.items);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }
  return {
    id: q.id,
    reference: q.reference,
    name: q.name,
    phone: q.phone,
    email: q.email,
    organization: q.organization,
    serviceType: q.serviceType,
    people: q.people,
    mealsPerPerson: q.mealsPerPerson,
    eventDate: q.eventDate,
    eventTime: q.eventTime,
    venue: q.venue,
    items,
    message: q.message,
    status: q.status,
    quotedTotal: q.quotedTotal,
    depositAmount: q.depositAmount,
    adminNote: q.adminNote,
    handledBy: q.handledBy,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

/** GET /api/admin/quotes?status=&q=&page= — catering quotation queue (catering.manage). */
export async function GET(req: Request) {
  const auth = await requireStaff("catering.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize")) || 20));

  try {
    const where = {
      ...(status && QUOTE_STATUSES.includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q } },
              { name: { contains: q } },
              { phone: { contains: q } },
              { organization: { contains: q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.cateringQuote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.cateringQuote.count({ where }),
    ]);
    const response: AdminQuoteListResponse = {
      quotes: rows.map(serializeQuote),
      total,
      page,
      pageSize,
    };
    return ok(response);
  } catch (err) {
    safeErrorLog("admin.quotes.GET", err);
    return fail("Could not load quotations.", 500);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(QUOTE_STATUSES).optional(),
  quotedTotal: z.number().int().min(0).max(100_000_000).nullable().optional(), // pesewas
  depositAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
  adminNote: z.string().max(1000).optional().or(z.literal("")),
});

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  pending: ["reviewing", "quoted", "rejected"],
  reviewing: ["quoted", "rejected"],
  quoted: ["approved", "rejected", "reviewing"],
  approved: ["converted", "rejected"],
  rejected: [],
  converted: [],
};

/** PATCH /api/admin/quotes — move a quote through its lifecycle (catering.manage). */
export async function PATCH(req: Request) {
  const auth = await requireStaff("catering.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid quotation update.", 422);
  const { id, status, quotedTotal, depositAmount, adminNote } = parsed.data;

  try {
    const quote = await db.cateringQuote.findUnique({ where: { id } });
    if (!quote) return fail("Quotation not found.", 404);
    if (status && status !== quote.status) {
      const allowed = QUOTE_TRANSITIONS[quote.status] ?? [];
      if (!allowed.includes(status)) {
        return fail(`Cannot move a ${quote.status} quotation to ${status}.`, 409);
      }
      // An approved quotation must carry an agreed price (spec §8 — auditable)
      if (status === "quoted" || status === "approved") {
        const total = quotedTotal ?? quote.quotedTotal;
        if (total === null || total <= 0) {
          return fail("Set the quoted total before approving this quotation.", 422);
        }
      }
    }

    const updated = await db.cateringQuote.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(quotedTotal !== undefined ? { quotedTotal } : {}),
        ...(depositAmount !== undefined ? { depositAmount } : {}),
        ...(adminNote !== undefined ? { adminNote: adminNote || null } : {}),
        handledBy: auth.session.name,
      },
    });

    await logAudit({
      actor: auth.session.name,
      actorId: auth.session.staffId,
      action: "quote.update",
      target: quote.reference,
      meta: { status: status ?? quote.status, quotedTotal: updated.quotedTotal },
    });

    if (status === "quoted" && updated.quotedTotal) {
      await notify({
        type: "alert",
        subject: `Quotation ${quote.reference} ready — GH₵${(updated.quotedTotal / 100).toFixed(2)}`,
        payload: { reference: quote.reference, quotedTotal: updated.quotedTotal },
      });
    }

    return ok({ quote: serializeQuote(updated) });
  } catch (err) {
    safeErrorLog("admin.quotes.PATCH", err);
    return fail("Could not update the quotation.", 500);
  }
}
