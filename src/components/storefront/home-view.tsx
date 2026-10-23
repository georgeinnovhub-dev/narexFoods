"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bike, Clock, ChefHat, Compass, HandPlatter, Heart, MessageCircle, Phone, ReceiptText, ShoppingBasket, Star, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { apiGet } from "@/lib/client";
import {
  Eyebrow,
  Reveal,
  SafeImage,
  normalizeHomeContent,
  type HeroSlide,
  type HomeContent,
} from "./storefront-lib";
import { HeroCarousel } from "./hero-carousel";
import { ProductCard } from "./product-card";
import type { BlogPostDTO } from "@/lib/types";

const STEP_ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed,
  basket: ShoppingBasket,
  receipt: ReceiptText,
  bike: Bike,
  chef: ChefHat,
  payment: ReceiptText,
  heart: Heart,
  clock: Clock,
};

function stepIcon(name: string): LucideIcon {
  return STEP_ICONS[name] ?? UtensilsCrossed;
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function HomeView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
  const [content, setContent] = useState<HomeContent | null>(null);
  const [posts, setPosts] = useState<BlogPostDTO[]>([]);

  const settings = bootstrap?.settings;

  useEffect(() => {
    let alive = true;
    apiGet<{ data?: unknown }>("/api/content/home")
      .then((res) => {
        if (alive) setContent(normalizeHomeContent(res.data ?? null));
      })
      .catch(() => {
        if (alive) setContent(normalizeHomeContent(null));
      });
    apiGet<{ posts?: BlogPostDTO[] }>("/api/blog")
      .then((res) => {
        if (alive) setPosts((res.posts ?? []).filter((p) => p.status === "published").slice(0, 3));
      })
      .catch(() => {
        if (alive) setPosts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const slides = useMemo<HeroSlide[]>(() => {
    const fromContent = content?.heroSlides ?? [];
    if (fromContent.length > 0) return fromContent;
    const fromProducts = (bootstrap?.products ?? [])
      .filter((p) => p.images.length > 0 && p.available && !p.soldOut)
      .slice(0, 3)
      .map((p) => ({
        title: p.name,
        subtitle: p.description,
        image: p.images[0],
        ctaLabel: "Order now",
        ctaAction: "menu",
      }));
    if (fromProducts.length > 0) return fromProducts;
    return [
      {
        title: settings?.brand.name ?? "NAREX Foods",
        subtitle: settings?.brand.tagline ?? "Good Food. Great Taste. Made with Care.",
        image: "",
        ctaLabel: "Browse the menu",
        ctaAction: "menu",
      },
    ];
  }, [content, bootstrap, settings]);

  const featured = useMemo(() => {
    const all = (bootstrap?.products ?? []).filter((p) => p.available && !p.soldOut);
    const picks = all.filter((p) => p.featured);
    return (picks.length > 0 ? picks : all).slice(0, 3);
  }, [bootstrap]);

  /* Food varieties, singled out: one rich card per category with its hero dish. */
  const varieties = useMemo(() => {
    const products = bootstrap?.products ?? [];
    return (bootstrap?.categories ?? [])
      .map((category) => {
        const inCategory = products.filter((p) => p.categoryId === category.id && !p.archived);
        const hero =
          inCategory.find((p) => p.images.length > 0 && p.available && !p.soldOut) ?? inCategory[0];
        return { category, image: hero?.images[0] ?? "", count: inCategory.length, sampleName: hero?.name ?? "" };
      })
      .filter((v) => v.count > 0);
  }, [bootstrap]);

  const story = content?.story ?? null;
  const steps = content?.howItWorks ?? [];
  const contact = settings?.contact;
  const todayHours = useMemo(() => {
    const hours = settings?.hours ?? {};
    const key = DAY_ORDER[(new Date().getDay() + 6) % 7];
    return { day: key, value: hours[key] };
  }, [settings]);

  return (
    <div>
      <HeroCarousel slides={slides} />

      {/* Featured dishes */}
      <section aria-labelledby="featured-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <Eyebrow>Chef&apos;s selection</Eyebrow>
            <h2 id="featured-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
              Featured Dishes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              The plates our regulars re-order without checking the menu. Tap any dish to see its exact
              sizes, extras and live price.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("menu")} className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream">
            View full menu
          </Button>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product, i) => (
            <Reveal key={product.id} delay={i * 0.08}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Food varieties — each singled out, plus one card that gathers them all */}
      {varieties.length > 0 && (
        <section aria-labelledby="varieties-heading" className="border-y border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <Eyebrow>Food varieties</Eyebrow>
                <h2 id="varieties-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
                  Single out a craving. Or take the whole table.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Every variety gets its own stage — pick one to see exactly what&apos;s cooking in it right now.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("menu")}
                className="min-h-11 gap-2 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
              >
                All varieties in one menu
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Reveal>

            <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {varieties.map((v, i) => (
                <Reveal key={v.category.id} delay={i * 0.06}>
                  <button
                    type="button"
                    onClick={() => navigate("menu", { category: v.category.id })}
                    className="group block w-full overflow-hidden rounded-2xl border border-border bg-background text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Explore the ${v.category.name} variety — ${v.count} dishes`}
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                      <SafeImage
                        src={v.image || undefined}
                        alt={`${v.category.name} dishes at ${settings?.brand.name ?? "NAREX Foods"}`}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-forest/60 via-transparent to-transparent" aria-hidden="true" />
                      <span className="absolute bottom-3 left-3 rounded-full bg-cream/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forest">
                        {v.count} {v.count === 1 ? "dish" : "dishes"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-forest">{v.category.name}</h3>
                        {v.sampleName && <p className="truncate text-xs text-muted-foreground">Try the {v.sampleName}</p>}
                      </div>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-forest/25 text-forest transition-colors group-hover:bg-forest group-hover:text-cream">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Story */}
      {story && (
        <section aria-labelledby="story-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
            <Reveal>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-md">
                <SafeImage
                  src={story.image || undefined}
                  alt={`${settings?.brand.name ?? "NAREX Foods"} kitchen story`}
                  className="h-full w-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <Eyebrow>{story.eyebrow}</Eyebrow>
              <h2 id="story-heading" className="mt-1.5 font-display text-3xl font-bold leading-tight text-forest sm:text-4xl">
                {story.title}
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
                {story.body}
              </p>
            </Reveal>
          </div>
        </section>
      )}

      {/* How it works */}
      <section aria-labelledby="how-heading" className="w-full bg-forest text-cream">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <Reveal className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Simple as jollof</p>
            <h2 id="how-heading" className="mt-1.5 font-display text-3xl font-bold sm:text-4xl">
              How It Works
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => {
              const Icon = stepIcon(step.icon);
              return (
                <Reveal key={step.title} delay={i * 0.08}>
                  <div className="h-full rounded-2xl bg-cream/5 p-6 ring-1 ring-cream/15 transition-colors hover:bg-cream/10">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-gold text-forest">
                      <Icon className="size-6" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gold">Step {i + 1}</p>
                    <h3 className="mt-1 font-display text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cream/75">{step.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Experiences & services promo — each links to its exact page */}
      <section aria-labelledby="experiences-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal className="text-center">
          <Eyebrow className="justify-center">More than a menu</Eyebrow>
          <h2 id="experiences-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
            Bring NAREX to your moment.
          </h2>
        </Reveal>
        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              view: "services" as const,
              icon: HandPlatter,
              title: "Services",
              body: "Catering, corporate lunches and weekly meal plans — planned with you, cooked fresh, delivered hot.",
              cta: "Explore services",
            },
            {
              view: "parlays" as const,
              icon: Users,
              title: "Parlays & Hangouts",
              body: "Shareable packs for game nights, birthdays and limes. One message, one delivery, zero washing-up.",
              cta: "See the packs",
            },
            {
              view: "eatntour" as const,
              icon: Compass,
              title: "Eat & Tour",
              body: "Our guided tasting trail through the Akuapem ridges — four stops, four stories, one unforgettable plate.",
              cta: "Take the tour",
            },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.view} delay={i * 0.07}>
                <button
                  type="button"
                  onClick={() => navigate(card.view)}
                  className="group flex h-full w-full flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-forest/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${card.title} — ${card.cta}`}
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-forest text-gold">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-forest">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
                    {card.cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Blog highlights */}
      {posts.length > 0 && (
        <section aria-labelledby="blog-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <Reveal className="mb-8">
            <Eyebrow>From the kitchen</Eyebrow>
            <h2 id="blog-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
              Stories &amp; Updates
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} delay={i * 0.08}>
                <Card className="h-full overflow-hidden rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    <SafeImage
                      src={post.coverImage || undefined}
                      alt={post.altText || post.title}
                      className="h-full w-full"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-snug">{post.title}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground/70">
                        {format(new Date(post.publishedAt), "d MMM yyyy")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Contact CTA band */}
      <section aria-labelledby="cta-heading" className="mx-auto w-full max-w-6xl px-4 pb-14 md:pb-20">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-forest px-6 py-12 text-center text-cream shadow-md sm:px-12">
            <Star className="mx-auto size-8 text-gold" aria-hidden="true" />
            <h2 id="cta-heading" className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Hungry now? Good food is four taps away.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base">
              Order online in minutes and track it to your door — or message us on WhatsApp and a real
              human who knows the menu will take care of you.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={contact ? `tel:+${contact.phone.replace(/^0/, "233")}` : "tel:+233559291195"}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cream/40 px-6 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-auto"
              >
                <Phone className="size-4" aria-hidden="true" />
                Call {contact?.phone ?? "0559291195"}
              </a>
              <a
                href={contact ? `https://wa.me/${contact.whatsappIntl}` : "https://wa.me/233559291195"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-forest shadow-sm transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-forest sm:w-auto"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp us
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Opening hours strip */}
      <section aria-label="Opening hours" className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 font-medium text-forest">
            <Clock className="size-4" aria-hidden="true" />
            Today ({todayHours.day}):
          </span>
          <span className="tabular-nums">{todayHours.value || "— call to confirm"}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span>Full weekly hours are listed in the footer below.</span>
        </div>
      </section>
    </div>
  );
}
