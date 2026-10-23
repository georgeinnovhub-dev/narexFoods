import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { safeParse } from "@/lib/serialize";
import type { ProductDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).default(""),
  categoryId: z.string().nullable().optional(),
  images: z.array(z.string().max(300)).max(10).default([]),
  altText: z.string().max(200).default(""),
  prepMinutes: z.number().int().min(1).max(240).default(20),
  featured: z.boolean().default(false),
  bestSeller: z.boolean().default(false),
  available: z.boolean().default(true),
  soldOut: z.boolean().default(false),
  archived: z.boolean().default(false),
  availableFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  availableTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  sortOrder: z.number().int().default(0),
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(60),
        price: z.number().int().min(0).max(1000000),
        available: z.boolean().default(true),
      })
    )
    .min(1),
  addons: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(60),
        price: z.number().int().min(0).max(1000000),
        available: z.boolean().default(true),
      })
    )
    .default([]),
});

function serializeProduct(p: {
  id: string; name: string; slug: string; description: string; categoryId: string | null;
  category?: { name: string } | null; images: string; altText: string; prepMinutes: number;
  featured: boolean; bestSeller: boolean; available: boolean; soldOut: boolean; archived: boolean;
  sortOrder: number; seoTitle: string | null; seoDescription: string | null; createdAt: Date;
  variants: { id: string; name: string; price: number; available: boolean }[];
  addons: { id: string; name: string; price: number; available: boolean }[];
}): ProductDTO {
  return {
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    categoryId: p.categoryId, categoryName: p.category?.name ?? null,
    images: safeParse<string[]>(p.images, []), altText: p.altText, prepMinutes: p.prepMinutes,
    featured: p.featured, bestSeller: p.bestSeller, available: p.available,
    soldOut: p.soldOut, archived: p.archived, prep: p.prepMinutes, sortOrder: p.sortOrder,
    variants: p.variants, addons: p.addons, seoTitle: p.seoTitle,
    seoDescription: p.seoDescription, createdAt: p.createdAt.toISOString(),
  };
}

/** GET /api/admin/products?includeArchived=1 */
export async function GET(req: Request) {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "1";
  try {
    const products = await db.product.findMany({
      where: includeArchived ? {} : { archived: false },
      include: { variants: { orderBy: { sortOrder: "asc" } }, addons: { orderBy: { sortOrder: "asc" } }, category: true },
      orderBy: { sortOrder: "asc" },
    });
    return ok({ products: products.map(serializeProduct) });
  } catch (err) {
    safeErrorLog("admin.products.GET", err);
    return fail("Failed to load products.", 500);
  }
}

/** POST /api/admin/products */
export async function POST(req: Request) {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = upsertSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid product data", 422);
  const d = parsed.data;
  try {
    const existing = await db.product.findUnique({ where: { slug: d.slug } });
    if (existing) return fail("A product with this slug already exists.", 409);
    const product = await db.product.create({
      data: {
        name: d.name, slug: d.slug, description: d.description, categoryId: d.categoryId || null,
        images: JSON.stringify(d.images), altText: d.altText, prepMinutes: d.prepMinutes,
        featured: d.featured, bestSeller: d.bestSeller, available: d.available, soldOut: d.soldOut,
        archived: d.archived, availableFrom: d.availableFrom || null, availableTo: d.availableTo || null,
        sortOrder: d.sortOrder, seoTitle: d.seoTitle, seoDescription: d.seoDescription,
        variants: { create: d.variants.map((v, i) => ({ name: v.name, price: v.price, available: v.available, sortOrder: i })) },
        addons: { create: d.addons.map((a, i) => ({ name: a.name, price: a.price, available: a.available, sortOrder: i })) },
      },
      include: { variants: true, addons: true, category: true },
    });
    await (await import("@/lib/audit")).logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "product.create", target: product.name });
    return ok({ product: serializeProduct(product) }, { status: 201 });
  } catch (err) {
    safeErrorLog("admin.products.POST", err);
    return fail("Failed to create product.", 500);
  }
}

/** PATCH /api/admin/products — update or replace variants/addons */
export async function PUT(req: Request) {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const body = await readJson(req) as { id?: string } & Record<string, unknown>;
  if (!body?.id) return fail("Product id is required.", 422);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid product data", 422);
  const d = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: body.id as string } });
      await tx.productAddOn.deleteMany({ where: { productId: body.id as string } });
      await tx.product.update({
        where: { id: body.id as string },
        data: {
          name: d.name, slug: d.slug, description: d.description, categoryId: d.categoryId || null,
          images: JSON.stringify(d.images), altText: d.altText, prepMinutes: d.prepMinutes,
          featured: d.featured, bestSeller: d.bestSeller, available: d.available, soldOut: d.soldOut,
          archived: d.archived, availableFrom: d.availableFrom || null, availableTo: d.availableTo || null,
          sortOrder: d.sortOrder, seoTitle: d.seoTitle, seoDescription: d.seoDescription,
          variants: { create: d.variants.map((v, i) => ({ name: v.name, price: v.price, available: v.available, sortOrder: i })) },
          addons: { create: d.addons.map((a, i) => ({ name: a.name, price: a.price, available: a.available, sortOrder: i })) },
        },
      });
    });
    await (await import("@/lib/audit")).logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "product.update", target: d.name });
    const product = await db.product.findUnique({
      where: { id: body.id as string },
      include: { variants: { orderBy: { sortOrder: "asc" } }, addons: { orderBy: { sortOrder: "asc" } }, category: true },
    });
    return ok({ product: product ? serializeProduct(product) : null });
  } catch (err) {
    safeErrorLog("admin.products.PUT", err);
    return fail("Failed to update product. The slug may already be in use.", 500);
  }
}

/** DELETE /api/admin/products?id= — soft archive (never destructive while orders reference it) */
export async function DELETE(req: Request) {
  const auth = await requireStaff("menu.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Product id is required.", 422);
  try {
    await db.product.update({ where: { id }, data: { archived: true, featured: false } });
    await (await import("@/lib/audit")).logAudit({ actor: auth.session.name, actorId: auth.session.staffId, action: "product.archive", target: id });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("admin.products.DELETE", err);
    return fail("Failed to archive product.", 500);
  }
}
