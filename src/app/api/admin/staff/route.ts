import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { hashPassword, generateInviteToken } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/outbox";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function validPermissions(perms: string[]): string[] {
  return perms.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
}

/** GET /api/admin/staff */
export async function GET() {
  const auth = await requireStaff("staff.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const staff = await db.staffMember.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      staff: staff.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        roleId: s.roleId,
        roleName: s.role.name,
        status: s.status,
        department: s.department,
        hasPassword: Boolean(s.passwordHash),
        createdAt: s.createdAt.toISOString(),
        lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
      })),
      roles: (await db.role.findMany({ include: { _count: { select: { staff: true } } }, orderBy: { name: "asc" } })).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: JSON.parse(r.permissions || "[]"),
        isSystem: r.isSystem,
        staffCount: r._count.staff,
      })),
    });
  } catch (err) {
    safeErrorLog("admin.staff.GET", err);
    return fail("Failed to load staff.", 500);
  }
}

const inviteSchema = z.object({
  email: z.string().email().max(120),
  name: z.string().min(2).max(80),
  roleId: z.string().min(1),
  department: z.string().max(60).optional(),
  password: z.string().min(8).max(120).optional(),
});

/** POST /api/admin/staff — invite/enroll staff. Prevents self-promotion beyond own perms (spec §8). */
export async function POST(req: Request) {
  const auth = await requireStaff("staff.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = inviteSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid staff data", 422);
  const { email, name, roleId, department, password } = parsed.data;

  try {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) return fail("Role not found.", 404);

    const myPerms = new Set(auth.session.permissions);
    const targetPerms = JSON.parse(role.permissions || "[]") as string[];
    // Superadmin bypasses; otherwise enroller cannot grant permissions they don't have
    if (!myPerms.has("settings.manage")) {
      const escalation = targetPerms.filter((p) => !myPerms.has(p as Permission));
      if (escalation.length > 0) {
        return fail(`You cannot assign permissions you do not hold: ${escalation.join(", ")}`, 403);
      }
    }

    const existing = await db.staffMember.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return fail("A staff member with this email already exists.", 409);

    const inviteToken = generateInviteToken();
    const staff = await db.staffMember.create({
      data: {
        email: email.toLowerCase(),
        name,
        roleId,
        status: password ? "active" : "pending",
        department,
        passwordHash: password ? hashPassword(password) : null,
        invitedBy: auth.session.name,
      },
    });
    if (role.name === "Dispatcher") {
      await db.dispatchProfile.upsert({
        where: { staffId: staff.id },
        create: { staffId: staff.id },
        update: {},
      });
    }
    await notify({ type: "staff_invite", subject: `Staff invited: ${name} (${role.name})`, payload: { email, role: role.name } });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "staff.invite", target: email, meta: { role: role.name } });
    return ok({
      staff: { id: staff.id, email: staff.email, name: staff.name, status: staff.status },
      // One-time enrollment secret shown to admin for secure handoff (spec §8)
      inviteToken,
      temporaryPassword: password ? undefined : undefined,
    }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.staff.POST", err);
    return fail("Failed to invite staff member.", 500);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["activate", "suspend", "deactivate", "set_role", "set_password", "set_department"]),
  roleId: z.string().optional(),
  password: z.string().min(8).max(120).optional(),
  department: z.string().max(60).optional(),
});

/** PATCH /api/admin/staff — activation, suspension, role & password management (audited). */
export async function PATCH(req: Request) {
  const auth = await requireStaff("staff.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid request", 422);
  const { id, action, roleId, password, department } = parsed.data;

  try {
    if (id === auth.session.staffId && (action === "suspend" || action === "deactivate")) {
      return fail("You cannot suspend or deactivate your own account.", 409);
    }
    const staff = await db.staffMember.findUnique({ where: { id }, include: { role: true } });
    if (!staff) return fail("Staff member not found.", 404);

    const updates: Record<string, unknown> = {};
    let auditAction = "staff.update";
    if (action === "activate") {
      if (!staff.passwordHash) return fail("Set an enrollment password first — the member cannot log in yet.", 409);
      updates.status = "active";
      auditAction = "staff.activate";
    } else if (action === "suspend") {
      updates.status = "suspended";
      auditAction = "staff.suspend";
    } else if (action === "deactivate") {
      updates.status = "pending";
      auditAction = "staff.deactivate";
    } else if (action === "set_role" && roleId) {
      const role = await db.role.findUnique({ where: { id: roleId } });
      if (!role) return fail("Role not found.", 404);
      const myPerms = new Set(auth.session.permissions);
      if (!myPerms.has("settings.manage")) {
        const targetPerms = JSON.parse(role.permissions || "[]") as string[];
        const escalation = targetPerms.filter((p) => !myPerms.has(p as Permission));
        if (escalation.length > 0) return fail(`You cannot assign permissions you do not hold: ${escalation.join(", ")}`, 403);
      }
      updates.roleId = roleId;
      auditAction = "staff.set_role";
      if (role.name === "Dispatcher") {
        await db.dispatchProfile.upsert({ where: { staffId: id }, create: { staffId: id }, update: {} });
      }
    } else if (action === "set_password" && password) {
      updates.passwordHash = hashPassword(password);
      updates.status = staff.status === "pending" ? "active" : staff.status;
      auditAction = "staff.set_password";
    } else if (action === "set_department" && department !== undefined) {
      updates.department = department;
    } else {
      return fail("Invalid action.", 422);
    }

    await db.staffMember.update({ where: { id }, data: updates });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: auditAction, target: staff.email });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.staff.PATCH", err);
    return fail("Failed to update staff member.", 500);
  }
}
