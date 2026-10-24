import { db } from "@/lib/db";
import { ok, readJson, rateLimit, clientKey } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/campaigns/[id]/event — engagement tracking (impressions/clicks/dismissals). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Rate limit — impression-spam would poison campaign analytics (spec §22)
  if (!rateLimit(clientKey(req, "campaign-event"), 30, 60_000)) {
    return ok({ success: false });
  }
  const { id } = await ctx.params;
  const body = await readJson<{ type?: string }>(req);
  const type = body?.type;
  if (!["impression", "click", "dismissal"].includes(type || "")) return ok({ success: false });
  const data =
    type === "impression"
      ? { impressions: { increment: 1 } }
      : type === "click"
        ? { clicks: { increment: 1 } }
        : { dismissals: { increment: 1 } };
  try {
    await db.campaign.update({ where: { id }, data });
  } catch {
    // analytics must never break the storefront
  }
  return ok({ success: true });
}
