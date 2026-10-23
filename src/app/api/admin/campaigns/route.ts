import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(120),
  message: z.string().min(2).max(500),
  image: z.string().max(300).nullable().optional(),
  ctaLabel: z.string().max(40).nullable().optional(),
  ctaUrl: z.string().max(300).nullable().optional(),
  placement: z.enum(["popup", "banner"]).default("popup"),
  status: z.enum(["draft", "scheduled", "active", "paused", "expired"]).default("draft"),
  priority: z.number().int().min(0).max(100).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  audience: z.enum(["all", "new", "returning"]).default("all"),
  pageTarget: z.string().max(40).default("all"),
  device: z.enum(["all", "mobile", "desktop"]).default("all"),
  showOnce: z.boolean().default(true),
});

/** GET /api/admin/campaigns — all campaigns with engagement analytics (spec §12). */
export async function GET() {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const campaigns = await db.campaign.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
  return ok({
    campaigns: campaigns.map((c) => ({
      id: c.id, title: c.title, message: c.message, image: c.image, ctaLabel: c.ctaLabel,
      ctaUrl: c.ctaUrl, placement: c.placement, status: c.status, priority: c.priority,
      startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null,
      audience: c.audience, pageTarget: c.pageTarget, device: c.device, showOnce: c.showOnce,
      impressions: c.impressions, clicks: c.clicks, dismissals: c.dismissals,
    })),
  });
}

/** POST /api/admin/campaigns */
export async function POST(req: Request) {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid campaign", 422);
  const d = parsed.data;
  try {
    const campaign = await db.campaign.create({
      data: {
        ...d,
        image: d.image || null, ctaLabel: d.ctaLabel || null, ctaUrl: d.ctaUrl || null,
        startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "campaign.create", target: campaign.title });
    return ok({ campaign: { id: campaign.id } }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.campaigns.POST", err);
    return fail("Failed to create campaign.", 500);
  }
}

/** PATCH /api/admin/campaigns — status workflow + scheduling */
export async function PATCH(req: Request) {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { id?: string; status?: string; priority?: number };
  if (!body?.id) return fail("Campaign id required.", 422);
  try {
    const updates: Record<string, unknown> = {};
    if (body.status && ["draft", "scheduled", "active", "paused", "expired"].includes(body.status)) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    await db.campaign.update({ where: { id: body.id }, data: updates });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "campaign.update", target: body.id, meta: { status: body.status } });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.campaigns.PATCH", err);
    return fail("Failed to update campaign.", 500);
  }
}

/** DELETE /api/admin/campaigns?id= */
export async function DELETE(req: Request) {
  const auth = await requireStaff("marketing.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Campaign id required.", 422);
  try {
    await db.campaign.delete({ where: { id } });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "campaign.delete", target: id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.campaigns.DELETE", err);
    return fail("Failed to delete campaign.", 500);
  }
}
