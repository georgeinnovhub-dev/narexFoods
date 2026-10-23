import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { safeParse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/blog — published articles for the storefront. */
export async function GET() {
  try {
    const posts = await db.blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: {
        id: true, slug: true, title: true, excerpt: true,
        coverImage: true, altText: true, tags: true, publishedAt: true,
      },
    });
    return ok({
      posts: posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        altText: p.altText,
        tags: safeParse<string[]>(p.tags, []),
        publishedAt: p.publishedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return ok({ posts: [] });
  }
}
