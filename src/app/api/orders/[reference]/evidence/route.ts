import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok, fail, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { notify } from "@/lib/outbox";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/**
 * POST /api/orders/[reference]/evidence — protected manual-payment receipt upload.
 * Evidence NEVER marks the order paid (spec §7) — it only moves the payment
 * to `awaiting_review` for a staff member to verify.
 */
export async function POST(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  if (!rateLimit(clientKey(req, "evidence"), 10, 60_000)) {
    return fail("Too many uploads. Please wait a moment.", 429);
  }
  const { reference } = await ctx.params;
  try {
    const form = await req.formData();
    const phone = String(form.get("phone") || "").replace(/\s/g, "");
    const file = form.get("file");

    if (!file || typeof file === "string") return fail("Please attach your payment evidence image.", 422);
    if (file.size > MAX_SIZE) return fail("File is too large (max 5MB).", 422);
    const ext = ALLOWED_TYPES.get(file.type);
    if (!ext) return fail("Only JPG, PNG or WEBP images are accepted.", 422);

    const order = await db.order.findUnique({ where: { reference: reference.toUpperCase() } });
    if (!order || order.customerPhone !== phone) {
      return fail("Order not found. Check the reference and phone number.", 404);
    }

    // Validate actual bytes are an image (magic numbers)
    const bytes = Buffer.from(await file.arrayBuffer());
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF";
    if (!isJpg && !isPng && !isWebp) return fail("The file is not a valid image.", 422);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, safeName), bytes);

    // Find the manual payment record for this order
    const payment = await db.payment.findFirst({
      where: { orderId: order.id, provider: "manual" },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) return fail("Payment record missing for this order.", 409);

    const updated = await db.payment.update({
      where: { id: payment.id },
      data: {
        evidencePath: safeName, // stored OUTSIDE public/ — only served via authorized endpoint
        evidenceName: file.name.slice(0, 120),
        status: "awaiting_review",
      },
    });

    await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "pending_verification",
        events: { create: { type: "payment", message: "Payment evidence submitted — awaiting review", actor: "customer" } },
      },
    });

    await db.paymentEvent.create({
      data: { paymentId: updated.id, type: "review", status: "submitted", detail: "Customer uploaded payment evidence" },
    });
    await notify({
      type: "payment_submitted",
      subject: `Payment evidence submitted for order ${order.reference}`,
      payload: { reference: order.reference, paymentId: updated.id },
    });
    await logAudit({ actor: "customer", action: "payment.evidence_upload", target: order.reference });

    return ok({ success: true, status: "awaiting_review", message: "Payment evidence received. We will verify it shortly." });
  } catch (err) {
    safeErrorLog("evidence.POST", err);
    return fail("Upload failed. Please try again.", 500);
  }
}
