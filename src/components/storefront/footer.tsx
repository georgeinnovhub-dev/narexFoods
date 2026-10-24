"use client";

import { Phone, Mail, MapPin, MessageCircle, UtensilsCrossed, Clock } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const FALLBACK = {
  name: "NAREX Foods",
  tagline: "Good Food. Great Taste. Made with Care.",
  credit: "Engineered by iDe8 Flow Hub",
  phone: "0559291195",
  whatsappIntl: "233559291195",
  email: "hello@narexfoods.com",
  address: "Mampong-Akuapem, Eastern Region, Ghana",
};

function titleCase(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function SiteFooter({ className }: { className?: string }) {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
  const settings = bootstrap?.settings;

  const brand = settings?.brand ?? { name: FALLBACK.name, tagline: FALLBACK.tagline, developerCredit: FALLBACK.credit };
  const contact = settings?.contact ?? {
    phone: FALLBACK.phone,
    whatsapp: FALLBACK.phone,
    whatsappIntl: FALLBACK.whatsappIntl,
    email: FALLBACK.email,
    address: FALLBACK.address,
  };
  const hours = settings?.hours ?? {};
  const areas = settings?.delivery.areas ?? [];

  const hoursList = DAY_ORDER.map((day) => ({ day, value: hours[day] })).filter((h) => Boolean(h.value));

  const quickLinks: { label: string; view: "home" | "menu" | "services" | "parlays" | "eatntour" | "track" | "blog" }[] = [
    { label: "Home", view: "home" },
    { label: "Full Menu", view: "menu" },
    { label: "Services", view: "services" },
    { label: "Parlays & Hangouts", view: "parlays" },
    { label: "Eat & Tour", view: "eatntour" },
    { label: "Food Journal", view: "blog" },
    { label: "Track Order", view: "track" },
  ];

  const legalLinks: { label: string; view: "privacy" | "terms" | "delivery-info" | "account" }[] = [
    { label: "Delivery Info", view: "delivery-info" },
    { label: "Privacy Policy", view: "privacy" },
    { label: "Terms of Service", view: "terms" },
    { label: "My Account", view: "account" },
  ];

  return (
    <footer className={cn("mt-auto w-full bg-forest text-cream", className)}>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cream/10 ring-1 ring-cream/20">
              <UtensilsCrossed className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold">{brand.name}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-cream/75">{brand.tagline}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-cream/75">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {contact.address}
          </p>
        </div>

        {/* Quick links */}
        <nav aria-label="Footer">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">Quick Links</h2>
          <ul className="mt-4 space-y-2.5">
            {quickLinks.map((link) => (
              <li key={link.view}>
                <button
                  type="button"
                  onClick={() => navigate(link.view)}
                  className="rounded text-sm text-cream/85 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Customer care */}
        <nav aria-label="Customer care">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">Customer Care</h2>
          <ul className="mt-4 space-y-2.5">
            {legalLinks.map((link) => (
              <li key={link.view}>
                <button
                  type="button"
                  onClick={() => navigate(link.view)}
                  className="rounded text-sm text-cream/85 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm text-cream/85">
            <li>
              <a
                href={`tel:+${contact.phone.replace(/^0/, "233")}`}
                className="inline-flex items-center gap-2 rounded transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <Phone className="size-4" aria-hidden="true" />
                {contact.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-2 rounded transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <Mail className="size-4" aria-hidden="true" />
                {contact.email}
              </a>
            </li>
          </ul>
          <a
            href={`https://wa.me/${contact.whatsappIntl}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-forest shadow-sm transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Chat on WhatsApp
          </a>
        </div>

        {/* Hours + areas */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">Opening Hours</h2>
          {hoursList.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-cream/85">
              {hoursList.map(({ day, value }) => (
                <li key={day} className="flex items-center justify-between gap-4">
                  <span>{titleCase(day)}</span>
                  <span className="tabular-nums text-cream/70">{value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-cream/75">
              <Clock className="size-4" aria-hidden="true" /> Call us for today&apos;s hours.
            </p>
          )}
          {areas.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-gold">Delivery Areas</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {areas.map((area) => (
                  <li key={area} className="rounded-full bg-cream/10 px-2.5 py-1 text-xs text-cream/85">
                    {area}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-cream/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-cream/70 sm:flex-row">
          <p>
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {brand.name}. All rights reserved.
          </p>
          <p className="opacity-70">{brand.developerCredit || FALLBACK.credit}</p>
        </div>
      </div>
    </footer>
  );
}
