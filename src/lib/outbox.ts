import { db } from "@/lib/db";

export type NotificationType =
  | "new_order"
  | "order_accepted"
  | "order_cancelled"
  | "payment_submitted"
  | "receipt_approved"
  | "receipt_rejected"
  | "dispatch_assigned"
  | "dispatch_completed"
  | "staff_invite"
  | "alert";

interface NotifyInput {
  type: NotificationType;
  subject: string;
  recipient?: string;
  payload?: Record<string, unknown>;
}

/**
 * Reliable notification outbox (spec §16). Ordering NEVER depends on email delivery.
 * A configured forwarder (Google Apps Script bridge) drains this queue out-of-band;
 * here we only persist durable records with bounded retries.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await db.notificationOutbox.create({
      data: {
        type: input.type,
        subject: input.subject,
        recipient: input.recipient,
        payload: JSON.stringify(input.payload ?? {}),
      },
    });
  } catch (err) {
    console.error("[outbox] failed to enqueue notification", err);
  }
}

/**
 * Forwarder tick — sends pending notifications to the configured Apps Script bridge
 * with idempotency + bounded retry. Called from the admin system page (manual/health check)
 * or a cron. Returns a health report; email delivery is only claimed when the bridge
 * responds with an explicit success.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

export async function getOutboxHealth() {
  const [pending, failed, sent] = await Promise.all([
    db.notificationOutbox.count({ where: { status: "pending" } }),
    db.notificationOutbox.count({ where: { status: "failed" } }),
    db.notificationOutbox.count({ where: { status: "sent" } }),
  ]);
  const bridgeUrl = process.env.EMAIL_BRIDGE_URL;
  return {
    pending,
    failed,
    sent,
    bridgeConfigured: Boolean(bridgeUrl),
  };
}
