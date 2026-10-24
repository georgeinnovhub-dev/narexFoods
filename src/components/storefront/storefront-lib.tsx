"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProductDTO, ProductVariantDTO } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Content types (GET /api/content/home) with safe defaults            */
/* ------------------------------------------------------------------ */

export interface HeroSlide {
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  ctaAction: string;
}

export interface StoryContent {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
}

export interface HowItWorksStep {
  title: string;
  body: string;
  icon: string;
}

export interface HomeContent {
  heroSlides: HeroSlide[];
  story: StoryContent;
  howItWorks: HowItWorksStep[];
}

export const DEFAULT_STORY: StoryContent = {
  eyebrow: "Our Story",
  title: "Good Food. Great Taste. Made with Care.",
  body: "NAREX Foods began in a family kitchen in Mampong-Akuapem with one belief: everyday Ghanaian food deserves to be extraordinary. We cook in small batches with fresh local ingredients, season everything by hand, and treat every plate — from our signature jollof to our Sunday rice balls — like it is going to someone we love.",
  image: "/images/story.jpg",
};

export const DEFAULT_HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: "Pick your dishes",
    body: "Browse the menu and choose your favourites — every dish is cooked fresh to order.",
    icon: "utensils",
  },
  {
    title: "Customise your plate",
    body: "Select your variant and add extras like extra chicken or egg to make it yours.",
    icon: "basket",
  },
  {
    title: "Place your order",
    body: "Check out in seconds, then send your order to us on WhatsApp for a fast confirmation.",
    icon: "receipt",
  },
  {
    title: "Enjoy & be merry",
    body: "Collect it hot from our kitchen or let us bring it to your door within our service areas.",
    icon: "bike",
  },
];

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v : fallback;
}

function normalizeSlide(raw: unknown): HeroSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title : "";
  if (!title) return null;
  return {
    title,
    subtitle: str(r.subtitle, ""),
    image: str(r.image, ""),
    ctaLabel: str(r.ctaLabel, "Order now"),
    ctaAction: str(r.ctaAction, "menu"),
  };
}

/** Normalizes unknown API content into a fully-populated HomeContent. */
export function normalizeHomeContent(raw: unknown): HomeContent {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const slides = Array.isArray(obj.heroSlides)
    ? obj.heroSlides.map(normalizeSlide).filter((s): s is HeroSlide => s !== null)
    : [];
  const storyRaw = obj.story && typeof obj.story === "object" ? (obj.story as Record<string, unknown>) : {};
  const steps = Array.isArray(obj.howItWorks)
    ? obj.howItWorks
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const r = s as Record<string, unknown>;
          const title = typeof r.title === "string" ? r.title : "";
          if (!title) return null;
          return { title, body: str(r.body, ""), icon: str(r.icon, "utensils") } satisfies HowItWorksStep;
        })
        .filter((s): s is HowItWorksStep => s !== null)
    : [];
  return {
    heroSlides: slides,
    story: {
      eyebrow: str(storyRaw.eyebrow, DEFAULT_STORY.eyebrow),
      title: str(storyRaw.title, DEFAULT_STORY.title),
      body: str(storyRaw.body, DEFAULT_STORY.body),
      image: str(storyRaw.image, DEFAULT_STORY.image),
    },
    howItWorks: steps.length > 0 ? steps : DEFAULT_HOW_IT_WORKS,
  };
}

/* ------------------------------------------------------------------ */
/* Pricing helpers (integer pesewas everywhere)                        */
/* ------------------------------------------------------------------ */

/** Lowest available variant price in pesewas, or null when none are available. */
export function lowestVariantPrice(product: ProductDTO): number | null {
  const available = product.variants.filter((v) => v.available);
  if (available.length === 0) return null;
  return Math.min(...available.map((v) => v.price));
}

/** Unit price (variant + addons) in pesewas for a cart line. */
export function cartUnitPrice(product: ProductDTO | undefined, variantId: string, addonIds: string[]): number {
  if (!product) return 0;
  const variant = product.variants.find((v) => v.id === variantId);
  const addons = product.addons.filter((a) => addonIds.includes(a.id));
  return (variant?.price ?? 0) + addons.reduce((sum, a) => sum + a.price, 0);
}

/* ------------------------------------------------------------------ */
/* API error introspection (apiSend/apiGet attach status + data)       */
/* ------------------------------------------------------------------ */

export interface OrderErrorBody {
  error?: string;
  unavailable?: string[];
  orderingPaused?: boolean;
  /* Checkout hardening (spec §6/§7/§9) */
  locationUnconfirmed?: boolean;
  outsideZones?: boolean;
  quoteRequired?: boolean;
  zone?: string;
  zoneMinSubtotal?: number;
}

export function apiErrorStatus(err: unknown): number | null {
  if (err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return null;
}

export function apiErrorBody(err: unknown): OrderErrorBody | null {
  if (err instanceof Error && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object") return data as OrderErrorBody;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Payments config (GET /api/payments/config)                          */
/* ------------------------------------------------------------------ */

export interface PaymentsConfig {
  manual: { enabled: boolean; recipientName: string; method: string; details: string; instructions: string };
  paystack: { enabled: boolean; publicKey: string };
  zenobank: { enabled: boolean };
}

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

/** Tracks the user's prefers-reduced-motion setting. */
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false
  );
}

/** Subtle scroll-reveal wrapper (once, y + opacity). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

/** Eyebrow label used above section headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-widest text-gold", className)}>{children}</p>
  );
}

/* ------------------------------------------------------------------ */
/* Image fallback                                                      */
/* ------------------------------------------------------------------ */

/** next/image with a graceful branded fallback when no image exists. Parent must be positioned. */
export function SafeImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)} role="img" aria-label={alt}>
        <UtensilsCrossed className="size-10 text-muted-foreground/50" aria-hidden="true" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      priority={priority}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Shared skeleton shown while bootstrap loads                         */
/* ------------------------------------------------------------------ */

export function BootstrapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading NAREX Foods">
      <Skeleton className="h-[52vh] min-h-[380px] w-full rounded-none" />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-14">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variant helpers                                                     */
/* ------------------------------------------------------------------ */

export function firstAvailableVariant(product: ProductDTO): ProductVariantDTO | undefined {
  return product.variants.find((v) => v.available);
}

export function productAlt(product: { altText?: string; name: string }): string {
  return product.altText && product.altText.trim().length > 0 ? product.altText : product.name;
}
