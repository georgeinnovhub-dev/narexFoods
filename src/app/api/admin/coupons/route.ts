import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const baseSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9]+$/i),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(1000000),
  minSubtotal: z.number().int().min(0).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

/** GET /api/admin/coupons */
export async function GET() {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return ok({
    coupons: coupons.map((c) => ({
      id: c.id, code: c.code, type: c.type, value: c.value, minSubtotal: c.minSubtotal,
      startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null,
      maxRedemptions: c.maxRedemptions, redeemedCount: c.redeemedCount, active: c.active,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

/** POST /api/admin/coupons */
export async function POST(req: Request) {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = baseSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid coupon", 422);
  const d = parsed.data;
  if (d.type === "percent" && d.value > 100) return fail("Percentage discount cannot exceed 100.", 422);
  try {
    const existing = await db.coupon.findUnique({ where: { code: d.code.toUpperCase() } });
    if (existing) return fail("A coupon with this code already exists.", 409);
    const coupon = await db.coupon.create({
      data: {
        code: d.code.toUpperCase(), type: d.type, value: d.value, minSubtotal: d.minSubtotal,
        startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null,
        maxRedemptions: d.maxRedemptions ?? null, active: d.active,
      },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "coupon.create", target: coupon.code });
    return ok({ coupon: { id: coupon.id } }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.coupons.POST", err);
    return fail("Failed to create coupon.", 500);
  }
}

/** PATCH /api/admin/coupons — activate/deactivate/edit */
export async function PATCH(req: Request) {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { id?: string; active?: boolean; value?: number; minSubtotal?: number };
  if (!body?.id) return fail("Coupon id required.", 422);
  try {
    const updates: Record<string, unknown> = {};
    if (body.active !== undefined) updates.active = body.active;
    if (body.value !== undefined) updates.value = body.value;
    if (body.minSubtotal !== undefined) updates.minSubtotal = body.minSubtotal;
    await db.coupon.update({ where: { id: body.id }, data: updates });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "coupon.update", target: body.id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.coupons.PATCH", err);
    return fail("Failed to update coupon.", 500);
  }
}
