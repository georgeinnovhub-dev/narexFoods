import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(200).default(""),
  permissions: z.array(z.string()).max(20),
});

/** POST /api/admin/roles — create custom roles with granular permission sets. */
export async function POST(req: Request) {
  const auth = await requireStaff("staff.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid role data", 422);
  const perms = parsed.data.permissions.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
  try {
    const existing = await db.role.findUnique({ where: { name: parsed.data.name } });
    if (existing) return fail("A role with this name already exists.", 409);
    const role = await db.role.create({
      data: { name: parsed.data.name, description: parsed.data.description, permissions: JSON.stringify(perms) },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "role.create", target: role.name, meta: { permissions: perms } });
    return ok({ role: { id: role.id, name: role.name } }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.roles.POST", err);
    return fail("Failed to create role.", 500);
  }
}

/** PATCH /api/admin/roles — edit custom role permissions (system roles protected). */
export async function PATCH(req: Request) {
  const auth = await requireStaff("staff.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { id?: string; permissions?: string[]; description?: string };
  if (!body?.id || !Array.isArray(body.permissions)) return fail("Invalid request", 422);
  try {
    const role = await db.role.findUnique({ where: { id: body.id } });
    if (!role) return fail("Role not found.", 404);
    if (role.isSystem) return fail("System roles cannot be edited.", 409);
    const perms = body.permissions.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
    await db.role.update({
      where: { id: role.id },
      data: {
        permissions: JSON.stringify(perms),
        description: body.description ?? role.description,
      },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "role.update", target: role.name, meta: { permissions: perms } });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.roles.PATCH", err);
    return fail("Failed to update role.", 500);
  }
}
