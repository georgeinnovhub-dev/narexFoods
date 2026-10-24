import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * GET /api/evidence/[paymentId] — authorized, access-controlled receipt viewing.
 * Staff need payments.review permission; the customer can view their own evidence
 * with matching reference+phone (time-gated by rate limiting). Evidence is never public.
 */
export async function GET(req: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") || "";
  const phone = (searchParams.get("phone") || "").replace(/\s/g, "");

  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment || !payment.evidencePath) return fail("Not found", 404);

    const staff = await requireStaff("payments.review");
    const isAuthorizedStaff = "session" in staff;
    const isOwner =
      reference &&
      phone &&
      payment.order.reference === reference.toUpperCase() &&
      payment.order.customerPhone === phone;

    if (!isAuthorizedStaff && !isOwner) return fail("Unauthorized", 403);

    // Path safety — never allow traversal
    const safe = path.basename(payment.evidencePath);
    const buffer = await readFile(path.join(UPLOAD_DIR, safe));
    const ext = safe.split(".").pop() || "jpg";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    safeErrorLog("evidence.GET", err);
    return fail("Not found", 404);
  }
}
