import { z } from "zod";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { getSettings, publicSettings, saveSettings } from "@/lib/settings";
import { getOutboxHealth } from "@/lib/outbox";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  brand: z.record(z.string(), z.string()).optional(),
  contact: z.record(z.string(), z.string()).optional(),
  hours: z.record(z.string(), z.string()).optional(),
  ordering: z.record(z.string(), z.unknown()).optional(),
  delivery: z.record(z.string(), z.unknown()).optional(),
  payments: z.record(z.string(), z.unknown()).optional(),
});

/** GET /api/admin/settings — full settings view (secrets never returned; only readiness flags). */
export async function GET() {
  const auth = await requireStaff("settings.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const settings = await getSettings();
    const outbox = await getOutboxHealth();
    return ok({
      settings: publicSettings(settings),
      integrations: {
        paystack: {
          enabled: settings.payments.paystack.enabled,
          secretConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
          publicKey: settings.payments.paystack.publicKey,
          ready: settings.payments.paystack.enabled && Boolean(process.env.PAYSTACK_SECRET_KEY),
        },
        zenobank: {
          enabled: false,
          ready: false,
          note: "Awaiting official Zenobank merchant documentation and credentials (spec §7). The adapter stays disabled until validated.",
        },
        emailBridge: {
          configured: Boolean(process.env.EMAIL_BRIDGE_URL),
          ...outbox,
        },
      },
    });
  } catch (err) {
    safeErrorLog("admin.settings.GET", err);
    return fail("Failed to load settings.", 500);
  }
}

/** PUT /api/admin/settings — structured settings updates (no secrets stored here). */
export async function PUT(req: Request) {
  const auth = await requireStaff("settings.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid settings payload", 422);
  try {
    // Never allow secrets into settings storage
    const patch = JSON.parse(JSON.stringify(parsed.data));
    if (patch.payments) {
      delete patch.payments.secretKey;
      delete patch.payments.apiKey;
      if (patch.payments.paystack) {
        delete patch.payments.paystack.secretKey;
        if (typeof patch.payments.paystack.publicKey === "string") {
          patch.payments.paystack.publicKey = patch.payments.paystack.publicKey.slice(0, 120);
        }
      }
    }
    const settings = await saveSettings(patch, auth.session.name);
    return ok({ settings: publicSettings(settings) });
  } catch (err) {
    safeErrorLog("admin.settings.PUT", err);
    return fail("Failed to save settings.", 500);
  }
}

/** POST /api/admin/settings — outbox drain tick (email bridge forwarder with bounded retries). */
export async function POST() {
  const auth = await requireStaff("settings.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const bridgeUrl = process.env.EMAIL_BRIDGE_URL;
    const pending = await db.notificationOutbox.findMany({
      where: { status: "pending", attempts: { lt: 5 } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    if (!bridgeUrl) {
      return ok({ success: false, message: "EMAIL_BRIDGE_URL is not configured — notifications remain queued in the outbox.", pending: pending.length });
    }
    let sent = 0;
    let failed = 0;
    for (const item of pending) {
      try {
        const res = await fetch(bridgeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Narex-Bridge-Key": process.env.EMAIL_BRIDGE_KEY || "" },
          body: JSON.stringify({
            id: item.id, // idempotency key for the bridge
            type: item.type,
            subject: item.subject,
            recipient: item.recipient,
            payload: JSON.parse(item.payload || "{}"),
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          await db.notificationOutbox.update({ where: { id: item.id }, data: { status: "sent", sentAt: new Date() } });
          sent += 1;
        } else throw new Error(`bridge responded ${res.status}`);
      } catch (err) {
        failed += 1;
        const attempts = item.attempts + 1;
        await db.notificationOutbox.update({
          where: { id: item.id },
          data: { attempts, status: attempts >= 5 ? "failed" : "pending", lastError: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
        });
      }
    }
    return ok({ success: true, sent, failed });
  } catch (err) {
    safeErrorLog("admin.settings.POST", err);
    return fail("Outbox drain failed.", 500);
  }
}
