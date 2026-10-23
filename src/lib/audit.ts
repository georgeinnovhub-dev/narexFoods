import { db } from "@/lib/db";

export interface AuditInput {
  actor: string;
  actorId?: string;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
}

/** Record a privileged/sensitive operation. Never throws into the caller's path. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actor: input.actor,
        actorId: input.actorId,
        action: input.action,
        target: input.target,
        meta: JSON.stringify(input.meta ?? {}),
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", err);
  }
}
