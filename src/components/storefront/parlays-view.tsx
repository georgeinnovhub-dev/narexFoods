"use client";

/**
 * Parlays & Hangouts — shareable packs for game nights, birthdays and limes.
 * Each pack links to its exact WhatsApp brief or exact menu items.
 */

import { Gamepad2, CakeSlice, Music4, Users, MessageCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { formatGHS } from "@/lib/client";
import { Eyebrow, Reveal, SafeImage } from "./storefront-lib";
import type { ProductDTO } from "@/lib/types";

interface Pack {
  icon: typeof Users;
  name: string;
  blurb: string;
  feeds: string;
  /** Lowest "from" price, derived from real menu data when possible. */
  fromPrice: number | null;
  /** Exact products linked from this pack (open their real detail modals). */
  products: ProductDTO[];
  brief: string;
}

export function ParlaysView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const openProduct = useAppStore((s) => s.openProduct);
  const navigate = useAppStore((s) => s.navigate);

  const whatsappIntl = bootstrap?.settings.contact.whatsappIntl ?? "233559291195";
  const wa = (brief: string) => `https://wa.me/${whatsappIntl}?text=${encodeURIComponent(brief)}`;

  const byName = (...patterns: RegExp[]): ProductDTO[] =>
    patterns
      .map((re) => (bootstrap?.products ?? []).find((p) => re.test(p.name) && p.available && !p.soldOut))
      .filter((p): p is ProductDTO => Boolean(p));

  const packs: Pack[] = [
    {
      icon: Gamepad2,
      name: "Game Night Pack",
      blurb: "Small chops, skewers and finger food that survives three hours of FIFA and plenty of trash talk.",
      feeds: "Feeds 4–6",
      fromPrice: 8500,
      products: byName(/jollof/i),
      brief: "Hello NAREX Foods! I want the Game Night Parlays pack for this weekend. Headcount: …, delivery area: …",
    },
    {
      icon: CakeSlice,
      name: "Birthday Lime Tray",
      blurb: "A centrepiece tray of party jollof, chicken and kelewele that makes the birthday person look good.",
      feeds: "Feeds 8–12",
      fromPrice: 15000,
      products: byName(/jollof.*chicken|chicken.*jollof/i, /yam|plantain/i),
      brief: "Hello NAREX Foods! I want the Birthday Lime Tray. Date: …, headcount: …, any extras: …",
    },
    {
      icon: Music4,
      name: "Suya & Sound Session",
      blurb: "Grilled, spicy, loud — built for rooftop sessions and late-night playlists with your people.",
      feeds: "Feeds 6–8",
      fromPrice: 12000,
      products: byName(/rice balls|groundnut/i, /veg|stew/i),
      brief: "Hello NAREX Foods! I want the Suya & Sound Session pack. Date: …, headcount: …",
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-forest text-cream">
        <div className="absolute inset-0" aria-hidden="true">
          <SafeImage
            src="/images/parlays-hero.png"
            alt="Friends sharing large NAREX Foods platters at a hangout"
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
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Parlays &amp; hangouts</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Feed the whole crew. Touch no pot.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-cream/85 sm:text-lg">
              Parlays are our shareable packs for the moments that matter — game nights, birthdays, rooftop
              sessions and impromptu limes. One message, one delivery, zero washing-up.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-h-11 rounded-full bg-gold px-6 font-semibold text-forest hover:bg-gold/90"
              >
                <a href={wa("Hello NAREX Foods! Tell me about your Parlays & Hangout packs.")} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Book a parlays pack
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("menu")}
                className="min-h-11 rounded-full border-cream/40 bg-transparent px-6 font-semibold text-cream hover:bg-cream/10 hover:text-cream"
              >
                Build your own from the menu
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Packs */}
      <section aria-labelledby="packs-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal>
          <Eyebrow>The packs</Eyebrow>
          <h2 id="packs-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
            Curated for good company.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every pack below taps straight into the live menu — tap a dish to see its exact price, sizes and extras.
          </p>
        </Reveal>

        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
          {packs.map((pack, i) => {
            const Icon = pack.icon;
            return (
              <Reveal key={pack.name} delay={i * 0.07}>
                <Card className="flex h-full flex-col rounded-2xl border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-gold/15 text-gold">
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <Badge className="rounded-full bg-forest px-3 py-1 text-xs font-medium text-cream">{pack.feeds}</Badge>
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-forest">{pack.name}</h3>
                      {pack.fromPrice !== null && (
                        <p className="mt-1 text-sm font-bold text-forest">
                          <span className="mr-1 text-xs font-medium text-muted-foreground">from</span>
                          {formatGHS(pack.fromPrice)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{pack.blurb}</p>

                    {pack.products.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inside this pack</p>
                        <ul className="space-y-1">
                          {pack.products.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => openProduct(p.id)}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-forest hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="truncate">{p.name}</span>
                                <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto pt-2">
                      <Button asChild variant="outline" className="min-h-11 w-full gap-2 rounded-xl border-forest/30 font-semibold text-forest hover:bg-forest hover:text-cream">
                        <a href={wa(pack.brief)} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4" aria-hidden="true" />
                          Book this pack
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* How booking works */}
      <section aria-labelledby="parlays-how-heading" className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <Reveal className="text-center">
            <Eyebrow className="justify-center">How it works</Eyebrow>
            <h2 id="parlays-how-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
              Three taps to a full table.
            </h2>
          </Reveal>
          <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              { title: "Pick a pack", body: "Choose a curated pack or mix your own from the menu." },
              { title: "Send the brief", body: "One WhatsApp message — date, headcount, delivery area. Done." },
              { title: "We show up hot", body: "Cooked fresh that day, delivered ready to share. You bring the vibes." },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 0.07}>
                <div className="h-full rounded-2xl border border-border bg-background p-6">
                  <p className="font-display text-3xl font-bold text-gold">{i + 1}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-forest">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
