import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["set_availability", "set_details"]),
  availability: z.enum(["online", "offline", "busy"]).optional(),
  phone: z.string().max(15).optional(),
  vehicle: z.string().max(60).optional(),
  serviceAreas: z.array(z.string().max(60)).max(10).optional(),
});

/** PATCH /api/admin/dispatchers — dispatcher profile & availability management. */
export async function PATCH(req: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { id, action, availability, phone, vehicle, serviceAreas } = parsed.data;

  try {
    const profile = await db.dispatchProfile.findUnique({ where: { id } });
    if (!profile) return fail("Dispatcher profile not found.", 404);
    const isSelf = profile.staffId === auth.session.staffId;
    const isManager = auth.session.permissions.includes("dispatch.manage");
    if (!isSelf && !isManager) return fail("Unauthorized.", 403);

    if (action === "set_availability") {
      if (!availability) return fail("Availability is required.", 422);
      await db.dispatchProfile.update({ where: { id }, data: { availability } });
      return ok({ success: true });
    }
    // set_details
    if (!isManager && !isSelf) return fail("Unauthorized.", 403);
    await db.dispatchProfile.update({
      where: { id },
      data: {
        ...(phone !== undefined ? { phone } : {}),
        ...(vehicle !== undefined ? { vehicle } : {}),
        ...(serviceAreas ? { serviceAreas: JSON.stringify(serviceAreas) } : {}),
      },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "dispatch.profile_update", target: id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.dispatchers.PATCH", err);
    return fail("Failed to update dispatcher.", 500);
  }
}
