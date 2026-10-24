import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(2).max(80), sortOrder: z.number().int().default(0) });

export async function GET() {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return ok({ categories });
}

export async function POST(req: Request) {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid category data", 422);
  try {
    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const category = await db.category.upsert({
      where: { slug },
      create: { name: parsed.data.name, slug, sortOrder: parsed.data.sortOrder },
      update: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
    });
    return ok({ category }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.categories.POST", err);
    return fail("Failed to save category.", 500);
  }
}
