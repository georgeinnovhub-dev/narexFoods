import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { safeParse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/content/[page] — published website content with safe fallback. */
export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params;
  try {
    const content = await db.websiteContent.findUnique({ where: { page } });
    return ok({ page, data: safeParse(content?.data ?? null, {}), revision: content?.revision ?? 0 });
  } catch {
    return ok({ page, data: {}, revision: 0 });
  }
}
