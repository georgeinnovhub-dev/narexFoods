"use client";

/**
 * Eat & Tour — guided tasting journeys through Akuapem with NAREX Foods.
 * Every highlighted food stop opens the EXACT dish on the menu; every
 * package links to its exact WhatsApp booking brief.
 */

import { MapPin, Clock, Users, UtensilsCrossed, MessageCircle, Compass, Flame, Landmark, ChefHat, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { formatGHS } from "@/lib/client";
import { Eyebrow, Reveal, SafeImage } from "./storefront-lib";
import type { ProductDTO } from "@/lib/types";

interface Stop {
  icon: typeof MapPin;
  label: string;
  title: string;
  body: string;
  /** Exact dish linked to this stop, when the menu has it. */
  product: ProductDTO | null;
}

/** Short, tidy dish label for stop buttons (strips dangling separators). */
function shortDishName(name: string): string {
  const cleaned = name.replace(/[\s/·-]+$/g, "").trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 3) return cleaned;
  return `${words.slice(0, 3).join(" ").replace(/[\s/·-]+$/g, "")}…`;
}

interface TourPackage {
  name: string;
  duration: string;
  group: string;
  price: number | null;
  highlights: string[];
  brief: string;
  featured?: boolean;
}

export function EatntourView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const openProduct = useAppStore((s) => s.openProduct);
  const navigate = useAppStore((s) => s.navigate);

  const whatsappIntl = bootstrap?.settings.contact.whatsappIntl ?? "233559291195";
  const wa = (brief: string) => `https://wa.me/${whatsappIntl}?text=${encodeURIComponent(brief)}`;

  const exact = (pattern: RegExp): ProductDTO | null =>
    (bootstrap?.products ?? []).find((p) => pattern.test(p.name) && p.available && !p.soldOut) ?? null;

  const stops: Stop[] = [
    {
      icon: Flame,
      label: "Stop 1 · Our kitchen",
      title: "Party jollof, straight from the firewood",
      body: "Start where the smoke is. Taste our signature jollof as it comes off the pot — and learn why we bake, steam and never rush it.",
      product: exact(/jollof/i),
    },
    {
      icon: ChefHat,
      label: "Stop 2 · The sauce masters",
      title: "Palava sauce & the Akuapem table",
      body: "Palava sauce is our heritage dish — cocoyam leaves, ground melon, palm oil and patience. Taste it with yam, plantain or rice balls.",
      product: exact(/palava/i),
    },
    {
      icon: Landmark,
      label: "Stop 3 · Groundnut country",
      title: "Rice balls & groundnut soup",
      body: "The Sunday classic. Hand-rolled rice balls in a rich roasted-groundnut soup, finished with the crunch only fresh groundnuts give.",
      product: exact(/rice balls/i),
    },
    {
      icon: Compass,
      label: "Stop 4 · Garden city greens",
      title: "Veg stew from the Akuapem ridges",
      body: "A lighter finish: garden vegetables from the ridge towns, stewed low and slow. The stop that proves green can be the main character.",
      product: exact(/veg|stew/i),
    },
  ];

  const packages: TourPackage[] = [
    {
      name: "The Taster",
      duration: "±2 hours",
      group: "2–6 people",
      price: 9500,
      highlights: ["3 tasting stops", "Welcome welcome-drink", "Souvenir tasting card"],
      brief: "Hello NAREX Foods! I want to book THE TASTER Eat & Tour package. Preferred date: …, group size: …",
    },
    {
      name: "The Full Journey",
      duration: "±4 hours",
      group: "2–10 people",
      price: 18000,
      featured: true,
      highlights: ["All 4 stops", "Market walk with our chef", "Cook-along mini session", "Take-home pack"],
      brief: "Hello NAREX Foods! I want to book THE FULL JOURNEY Eat & Tour package. Preferred date: …, group size: …",
    },
    {
      name: "Cook & Dine",
      duration: "±5 hours",
      group: "4–12 people",
      price: 24000,
      highlights: ["Hands-on cooking class", "Full lunch of what you cook", "Recipe booklet to keep"],
      brief: "Hello NAREX Foods! I want to book the COOK & DINE Eat & Tour experience. Preferred date: …, group size: …",
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-forest text-cream">
        <div className="absolute inset-0" aria-hidden="true">
          <SafeImage
            src="/images/eatntour-hero.png"
            alt="Ghanaian food tour tasting table with jollof, kelewele and grilled tilapia"
            className="h-full w-full opacity-45"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/85 to-forest/40" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="max-w-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Eat &amp; Tour · Akuapem</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Don&apos;t just eat. Take the journey.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-cream/85 sm:text-lg">
              A guided tasting trail through the Akuapem ridges — four stops, four stories, and the best
              plate you&apos;ll have all year. Come hungry; leave Ghanaian.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-h-11 rounded-full bg-gold px-6 font-semibold text-forest hover:bg-gold/90"
              >
                <a href={wa("Hello NAREX Foods! I want to book an Eat & Tour experience.")} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Book a tour seat
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("menu")}
                className="min-h-11 rounded-full border-cream/40 bg-transparent px-6 font-semibold text-cream hover:bg-cream/10 hover:text-cream"
              >
                Just eat — see the menu
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stops */}
      <section aria-labelledby="stops-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal>
          <Eyebrow>The trail</Eyebrow>
          <h2 id="stops-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
            Four stops. One delicious route.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each stop highlights a real dish from our kitchen — tap any dish to see its exact price and options right now.
          </p>
        </Reveal>

        <ol className="mt-9 space-y-5">
          {stops.map((stop, i) => {
            const Icon = stop.icon;
            return (
              <Reveal key={stop.title} delay={i * 0.06}>
                <li className="relative">
                  <Card className="overflow-hidden rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-forest text-gold">
                          <Icon className="size-6" aria-hidden="true" />
                        </span>
                        <p className="text-xs font-bold uppercase tracking-widest text-gold">{stop.label}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-semibold text-forest">{stop.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stop.body}</p>
                      </div>
                      <div className="shrink-0 sm:w-48">
                        {stop.product ? (
                          <Button
                            onClick={() => openProduct(stop.product!.id)}
                            variant="outline"
                            className="min-h-11 w-full gap-2 rounded-xl border-forest/30 font-semibold text-forest hover:bg-forest hover:text-cream"
                          >
                            <UtensilsCrossed className="size-4" aria-hidden="true" />
                            Taste {shortDishName(stop.product.name)}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => navigate("menu")}
                            variant="outline"
                            className="min-h-11 w-full gap-2 rounded-xl border-forest/30 font-semibold text-forest hover:bg-forest hover:text-cream"
                          >
                            Find it on the menu
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </section>

      {/* Packages */}
      <section aria-labelledby="tours-heading" className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <Reveal>
            <Eyebrow>Pick your pace</Eyebrow>
            <h2 id="tours-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
              Tour packages, priced honestly.
            </h2>
          </Reveal>
          <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
            {packages.map((pkg, i) => (
              <Reveal key={pkg.name} delay={i * 0.07}>
                <Card
                  className={
                    pkg.featured
                      ? "relative h-full rounded-2xl border-2 border-gold shadow-md"
                      : "flex h-full flex-col rounded-2xl border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  }
                >
                  {pkg.featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-forest">
                      Most booked
                    </Badge>
                  )}
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-forest">{pkg.name}</h3>
                      <p className="mt-2 flex items-baseline gap-1.5">
                        {pkg.price !== null && (
                          <>
                            <span className="font-display text-3xl font-bold text-forest">{formatGHS(pkg.price)}</span>
                            <span className="text-xs text-muted-foreground">per person</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1 rounded-full">
                        <Clock className="size-3" aria-hidden="true" />
                        {pkg.duration}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 rounded-full">
                        <Users className="size-3" aria-hidden="true" />
                        {pkg.group}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {pkg.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-sm text-foreground/85">
                          <MapPin className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-2">
                      <Button
                        asChild
                        className={
                          pkg.featured
                            ? "min-h-11 w-full gap-2 rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                            : "min-h-11 w-full gap-2 rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                        }
                      >
                        <a href={wa(pkg.brief)} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4" aria-hidden="true" />
                          Reserve {pkg.name}
                          <ArrowRight className="size-4 opacity-70" aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6">
            <p className="text-center text-xs text-muted-foreground">
              Private groups of 12+ and corporate tour days are quoted individually — mention it in your WhatsApp brief.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Know before you go */}
      <section aria-labelledby="know-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal>
          <Eyebrow>Know before you go</Eyebrow>
          <h2 id="know-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
            The fine print, made friendly.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Meeting point", body: "Tours start at our kitchen in Mampong-Akuapem. Exact directions come with your booking confirmation." },
            { title: "What to wear", body: "Comfortable shoes and a ready appetite. Aprons and tasting gear are on us." },
            { title: "Dietary needs", body: "Vegetarian and allergy-aware routes are available — tell us when booking." },
            { title: "Weather", body: "Light rain never stops a good tour. Heavier weather? We reschedule you free." },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display text-base font-semibold text-forest">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
