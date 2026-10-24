import { ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return ok({ staff: null });
  const staff = await db.staffMember.findUnique({ where: { id: session.staffId }, include: { role: true } });
  if (!staff || staff.status !== "active") return ok({ staff: null });
  return ok({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role.name,
      permissions: JSON.parse(staff.role.permissions || "[]"),
    },
  });
}
