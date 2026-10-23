import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { safeParse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/admin/audit?page= — audit history with pagination. */
export async function GET(req: Request) {
  const auth = await requireStaff("audit.view");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const action = searchParams.get("action") || undefined;
  try {
    const where = action && action !== "all" ? { action: { contains: action } } : {};
    const [total, events] = await Promise.all([
      db.auditEvent.count({ where }),
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 30,
        take: 30,
      }),
    ]);
    return ok({
      total,
      page,
      events: events.map((e) => ({
        id: e.id,
        actor: e.actor,
        actorId: e.actorId,
        action: e.action,
        target: e.target,
        meta: safeParse<Record<string, unknown>>(e.meta, {}),
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    safeErrorLog("admin.audit", err);
    return fail("Failed to load audit log.", 500);
  }
}
