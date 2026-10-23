import { db } from "@/lib/db";
import { getSettings, publicSettings } from "@/lib/settings";
import { ok, safeErrorLog } from "@/lib/api";
import type { BootstrapResponse } from "@/lib/types";
import { safeParse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, categories, products, campaigns] = await Promise.all([
      getSettings(),
      db.category.findMany({ orderBy: { sortOrder: "asc" } }),
      db.product.findMany({
        where: { archived: false },
        include: { variants: { orderBy: { sortOrder: "asc" } }, addons: { orderBy: { sortOrder: "asc" } }, category: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.campaign.findMany({
        where: {
          status: "active",
          OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
        },
        orderBy: { priority: "desc" },
        take: 3,
      }),
    ]);

    const response: BootstrapResponse = {
      settings: publicSettings(settings),
      categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        images: safeParse<string[]>(p.images, []),
        altText: p.altText,
        prepMinutes: p.prepMinutes,
        featured: p.featured,
        bestSeller: p.bestSeller,
        available: p.available,
        soldOut: p.soldOut,
        archived: p.archived,
        prep: p.prepMinutes,
        sortOrder: p.sortOrder,
        variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.available })),
        addons: p.addons.map((a) => ({ id: a.id, name: a.name, price: a.price, available: a.available })),
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        createdAt: p.createdAt.toISOString(),
      })),
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        message: c.message,
        image: c.image,
        ctaLabel: c.ctaLabel,
        ctaUrl: c.ctaUrl,
        placement: c.placement as "popup" | "banner",
        showOnce: c.showOnce,
      })),
      serverTime: new Date().toISOString(),
    };
    return ok(response);
  } catch (err) {
    safeErrorLog("bootstrap", err);
    return ok({
      settings: publicSettings(await getSettings()),
      categories: [],
      products: [],
      campaigns: [],
      serverTime: new Date().toISOString(),
    });
  }
}
