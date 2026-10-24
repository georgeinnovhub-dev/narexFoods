"use client";

/**
 * Legal / info pages — Privacy Policy, Terms of Service and Delivery Info.
 * Written for the Ghanaian context; the zone table is generated from the live
 * bootstrap zones so fees and lead times always match what checkout charges.
 */

import type { ReactNode } from "react";
import {
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Store,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { useCurrency } from "./currency-context";
import { Eyebrow, Reveal } from "./storefront-lib";
import type { ZoneDTO } from "@/lib/types";

function useContact() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const contact = bootstrap?.settings.contact;
  return {
    phone: contact?.phone ?? "0559291195",
    whatsappIntl: contact?.whatsappIntl ?? "233559291195",
    email: contact?.email ?? "hello@narexfoods.com",
  };
}

function InfoShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{lead}</p>
      </Reveal>
      <div className="mt-10 space-y-10">{children}</div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-forest">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-forest [&_a]:underline [&_a]:underline-offset-2 [&_b]:text-foreground [&_li]:ml-4 [&_li]:list-disc">
        {children}
      </div>
    </section>
  );
}

function WhatsAppLink({ whatsappIntl, children }: { whatsappIntl: string; children: ReactNode }) {
  return (
    <a href={`https://wa.me/${whatsappIntl}`} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy Policy                                                      */
/* ------------------------------------------------------------------ */

export function PrivacyView() {
  const { phone, whatsappIntl, email } = useContact();
  return (
    <InfoShell
      eyebrow="Privacy Policy"
      title="Your data, handled with care."
      lead="We cook with few, good ingredients — and we apply the same discipline to your data. This policy explains, in plain language, what NAREX Foods collects, why, and how you stay in control."
    >
      <InfoSection title="What we collect — and why">
        <p>
          We practise <b>data minimisation</b>: we only ask for what a delivery actually needs.
        </p>
        <ul>
          <li>
            <b>Order details</b> — your name, phone number, optional email, the items you order, and (for delivery)
            your address, landmark and confirmed location pin. Used to cook, hand over and follow up on your order.
          </li>
          <li>
            <b>Payment evidence</b> — if you pay by mobile money, you may upload a screenshot or receipt. Our team
            reviews it manually to mark your order paid.
          </li>
          <li>
            <b>Account details</b> — if you create an account: your name, email, phone and any addresses you choose
            to save, so reordering takes two taps.
          </li>
          <li>
            <b>Catering quote requests</b> — the event details you share so we can quote accurately.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="What we never collect">
        <ul>
          <li>We never see or store your mobile money PIN or card numbers.</li>
          <li>No advertising trackers, no data brokerage, no selling or renting your details — ever.</li>
          <li>We don&apos;t require your location continuously; the pin is only the address you type and confirm.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Manual payment review">
        <p>
          Online payments are reviewed <b>by a human, not an algorithm</b>. When you upload payment evidence, our
          payments desk compares it against your order reference and amount before your order is marked paid. Evidence
          images are stored privately (only authorised staff can open them) and are used solely for verification and
          record-keeping. Nothing is ever charged automatically — you always transfer or pay by card yourself.
        </p>
      </InfoSection>

      <InfoSection title="Who sees your details">
        <p>
          Our kitchen and dispatch team see the details needed to cook and deliver your order (name, phone, address,
          notes). For gift orders, the recipient sees the items — and <b>not the prices</b>, if you choose to hide
          them. Nobody else. Payment evidence is restricted to the payments desk.
        </p>
      </InfoSection>

      <InfoSection title="Your rights (Ghana)">
        <p>
          Your data is protected under Ghana&apos;s <b>Data Protection Act, 2012 (Act 843)</b>. You may ask us, at any
          time, for a copy of your details, a correction, or full deletion of your account. Message us on{" "}
          <WhatsAppLink whatsappIntl={whatsappIntl}>WhatsApp ({phone})</WhatsAppLink> or email{" "}
          <a href={`mailto:${email}`}>{email}</a> and we&apos;ll action it promptly.
        </p>
      </InfoSection>

      <InfoSection title="Cookies &amp; local storage">
        <p>
          This website stores only two things on your device: your cart (so a refresh doesn&apos;t lose your order)
          and your display-currency preference. No third-party advertising cookies, no fingerprinting.
        </p>
      </InfoSection>
    </InfoShell>
  );
}

/* ------------------------------------------------------------------ */
/* Terms of Service                                                    */
/* ------------------------------------------------------------------ */

export function TermsView() {
  const { phone, whatsappIntl } = useContact();
  return (
    <InfoShell
      eyebrow="Terms of Service"
      title="The house rules, in plain words."
      lead="These terms cover ordering, payment and delivery from NAREX Foods. By placing an order you agree to them — they exist so every plate arrives with no surprises."
    >
      <InfoSection title="1. Orders &amp; prices">
        <ul>
          <li>
            All prices are in <b>Ghana cedis (GH₵)</b> and include what you see at checkout — subtotal, any coupon
            discount and the delivery fee. Nothing is added afterwards.
          </li>
          <li>
            Where we show amounts in other currencies (USD, GBP, EUR, NGN, CAD), they are <b>display estimates
            only</b>, refreshed periodically and marked &ldquo;est.&rdquo;. The amount charged and settled is always GHS.
          </li>
          <li>Every order is recalculated on our server from the live menu — cart prices are indicative until the order is confirmed.</li>
        </ul>
      </InfoSection>

      <InfoSection title="2. Payment">
        <ul>
          <li>
            <b>Mobile money (manual review):</b> transfer the exact total, then upload your evidence after checkout. A
            team member verifies it before your order is marked paid — usually within minutes during opening hours.
          </li>
          <li>
            <b>Card payments (when enabled):</b> processed securely by our payment provider; we never see or store your
            card details.
          </li>
          <li>An order enters the kitchen queue once payment is verified — or immediately for pickup orders confirmed on WhatsApp.</li>
        </ul>
      </InfoSection>

      <InfoSection title="3. Pickup &amp; delivery">
        <ul>
          <li>
            <b>Pickup:</b> collect from our kitchen in Mampong-Akuapem — no delivery fee. We&apos;ll tell you the exact
            ready time.
          </li>
          <li>
            <b>Delivery:</b> served within our published zones. Delivery requires a confirmed location: you review your
            address, area and pin, then explicitly confirm it at checkout. Fees and lead times per zone are shown at{" "}
            <a href="#/delivery-info">Delivery Info</a> and at checkout.
          </li>
          <li>
            Some areas (for example Accra) are <b>arranged per order</b> — they&apos;re quoted individually on
            WhatsApp rather than checked out online.
          </li>
          <li>Scheduled orders: choose a date and window and we&apos;ll confirm the exact timing on WhatsApp. Requests can&apos;t be scheduled in the past.</li>
        </ul>
      </InfoSection>

      <InfoSection title="4. Gift orders">
        <ul>
          <li>Gift orders need the recipient&apos;s name — and their phone number for deliveries, so the rider can coordinate.</li>
          <li>You may hide prices from the recipient; the receipt and WhatsApp summary will show items only.</li>
          <li>Gift messages are limited to 300 characters and are shared with the recipient exactly as written.</li>
        </ul>
      </InfoSection>

      <InfoSection title="5. Cancellation &amp; refunds">
        <ul>
          <li>
            Orders can be cancelled before the kitchen starts cooking — message us on{" "}
            <WhatsAppLink whatsappIntl={whatsappIntl}>WhatsApp</WhatsAppLink> as early as you can.
          </li>
          <li>Once cooking has started we can&apos;t refund prepared food, but we will always make a genuine issue right.</li>
          <li>Approved refunds are returned through the same channel used to pay.</li>
        </ul>
      </InfoSection>

      <InfoSection title="6. Food &amp; allergens">
        <p>
          Everything is cooked fresh in a kitchen that handles fish, eggs, groundnuts, wheat and chilli. If you have an
          allergy, tell us in the order note and on WhatsApp before checkout — we&apos;ll be honest about what we can
          safely do.
        </p>
      </InfoSection>

      <InfoSection title="7. Accounts">
        <ul>
          <li>Keep your password private; you&apos;re responsible for activity under your account.</li>
          <li>Accounts are free, and you may ask us to delete yours at any time.</li>
        </ul>
      </InfoSection>

      <InfoSection title="8. Contact">
        <p>
          Questions about these terms? Call <a href={`tel:+${phone.replace(/^0/, "233")}`}>{phone}</a> or{" "}
          <WhatsAppLink whatsappIntl={whatsappIntl}>WhatsApp us</WhatsAppLink> — a real person who knows the kitchen
          will answer.
        </p>
      </InfoSection>
    </InfoShell>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery Info                                                       */
/* ------------------------------------------------------------------ */

function ZoneTable({ zones }: { zones: ZoneDTO[] }) {
  const { formatMoney } = useCurrency();
  if (zones.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
        Our delivery zones are being updated right now — choose your area at checkout, or message us for the current
        areas and fees.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {zones.map((zone) => (
          <li key={zone.id} className="space-y-2.5 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
                <MapPin className="size-4 text-gold" aria-hidden="true" />
                {zone.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="gap-1 rounded-full text-forest">
                  <Bike className="size-3" aria-hidden="true" />
                  {zone.fee === 0 ? "Free" : formatMoney(zone.fee)}
                </Badge>
                <Badge variant="outline" className="gap-1 rounded-full text-forest">
                  <Clock className="size-3" aria-hidden="true" />
                  ~{zone.leadMinutes < 60 ? `${zone.leadMinutes} min` : `${Math.floor(zone.leadMinutes / 60)}h${zone.leadMinutes % 60 ? ` ${zone.leadMinutes % 60}m` : ""}`}
                </Badge>
                {zone.minSubtotal > 0 && (
                  <Badge variant="outline" className="gap-1 rounded-full text-forest">
                    <Wallet className="size-3" aria-hidden="true" />
                    Min {formatMoney(zone.minSubtotal)}
                  </Badge>
                )}
                {zone.requiresQuote && (
                  <Badge className="rounded-full bg-gold text-forest">Arranged per order</Badge>
                )}
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {zone.areas.map((area) => (
                <li key={area} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/80">
                  {area}
                </li>
              ))}
            </ul>
            {zone.note && <p className="text-xs leading-relaxed text-muted-foreground">{zone.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryInfoView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
  const { phone, whatsappIntl } = useContact();
  const { formatMoney } = useCurrency();
  const zones = bootstrap?.zones ?? [];
  const settings = bootstrap?.settings;
  const deliveryEnabled = settings?.delivery.enabled ?? true;
  const freeOver = settings?.delivery.freeOver ?? null;
  const quoteZones = zones.filter((z) => z.requiresQuote);

  return (
    <InfoShell
      eyebrow="Delivery Info"
      title="How your food reaches you."
      lead="Hot from our kitchen in Mampong-Akuapem to your door — here's exactly how delivery works, what it costs, and how long it takes."
    >
      {!deliveryEnabled && (
        <div className="rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-medium text-forest">
          Delivery is paused at the moment — pickup is always available, and you can call or WhatsApp us to arrange
          anything special.
        </div>
      )}

      <InfoSection title="Pickup or delivery?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-2 font-semibold text-forest">
                <Store className="size-4 text-gold" aria-hidden="true" />
                Pickup
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Collect your order hot from the kitchen in Mampong-Akuapem. No delivery fee, no waiting for a rider —
                we&apos;ll give you the exact ready time when you order.
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-2 font-semibold text-forest">
                <Bike className="size-4 text-gold" aria-hidden="true" />
                Delivery
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enter your address, choose your delivery area, and confirm the location on the map. The fee and lead
                time for your zone are shown before you pay —{freeOver !== null && freeOver > 0 ? ` and delivery is free on subtotals of ${formatMoney(freeOver)} or more.` : " no hidden extras."}
              </p>
            </CardContent>
          </Card>
        </div>
      </InfoSection>

      <InfoSection title="Zones, fees &amp; lead times">
        <p>
          Fees below are resolved automatically from your address at checkout — the same table the checkout charges
          from, so what you see is what you pay.
        </p>
        <ZoneTable zones={zones} />
      </InfoSection>

      {quoteZones.length > 0 && (
        <InfoSection title="Accra &amp; longer-distance deliveries">
          <p>
            {quoteZones.map((z) => z.name).join(", ")} and similar longer-distance runs are{" "}
            <b>arranged per order</b>: message us with your location, the dishes you want and the date, and we&apos;ll
            confirm a quote and delivery window on WhatsApp. This keeps costs honest instead of padding every order.
          </p>
        </InfoSection>
      )}

      <InfoSection title="Confirming your location">
        <ul>
          <li>Type your full address (house number, street, area) — the map pin follows what you type.</li>
          <li>Add a nearest landmark; in Ghana that&apos;s often faster than the street name.</li>
          <li>Review the summary — address, area, fee, lead time — then tap <b>Confirm location</b>. Orders are only accepted once the location is confirmed.</li>
          <li>After that, the rider follows exactly what you confirmed. Change the address and you simply confirm again.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Scheduling a later delivery">
        <p>
          Planning a Sunday family lunch or a corporate lunch drop? At checkout, switch on <b>Schedule for
          later</b>, pick a date and a two-hour window (08:00–20:00), and we&apos;ll confirm the timing on WhatsApp.
          Everything is still cooked fresh for your window.
        </p>
      </InfoSection>

      <div className="flex flex-col gap-3 rounded-2xl bg-forest px-6 py-8 text-center text-cream shadow-md sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="flex items-center justify-center gap-2 font-display text-xl font-semibold sm:justify-start">
            <CalendarClock className="size-5 text-gold" aria-hidden="true" />
            Ready to order?
          </p>
          <p className="mt-1 text-sm text-cream/80">
            Delivery or pickup — your next meal is a few taps away. Questions? Call{" "}
            <a href={`tel:+${phone.replace(/^0/, "233")}`} className="font-semibold text-cream underline underline-offset-2">
              {phone}
            </a>{" "}
            or{" "}
            <WhatsAppLink whatsappIntl={whatsappIntl}>
              <span className="font-semibold text-cream underline underline-offset-2">WhatsApp us</span>
            </WhatsAppLink>
            .
          </p>
        </div>
        <Button
          onClick={() => navigate("checkout")}
          className="min-h-11 shrink-0 gap-2 rounded-full bg-gold px-6 font-semibold text-forest hover:bg-gold/90"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Start an order
        </Button>
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <MessageCircle className="size-3.5" aria-hidden="true" />
        Outside our zones? We sometimes make special arrangements — just ask.
      </p>
    </InfoShell>
  );
}
