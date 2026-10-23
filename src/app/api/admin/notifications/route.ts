import { db } from "@/lib/db";
import { ok, fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { getOutboxHealth } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/** GET /api/admin/notifications — notification outbox + delivery health (spec §16). */
export async function GET() {
  const auth = await requireStaff("settings.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const [items, health] = await Promise.all([
      db.notificationOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      getOutboxHealth(),
    ]);
    return ok({
      health,
      items: items.map((i) => ({
        id: i.id,
        type: i.type,
        subject: i.subject,
        recipient: i.recipient,
        status: i.status,
        attempts: i.attempts,
        lastError: i.lastError,
        createdAt: i.createdAt.toISOString(),
        sentAt: i.sentAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    safeErrorLog("admin.notifications", err);
    return fail("Failed to load notifications.", 500);
  }
}
