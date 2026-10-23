import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { safeParse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/admin/content?page=home — draft (uncommitted local state) + published + revisions */
export async function GET(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") || "home";
  try {
    const [content, revisions] = await Promise.all([
      db.websiteContent.findUnique({ where: { page } }),
      db.contentRevision.findMany({ where: { page }, orderBy: { revision: "desc" }, take: 15 }),
    ]);
    return ok({
      page,
      published: safeParse(content?.data ?? null, null),
      revision: content?.revision ?? 0,
      updatedBy: content?.updatedBy ?? null,
      updatedAt: content?.updatedAt?.toISOString() ?? null,
      revisions: revisions.map((r) => ({
        revision: r.revision,
        updatedBy: r.updatedBy,
        createdAt: r.createdAt.toISOString(),
        data: safeParse(r.data, {}),
      })),
    });
  } catch (err) {
    safeErrorLog("admin.content.GET", err);
    return fail("Failed to load content.", 500);
  }
}

const putSchema = z.object({
  page: z.string().min(1).max(40),
  data: z.record(z.string(), z.unknown()),
  action: z.enum(["publish", "preview"]),
});

/**
 * PUT /api/admin/content — publish a new version (with revision history) (spec §13).
 * Structured JSON only — no arbitrary HTML/JS injection possible.
 */
export async function PUT(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = putSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid content payload", 422);
  const { page, data, action } = parsed.data;

  // Basic structural validation for the home page
  if (page === "home") {
    if (Array.isArray(data.heroSlides)) {
      if (data.heroSlides.length === 0 || data.heroSlides.length > 6) {
        return fail("Home page must have between 1 and 6 hero slides.", 422);
      }
      for (const slide of data.heroSlides as Record<string, unknown>[]) {
        if (typeof slide.title !== "string" || !slide.title.trim()) {
          return fail("Every hero slide needs a title.", 422);
        }
        if (slide.image && typeof slide.image === "string" && !slide.image.startsWith("/")) {
          return fail("Hero slide images must be site paths (starting with /).", 422);
        }
      }
    }
    if (data.story && typeof data.story === "object") {
      const story = data.story as Record<string, unknown>;
      if (story.image && typeof story.image === "string" && !story.image.startsWith("/")) {
        return fail("Story image must be a site path (starting with /).", 422);
      }
    }
  }

  try {
    const existing = await db.websiteContent.findUnique({ where: { page } });
    if (action === "preview") {
      // Preview returns the composed payload without persisting
      return ok({ preview: data });
    }
    const revision = (existing?.revision ?? 0) + 1;
    await db.$transaction([
      ...(existing
        ? [db.contentRevision.create({
            data: { page, data: existing.data, revision: existing.revision, updatedBy: existing.updatedBy },
          })]
        : []),
      db.websiteContent.upsert({
        where: { page },
        create: { page, data: JSON.stringify(data), revision: 1, updatedBy: auth.session.name },
        update: { data: JSON.stringify(data), revision, updatedBy: auth.session.name },
      }),
    ]);
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "content.publish", target: page, meta: { revision } });
    return ok({ success: true, revision });
  } catch (err) {
    safeErrorLog("admin.content.PUT", err);
    return fail("Failed to publish content.", 500);
  }
}

/** POST /api/admin/content — rollback to a previous revision */
export async function POST(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { page?: string; revision?: number };
  if (!body?.page || !body.revision) return fail("Page and revision are required.", 422);
  try {
    const revision = await db.contentRevision.findFirst({
      where: { page: body.page, revision: body.revision },
      orderBy: { createdAt: "desc" },
    });
    if (!revision) return fail("Revision not found.", 404);
    const existing = await db.websiteContent.findUnique({ where: { page: body.page } });
    const nextRev = (existing?.revision ?? 0) + 1;
    await db.$transaction([
      ...(existing
        ? [db.contentRevision.create({
            data: { page: body.page, data: existing.data, revision: existing.revision, updatedBy: existing.updatedBy },
          })]
        : []),
      db.websiteContent.upsert({
        where: { page: body.page },
        create: { page: body.page, data: revision.data, revision: 1, updatedBy: `${auth.session.name} (rollback)` },
        update: { data: revision.data, revision: nextRev, updatedBy: `${auth.session.name} (rollback)` },
      }),
    ]);
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "content.rollback", target: body.page, meta: { toRevision: body.revision } });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.content.POST", err);
    return fail("Failed to roll back.", 500);
  }
}
