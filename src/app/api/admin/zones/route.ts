import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseZoneAreas } from "@/lib/zones";
import type { AdminZoneListResponse, ZoneDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

function serializeZone(z: {
  id: string; name: string; areas: string; fee: number; minSubtotal: number;
  leadMinutes: number; requiresQuote: boolean; note: string; active: boolean; sortOrder: number;
}): ZoneDTO {
  return {
    id: z.id,
    name: z.name,
    areas: parseZoneAreas(z.areas),
    fee: z.fee,
    minSubtotal: z.minSubtotal,
    leadMinutes: z.leadMinutes,
    requiresQuote: z.requiresQuote,
    note: z.note,
  };
}

/** GET /api/admin/zones — all zones including inactive (zones.manage). */
export async function GET() {
  const auth = await requireStaff("zones.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const rows = await db.deliveryZone.findMany({ orderBy: { sortOrder: "asc" } });
    const response: AdminZoneListResponse = { zones: rows.map(serializeZone) };
    return ok(response);
  } catch (err) {
    safeErrorLog("admin.zones.GET", err);
    return fail("Could not load delivery zones.", 500);
  }
}

const zoneSchema = z.object({
  id: z.string().optional(), // PATCH target
  name: z.string().min(2).max(80),
  areas: z.array(z.string().min(1).max(60)).min(1).max(40),
  fee: z.number().int().min(0).max(1_000_000),
  minSubtotal: z.number().int().min(0).max(1_000_000),
  leadMinutes: z.number().int().min(15).max(10080),
  requiresQuote: z.boolean().default(false),
  note: z.string().max(300).default(""),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** POST /api/admin/zones — create a delivery zone (zones.manage). */
export async function POST(req: Request) {
  const auth = await requireStaff("zones.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = zoneSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid zone data.", 422);
  const d = parsed.data;
  try {
    const zone = await db.deliveryZone.create({
      data: { ...d, areas: JSON.stringify(d.areas) },
    });
    await logAudit({
      actor: auth.session.name,
      actorId: auth.session.staffId,
      action: "zone.create",
      target: zone.name,
    });
    return ok({ zone: serializeZone(zone) }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.zones.POST", err);
    return fail("Could not create the delivery zone.", 500);
  }
}

/** PATCH /api/admin/zones — update a delivery zone (zones.manage). */
export async function PATCH(req: Request) {
  const auth = await requireStaff("zones.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = zoneSchema.extend({ id: z.string().min(1) }).safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid zone data.", 422);
  const { id, ...d } = parsed.data;
  try {
    const existing = await db.deliveryZone.findUnique({ where: { id } });
    if (!existing) return fail("Delivery zone not found.", 404);
    const zone = await db.deliveryZone.update({
      where: { id },
      data: { ...d, areas: JSON.stringify(d.areas) },
    });
    await logAudit({
      actor: auth.session.name,
      actorId: auth.session.staffId,
      action: "zone.update",
      target: zone.name,
    });
    return ok({ zone: serializeZone(zone) });
  } catch (err) {
    safeErrorLog("admin.zones.PATCH", err);
    return fail("Could not update the delivery zone.", 500);
  }
}

/** DELETE /api/admin/zones?id= — deactivate (archive) a delivery zone (zones.manage). */
export async function DELETE(req: Request) {
  const auth = await requireStaff("zones.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Zone id is required.", 422);
  try {
    // Soft-deactivate: historical orders keep their zone snapshot
    const zone = await db.deliveryZone.update({ where: { id }, data: { active: false } });
    await logAudit({
      actor: auth.session.name,
      actorId: auth.session.staffId,
      action: "zone.deactivate",
      target: zone.name,
    });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.zones.DELETE", err);
    return fail("Could not deactivate the delivery zone.", 500);
  }
}
