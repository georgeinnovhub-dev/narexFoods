/**
 * NAREX Foods seed — exact menu from spec §3, roles, settings, content, marketing.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  console.log("Seeding NAREX Foods…");

  // ---------- Roles ----------
  const ALL = ["orders.manage","payments.review","payments.configure","menu.manage","dispatch.manage","staff.manage","content.manage","marketing.manage","reports.view","settings.manage","audit.view","catering.manage","zones.manage"];
  const roleDefs = [
    { name: "Superadmin", description: "Full platform control", permissions: ALL, isSystem: true },
    { name: "Operations Manager", description: "Runs daily operations", permissions: ["orders.manage","menu.manage","dispatch.manage","reports.view","payments.review","catering.manage","zones.manage"], isSystem: false },
    { name: "Order Manager", description: "Manages incoming orders", permissions: ["orders.manage","reports.view","catering.manage"], isSystem: false },
    { name: "Cashier / Payment Reviewer", description: "Reviews payment evidence", permissions: ["orders.manage","payments.review","reports.view"], isSystem: false },
    { name: "Kitchen Staff", description: "Prepares orders", permissions: ["orders.manage"], isSystem: false },
    { name: "Dispatch Manager", description: "Manages delivery operations", permissions: ["orders.manage","dispatch.manage","reports.view","zones.manage"], isSystem: false },
    { name: "Dispatcher", description: "Delivers orders", permissions: [], isSystem: false },
    { name: "Content Editor", description: "Edits website content & blog", permissions: ["content.manage"], isSystem: false },
    { name: "Marketing Manager", description: "Campaigns and coupons", permissions: ["marketing.manage","content.manage","reports.view"], isSystem: false },
    { name: "Analyst", description: "Read-only analytics", permissions: ["reports.view"], isSystem: false },
    { name: "Customer Support", description: "Helps customers", permissions: ["orders.manage","catering.manage"], isSystem: false },
  ];
  for (const r of roleDefs) {
    await db.role.upsert({
      where: { name: r.name },
      create: { ...r, permissions: JSON.stringify(r.permissions) },
      update: { permissions: JSON.stringify(r.permissions), description: r.description },
    });
  }
  const superadmin = await db.role.findUniqueOrThrow({ where: { name: "Superadmin" } });
  const dispatcherRole = await db.role.findUniqueOrThrow({ where: { name: "Dispatcher" } });

  // ---------- Superadmin ----------
  const adminEmail = "admin@narexfoods.com";
  const existingAdmin = await db.staffMember.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.staffMember.create({
      data: {
        email: adminEmail,
        name: "NAREX Superadmin",
        passwordHash: hashPassword("NarexAdmin2024!"),
        roleId: superadmin.id,
        status: "active",
        department: "Administration",
      },
    });
    console.log(`Superadmin created: ${adminEmail} / NarexAdmin2024!`);
  }

  // ---------- Categories ----------
  const catTraditional = await db.category.upsert({
    where: { slug: "traditional-dishes" },
    create: { name: "Traditional Dishes", slug: "traditional-dishes", sortOrder: 1 },
    update: {},
  });
  const catRice = await db.category.upsert({
    where: { slug: "rice-dishes" },
    create: { name: "Rice Dishes", slug: "rice-dishes", sortOrder: 2 },
    update: {},
  });

  // ---------- Products (exact spec §3 menu — prices in pesewas) ----------
  const products: {
    slug: string; name: string; description: string; categoryId: string;
    images: string[]; featured?: boolean; bestSeller?: boolean;
    variants: { name: string; price: number }[];
    addons?: { name: string; price: number }[];
  }[] = [
    {
      slug: "yam-plantain-rice-palava-sauce",
      name: "Yam / Plantain / Rice with Palava Sauce",
      description:
        "A beloved Ghanaian classic — your choice of soft-boiled yam, golden fried plantain or steamed rice, served with our rich palava sauce made from freshly ground cocoyam leaves, smoked fish and a gentle blend of spices. Hearty, earthy and full of care.",
      categoryId: catTraditional.id,
      images: ["/images/palava.png"],
      featured: true,
      bestSeller: true,
      variants: [
        { name: "Small", price: 2000 },
        { name: "Medium", price: 2500 },
        { name: "Large", price: 3000 },
      ],
      addons: [
        { name: "Extra smoked fish", price: 500 },
        { name: "Extra sauce", price: 300 },
      ],
    },
    {
      slug: "yam-plantain-rice-vegetable-stew",
      name: "Yam / Plantain / Rice with Vegetable Stew",
      description:
        "Your choice of yam, plantain or rice paired with our slow-simmered vegetable stew — garden-fresh tomatoes, onions, peppers and greens cooked down with care into a deep, comforting flavour.",
      categoryId: catTraditional.id,
      images: ["/images/veg-stew.png"],
      featured: true,
      variants: [
        { name: "Small", price: 2000 },
        { name: "Medium", price: 2500 },
        { name: "Large", price: 3000 },
      ],
      addons: [
        { name: "Extra stew", price: 300 },
        { name: "Boiled egg", price: 200 },
      ],
    },
    {
      slug: "jollof-rice",
      name: "Jollof Rice",
      description:
        "Our signature smoky party jollof — fragrant rice simmered in a rich blended tomato and pepper base, finished over gentle heat for that unmistakable Ghanaian depth. Served with your choice of egg or tender chicken.",
      categoryId: catRice.id,
      images: ["/images/jollof-chicken.png", "/images/jollof-egg.png"],
      featured: true,
      bestSeller: true,
      variants: [
        { name: "With egg", price: 2500 },
        { name: "With chicken", price: 3500 },
      ],
      addons: [
        { name: "Shito on the side", price: 300 },
        { name: "Fried plantain", price: 400 },
        { name: "Coleslaw", price: 300 },
      ],
    },
    {
      slug: "rice-balls-groundnut-soup",
      name: "Rice Balls with Groundnut Soup",
      description:
        "Omo tuo — soft, smooth rice balls served in our signature groundnut soup, slowly prepared for a deep, nutty richness with hints of ginger and spices. Pure comfort in a bowl.",
      categoryId: catTraditional.id,
      images: ["/images/rice-balls.png", "/images/rice-balls-2.png"],
      featured: true,
      bestSeller: true,
      variants: [{ name: "Regular", price: 3000 }],
      addons: [
        { name: "Extra soup", price: 400 },
        { name: "Grilled tilapia", price: 1500 },
      ],
    },
  ];

  for (const [i, p] of products.entries()) {
    await db.product.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: p.categoryId,
        images: JSON.stringify(p.images),
        featured: p.featured ?? false,
        bestSeller: p.bestSeller ?? false,
        altText: p.name,
        prepMinutes: 25,
        sortOrder: i,
        seoTitle: `${p.name} | NAREX Foods`,
        seoDescription: p.description.slice(0, 150),
        variants: { create: p.variants.map((v, vi) => ({ ...v, sortOrder: vi })) },
        addons: { create: (p.addons ?? []).map((a, ai) => ({ ...a, sortOrder: ai })) },
      },
      update: {
        images: JSON.stringify(p.images),
        description: p.description,
      },
    });
  }

  // ---------- Settings ----------
  await db.setting.upsert({
    where: { key: "site" },
    create: {
      key: "site",
      value: JSON.stringify({}),
    },
    update: {},
  });

  // ---------- Delivery zones (spec §7) ----------
  const zones = [
    { name: "Mampong-Akuapem", areas: ["Mampong", "Mampong-Akuapem", "Mamfe"], fee: 800, minSubtotal: 0, leadMinutes: 45, requiresQuote: false, sortOrder: 1, note: "Our home area — fastest delivery window." },
    { name: "Akropong & Aburi", areas: ["Akropong", "Aburi", "Adawso", "Tinkong"], fee: 1500, minSubtotal: 0, leadMinutes: 75, requiresQuote: false, sortOrder: 2, note: "Ridge towns along the Akuapem range." },
    { name: "Nsawam & Koforidua", areas: ["Nsawam", "Koforidua", "Adooso", "Zualko"], fee: 2500, minSubtotal: 5000, leadMinutes: 105, requiresQuote: false, sortOrder: 3, note: "Minimum order GH₵50 applies." },
    { name: "Accra", areas: ["Accra", "Madina", "Adenta", "Tema", "Legon", "East Legon", "Achimota", "Circle", "Osu", "Spintex", "Teshie", "Haatso"], fee: 4500, minSubtotal: 10000, leadMinutes: 180, requiresQuote: true, sortOrder: 4, note: "Long-distance run — subject to scheduled runs and capacity. A quick manual confirmation is required before checkout." },
  ];
  for (const z of zones) {
    const existing = await db.deliveryZone.findFirst({ where: { name: z.name } });
    if (!existing) {
      await db.deliveryZone.create({ data: { ...z, areas: JSON.stringify(z.areas) } });
    }
  }

  // ---------- Website content (home) ----------
  const homeData = {
    heroSlides: [
      {
        title: "Good Food. Great Taste.",
        subtitle: "Made with Care — from our kitchen in Mampong-Akuapem to your table.",
        image: "/images/hero-1.png",
        ctaLabel: "Order Now",
        ctaAction: "menu",
      },
      {
        title: "Signature Ghanaian Classics",
        subtitle: "Palava sauce, party jollof, groundnut soup — cooked the way home tastes.",
        image: "/images/palava.png",
        ctaLabel: "Explore Menu",
        ctaAction: "menu",
      },
      {
        title: "Fresh, Warm & Ready",
        subtitle: "Order in minutes on WhatsApp — pickup or delivery around Akuapem.",
        image: "/images/jollof-chicken.png",
        ctaLabel: "How It Works",
        ctaAction: "about",
      },
    ],
    story: {
      eyebrow: "Our Kitchen, Your Table",
      title: "Cooked with care, served with pride",
      body: "NAREX Foods began with a simple belief: everyone deserves a proper Ghanaian meal, made with honest ingredients and genuine care. From our kitchen in Mampong-Akuapem, we prepare every dish in small batches — palava sauce ground fresh, jollof simmered low, groundnut soup stirred patiently — so every plate carries the taste of home.",
      image: "/images/brand-story.png",
    },
    howItWorks: [
      { title: "Choose your meal", body: "Browse the menu and pick your favourite dish, portion and extras.", icon: "utensils" },
      { title: "Place your order", body: "Checkout on the website — your order is confirmed with a unique reference.", icon: "clipboard" },
      { title: "Connect on WhatsApp", body: "One tap opens WhatsApp with your order summary ready to send.", icon: "message" },
      { title: "Pickup or delivery", body: "Collect from our Mampong-Akuapem kitchen or get it delivered to your door.", icon: "bike" },
    ],
    banners: [],
  };
  await db.websiteContent.upsert({
    where: { page: "home" },
    create: { page: "home", data: JSON.stringify(homeData) },
    update: {},
  });

  // ---------- Marketing ----------
  const now = new Date();
  const monthEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
  await db.coupon.upsert({
    where: { code: "WELCOME10" },
    create: { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 3000, endsAt: monthEnd, active: true },
    update: {},
  });
  await db.coupon.upsert({
    where: { code: "NAREX5" },
    create: { code: "NAREX5", type: "fixed", value: 500, minSubtotal: 4000, endsAt: monthEnd, active: true, maxRedemptions: 100 },
    update: {},
  });
  await db.campaign.upsert({
    where: { id: "seed-welcome" },
    create: {
      id: "seed-welcome",
      title: "Welcome to NAREX Foods! 🎉",
      message: "Enjoy 10% off your first order with code WELCOME10 — good food made with care, delivered around Akuapem.",
      ctaLabel: "Browse the Menu",
      placement: "popup",
      status: "active",
      priority: 10,
      startsAt: now,
      endsAt: monthEnd,
    },
    update: {},
  });

  // ---------- Blog ----------
  await db.blogPost.upsert({
    where: { slug: "the-story-of-our-palava-sauce" },
    create: {
      slug: "the-story-of-our-palava-sauce",
      title: "The Story of Our Palava Sauce",
      excerpt: "Slow-cooked cocoyam leaves, smoked fish and patience — the heart of our palava sauce.",
      content:
        "At NAREX Foods, palava sauce is more than a dish — it is a weekly ritual.\n\nEvery morning, fresh cocoyam leaves are washed and pounded by hand, then simmered slowly with smoked fish, palm oil, onions and a careful blend of spices until the sauce turns deep, dark and fragrant. Nothing is rushed. The heat is gentle, and the pot gets all the time it needs.\n\nWe serve it over your choice of soft-boiled yam, golden fried plantain or steamed rice. Come and taste why our customers keep coming back.",
      coverImage: "/images/palava.png",
      altText: "A bowl of palava sauce served with yam and plantain",
      tags: JSON.stringify(["kitchen", "traditional"]),
      status: "published",
      publishedAt: now,
    },
    update: {},
  });

  // ---------- Dispatch profile for dispatcher role ----------
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
