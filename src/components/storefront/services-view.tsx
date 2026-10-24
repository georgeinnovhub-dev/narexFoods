"use client";

/**
 * Services — catering, corporate lunches, meal plans and event support.
 * Every highlighted service links to its exact action (WhatsApp with a
 * prefilled brief, the exact menu variety, or the exact companion page).
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarCheck, BriefcaseBusiness, PartyPopper, HeartHandshake, UtensilsCrossed, MessageCircle, ArrowRight, CheckCircle2, Loader2, Sparkles, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { apiSend } from "@/lib/client";
import { Eyebrow, Reveal, SafeImage } from "./storefront-lib";
import type { CreateQuoteResponse } from "@/lib/types";

interface ServiceOffer {
  icon: typeof UtensilsCrossed;
  title: string;
  copy: string;
  bullets: string[];
  ctaLabel: string;
  /** Exact target: internal deep link or a prefilled WhatsApp brief. */
  href: string;
  external: boolean;
}

const SERVICE_TYPES = [
  { value: "staff_meals", label: "Staff meals" },
  { value: "family_group", label: "Family & group packages" },
  { value: "meetings", label: "Meetings" },
  { value: "conference", label: "Conferences" },
  { value: "party", label: "Party & event catering" },
  { value: "canteen", label: "Canteen service" },
  { value: "recurring", label: "Recurring orders" },
  { value: "custom", label: "Something custom" },
] as const;

type ServiceTypeValue = (typeof SERVICE_TYPES)[number]["value"];

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PHONE_REGEX = /^[0-9+\s-]{9,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const quoteSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name").max(80),
    phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid phone number (9–15 digits)"),
    email: z.string().trim().max(120).optional(),
    organization: z.string().trim().max(120).optional(),
    serviceType: z.enum(["staff_meals", "family_group", "meetings", "conference", "party", "canteen", "recurring", "custom"]),
    people: z.coerce.number({ message: "How many people should we plan for?" }).int("Whole numbers only").min(1, "At least 1 person").max(5000, "That's a lot — let's talk on WhatsApp"),
    mealsPerPerson: z.coerce.number().int().min(1).max(5),
    eventDate: z.string().trim().max(10).optional(),
    eventTime: z.string().trim().max(40).optional(),
    venue: z.string().trim().max(200).optional(),
    message: z.string().trim().max(1000, "Message is a little too long").optional(),
  })
  .superRefine((val, ctx) => {
    if (val.email && val.email.length > 0 && !EMAIL_REGEX.test(val.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address or leave this blank" });
    }
    if (val.eventDate && val.eventDate.length > 0 && val.eventDate < todayYMD()) {
      ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Event date cannot be in the past" });
    }
  });

type QuoteValues = z.infer<typeof quoteSchema>;
type QuoteInput = z.input<typeof quoteSchema>;

function CateringQuoteForm({ whatsappIntl }: { whatsappIntl: string }) {
  const [submitted, setSubmitted] = useState<CreateQuoteResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<QuoteInput, unknown, QuoteValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      organization: "",
      serviceType: "party",
      people: "",
      mealsPerPerson: 1,
      eventDate: "",
      eventTime: "",
      venue: "",
      message: "",
    },
  });

  async function onSubmit(values: QuoteValues) {
    setBusy(true);
    try {
      const res = await apiSend<CreateQuoteResponse>("/api/catering/quotes", "POST", {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        organization: values.organization || undefined,
        serviceType: values.serviceType,
        people: values.people,
        mealsPerPerson: values.mealsPerPerson,
        eventDate: values.eventDate || undefined,
        eventTime: values.eventTime || undefined,
        venue: values.venue || undefined,
        message: values.message || undefined,
      });
      setSubmitted(res);
      toast.success(`Quotation request ${res.reference} received`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your request — please try WhatsApp");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-600/30 bg-emerald-600/10 p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600/15">
          <CheckCircle2 className="size-8 text-emerald-600" aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-forest">Request received</h3>
        <p className="mt-1 font-mono text-sm font-bold tracking-wide text-forest">{submitted.reference}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{submitted.message}</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            className="min-h-11 gap-2 rounded-full bg-gold px-5 font-semibold text-forest hover:bg-gold/90"
          >
            <a
              href={`https://wa.me/${whatsappIntl}?text=${encodeURIComponent(`Hello NAREX Foods! I've just submitted quotation request ${submitted.reference}. Here are a few more details: …`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Continue on WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(null);
              form.reset();
            }}
            className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
          >
            Submit another request
          </Button>
        </div>
      </div>
    );
  }

  const err = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q-name">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="q-name"
            autoComplete="name"
            placeholder="Ama Mensah"
            aria-invalid={Boolean(err.name)}
            className="min-h-11 rounded-xl"
            {...form.register("name")}
          />
          {err.name && <p className="text-xs font-medium text-destructive">{err.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-phone">
            Phone number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="q-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0559 291 195"
            aria-invalid={Boolean(err.phone)}
            className="min-h-11 rounded-xl"
            {...form.register("phone")}
          />
          {err.phone && <p className="text-xs font-medium text-destructive">{err.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-email">Email (optional)</Label>
          <Input
            id="q-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(err.email)}
            className="min-h-11 rounded-xl"
            {...form.register("email")}
          />
          {err.email && <p className="text-xs font-medium text-destructive">{err.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-org">Organization (optional)</Label>
          <Input
            id="q-org"
            placeholder="Company, church, school…"
            className="min-h-11 rounded-xl"
            {...form.register("organization")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-type">
            Service type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.watch("serviceType")}
            onValueChange={(v) => form.setValue("serviceType", v as ServiceTypeValue, { shouldValidate: true })}
          >
            <SelectTrigger id="q-type" aria-label="Service type" className="min-h-11 w-full rounded-xl">
              <SelectValue placeholder="What do you need?" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="min-h-11">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-people">
              People <span className="text-destructive">*</span>
            </Label>
            <Input
              id="q-people"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 80"
              aria-invalid={Boolean(err.people)}
              className="min-h-11 rounded-xl"
              {...form.register("people")}
            />
            {err.people && <p className="text-xs font-medium text-destructive">{err.people.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-meals">Meals per person</Label>
            <Select
              value={String(form.watch("mealsPerPerson"))}
              onValueChange={(v) => form.setValue("mealsPerPerson", Number(v), { shouldValidate: true })}
            >
              <SelectTrigger id="q-meals" aria-label="Meals per person" className="min-h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)} className="min-h-11">
                    {n} {n === 1 ? "meal" : "meals"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-date">Event date (optional)</Label>
          <Input
            id="q-date"
            type="date"
            min={todayYMD()}
            aria-invalid={Boolean(err.eventDate)}
            className="min-h-11 rounded-xl"
            {...form.register("eventDate")}
          />
          {err.eventDate && <p className="text-xs font-medium text-destructive">{err.eventDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-time">Start time (optional)</Label>
          <Input id="q-time" placeholder="e.g. 1:00 pm" className="min-h-11 rounded-xl" {...form.register("eventTime")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q-venue">Venue (optional)</Label>
          <Input id="q-venue" placeholder="Where should we serve?" className="min-h-11 rounded-xl" {...form.register("venue")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q-message">Anything else we should know?</Label>
          <Textarea
            id="q-message"
            rows={4}
            placeholder="Menu preferences, serving style (chafing dishes vs trays), dietary needs, budget…"
            className="rounded-xl"
            {...form.register("message")}
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full gap-2 rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90 sm:w-auto sm:px-8"
      >
        {busy ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Sending your request…
          </>
        ) : (
          "Request a quotation"
        )}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        We reply within 24 hours with a tailored quotation — no deposit needed to get a quote.
      </p>
    </form>
  );
}

export function ServicesView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
  const openProduct = useAppStore((s) => s.openProduct);

  const whatsappIntl = bootstrap?.settings.contact.whatsappIntl ?? "233559291195";
  const phone = bootstrap?.settings.contact.phone ?? "0559291195";
  const wa = (brief: string) => `https://wa.me/${whatsappIntl}?text=${encodeURIComponent(brief)}`;

  /* Exact menu targets, resolved from live data when present. */
  const riceCategory = bootstrap?.categories.find((c) => /rice/i.test(c.name)) ?? null;
  const traditionalCategory = bootstrap?.categories.find((c) => /tradition|local|soup/i.test(c.name)) ?? null;
  const signature = bootstrap?.products.find((p) => /palava/i.test(p.name)) ?? null;

  const offers: ServiceOffer[] = [
    {
      icon: PartyPopper,
      title: "Event Catering",
      copy: "Weddings, outdooring, church anniversaries, funerals and family reunions — we cook your event like it's our own family gathering.",
      bullets: ["Chafing-dish service or family-style trays", "50–500 guests, priced per head", "Servers & setup available on request"],
      ctaLabel: "Request a catering quote",
      href: wa("Hello NAREX Foods! I'd like a catering quote. Event type: …, date: …, number of guests: …"),
      external: true,
    },
    {
      icon: BriefcaseBusiness,
      title: "Office & Corporate Lunches",
      copy: "Keep the team sharp with hot, homestyle lunches delivered before your noon break. Weekly invoicing available for regular offices.",
      bullets: ["Scheduled drops, same time every day", "Individual labelled packs", "Vegetarian options on request"],
      ctaLabel: riceCategory ? `See lunch options — ${riceCategory.name}` : "See lunch options",
      href: riceCategory ? `#/menu?category=${riceCategory.id}` : "#/menu",
      external: false,
    },
    {
      icon: CalendarCheck,
      title: "Weekly Meal Plans",
      copy: "Five or seven days of home cooking, planned with you, cooked fresh each morning, and delivered before you even ask \"what are we eating today?\"",
      bullets: ["You choose the rotating menu", "Paused anytime — no lock-in", "Family sizes available"],
      ctaLabel: "Start a meal plan on WhatsApp",
      href: wa("Hello NAREX Foods! I'd like to start a weekly meal plan for … people. Preferences: …"),
      external: true,
    },
    {
      icon: HeartHandshake,
      title: "Parlays & Hangout Packs",
      copy: "Game night? Birthday lime? Our shareable parlays packs feed the whole crew without anyone touching a pot.",
      bullets: ["Curated combo platters", "Short-notice availability", "Drinks & small chops add-ons"],
      ctaLabel: "Explore parlays packs",
      href: "#/parlays",
      external: false,
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-forest text-cream">
        <div className="absolute inset-0" aria-hidden="true">
          <SafeImage
            src="/images/services-hero.png"
            alt="NAREX Foods catering spread with chafing dishes of Ghanaian dishes"
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
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Beyond the plate</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Services that bring NAREX to your moment.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-cream/85 sm:text-lg">
              One kitchen, many tables. From once-in-a-lifetime celebrations to the Tuesday lunch that keeps
              the office smiling — we plan it, cook it fresh, and deliver it hot.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-h-11 rounded-full bg-gold px-6 font-semibold text-forest hover:bg-gold/90"
              >
                <a href={wa("Hello NAREX Foods! I'd like to discuss your services for …")} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Talk to our events desk
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-11 rounded-full border-cream/40 bg-transparent px-6 font-semibold text-cream hover:bg-cream/10 hover:text-cream"
              >
                <a href={`tel:+${phone.replace(/^0/, "233")}`}>Call {phone}</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Offers */}
      <section aria-labelledby="services-heading" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal>
          <Eyebrow>What we do</Eyebrow>
          <h2 id="services-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
            Pick the service. We&apos;ll bring the firewood.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every service below links you straight to the right desk — no forms, no waiting rooms.
          </p>
        </Reveal>

        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-2">
          {offers.map((offer, i) => {
            const Icon = offer.icon;
            return (
              <Reveal key={offer.title} delay={i * 0.07}>
                <Card className="group h-full rounded-2xl border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-forest text-gold">
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <h3 className="font-display text-xl font-semibold text-forest">{offer.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{offer.copy}</p>
                    <ul className="space-y-1.5">
                      {offer.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-foreground/85">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-2">
                      {offer.external ? (
                        <Button asChild className="min-h-11 gap-2 rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90">
                          <a href={offer.href} target="_blank" rel="noreferrer">
                            <MessageCircle className="size-4" aria-hidden="true" />
                            {offer.ctaLabel}
                            <ArrowRight className="size-4 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </a>
                        </Button>
                      ) : offer.href.startsWith("#/") ? (
                        <Button
                          onClick={() => {
                            const [view, query] = offer.href.slice(2).split("?");
                            const params: Record<string, string> = {};
                            for (const [k, v] of new URLSearchParams(query ?? "").entries()) params[k] = v;
                            if (view === "parlays") navigate("parlays");
                            else if (view === "menu") navigate("menu", params);
                            else navigate("menu");
                          }}
                          className="min-h-11 gap-2 rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                        >
                          {offer.ctaLabel}
                          <ArrowRight className="size-4 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Signature spotlight — links to the exact dish */}
      {signature && (
        <section aria-labelledby="signature-heading" className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:gap-12">
            <Reveal>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-md">
                <SafeImage
                  src={signature.images[0] || undefined}
                  alt={signature.altText || signature.name}
                  className="h-full w-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <Eyebrow>Crowd favourite</Eyebrow>
              <h2 id="signature-heading" className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">
                {signature.name} — the dish your guests will talk about.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {signature.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={() => openProduct(signature.id)}
                  className="min-h-11 rounded-xl bg-forest px-5 font-semibold text-cream hover:bg-forest/90"
                >
                  <UtensilsCrossed className="size-4" aria-hidden="true" />
                  View this exact dish
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("menu")}
                  className="min-h-11 rounded-xl border-forest/30 font-semibold text-forest hover:bg-forest hover:text-cream"
                >
                  Or browse everything
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Assurance band */}
      <section aria-label="Our service promise" className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <Reveal>
          <div className="rounded-3xl bg-forest px-6 py-12 text-center text-cream shadow-md sm:px-12">
            <Sparkles className="mx-auto size-8 text-gold" aria-hidden="true" />
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Our promise, plate for plate.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-cream/80 sm:text-base">
              Fresh market ingredients every morning. Cooked in small batches, never reheated. Transparent
              per-head pricing with no surprise charges. If a dish doesn&apos;t land, tell us — we make it right.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
              {["Fresh daily", "Small-batch cooking", "On-time delivery", "Honest pricing"].map((tag) => (
                <Badge key={tag} className="rounded-full border border-cream/25 bg-cream/10 px-4 py-1.5 text-xs font-medium text-cream hover:bg-cream/10">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
