import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(160),
  slug: z.string().min(2).max(180).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(300).default(""),
  content: z.string().max(50000).default(""),
  coverImage: z.string().max(300).nullable().optional(),
  altText: z.string().max(200).default(""),
  tags: z.array(z.string().max(30)).max(8).default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

/** GET /api/admin/blog */
export async function GET() {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const posts = await db.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return ok({
    posts: posts.map((p) => ({
      id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content,
      coverImage: p.coverImage, altText: p.altText, tags: safeArray(p.tags),
      status: p.status, author: p.author, publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

/** POST /api/admin/blog */
export async function POST(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid post", 422);
  const d = parsed.data;
  try {
    const existing = await db.blogPost.findUnique({ where: { slug: d.slug } });
    if (existing) return fail("A post with this slug already exists.", 409);
    const post = await db.blogPost.create({
      data: {
        ...d,
        coverImage: d.coverImage || null,
        tags: JSON.stringify(d.tags),
        author: auth.session.name,
        publishedAt: d.status === "published" ? new Date() : null,
      },
    });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "blog.create", target: post.title });
    return ok({ post: { id: post.id } }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.blog.POST", err);
    return fail("Failed to create post.", 500);
  }
}

/** PATCH /api/admin/blog — edit/publish/archive */
export async function PATCH(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { id?: string; status?: string; title?: string; excerpt?: string; content?: string; tags?: string[] };
  if (!body?.id) return fail("Post id required.", 422);
  try {
    const updates: Record<string, unknown> = {};
    if (body.title) updates.title = body.title;
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt;
    if (body.content !== undefined) updates.content = body.content;
    if (body.tags) updates.tags = JSON.stringify(body.tags);
    if (body.status && ["draft", "published", "archived"].includes(body.status)) {
      updates.status = body.status;
      if (body.status === "published") updates.publishedAt = new Date();
    }
    await db.blogPost.update({ where: { id: body.id }, data: updates });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "blog.update", target: body.id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.blog.PATCH", err);
    return fail("Failed to update post.", 500);
  }
}

/** DELETE /api/admin/blog?id= */
export async function DELETE(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Post id required.", 422);
  try {
    await db.blogPost.delete({ where: { id } });
    await logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "blog.delete", target: id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.blog.DELETE", err);
    return fail("Failed to delete post.", 500);
  }
}

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
