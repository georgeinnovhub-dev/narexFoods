"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Gift, Loader2, MapPin, MessageCircle, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { apiGet } from "@/lib/client";
import { useCurrency } from "./currency-context";
import { apiErrorStatus } from "./storefront-lib";
import { StatusBadge } from "./status-badge";
import { StatusTimeline } from "./status-timeline";
import { PaymentBox } from "./payment-box";
import type { OrderDTO } from "@/lib/types";

export function TrackView() {
  const navigate = useAppStore((s) => s.navigate);
  const params = useAppStore((s) => s.params);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const { formatMoney } = useCurrency();

  const [reference, setReference] = useState(params.reference ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!reference.trim() || !phone.trim()) {
      setError("Enter both your order reference and the phone number you ordered with.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await apiGet<{ order: OrderDTO }>(
        `/api/orders?reference=${encodeURIComponent(reference.trim())}&phone=${encodeURIComponent(phone.trim())}`
      );
      setOrder(res.order);
    } catch (err) {
      setOrder(null);
      setError(
        apiErrorStatus(err) === 404
          ? "We couldn't find an order with those details. Please check your reference and phone number."
          : err instanceof Error
            ? err.message
            : "Order lookup failed — please try again."
      );
    } finally {
      setSearched(true);
      setSearching(false);
    }
  }

  const whatsappContact = bootstrap?.settings.contact.whatsappIntl ?? "233559291195";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-14">
      <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">Track your order</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your order reference and the phone number you used when ordering.
      </p>

      <Card className="mt-8 rounded-2xl shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={(e) => void lookup(e)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="track-ref">
                Order reference <span className="text-destructive">*</span>
              </Label>
              <Input
                id="track-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. NAR-4F2K9Q"
                className="min-h-11 rounded-xl font-mono uppercase"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="track-phone">
                Phone number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="track-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0559 291 195"
                className="min-h-11 rounded-xl"
                autoComplete="tel"
              />
            </div>
            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={searching}
              className="min-h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90"
            >
              {searching ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  Searching…
                </>
              ) : (
                "Find my order"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {order && (
        <div className="mt-6 space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-forest">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    Placed for {order.customerName} ·{" "}
                    {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                  </p>
                </div>
                <StatusBadge status={order.status} kind="order" />
              </div>
              <div className="flex flex-wrap gap-2">
                {order.zoneName && (
                  <Badge variant="outline" className="gap-1 rounded-full text-forest">
                    <MapPin className="size-3" aria-hidden="true" />
                    {order.zoneName}
                  </Badge>
                )}
                {order.scheduledDate && (
                  <Badge variant="outline" className="gap-1 rounded-full text-forest">
                    <CalendarClock className="size-3" aria-hidden="true" />
                    {order.scheduledDate}
                    {order.scheduledTime ? ` · ${order.scheduledTime}` : ""}
                  </Badge>
                )}
                {order.locationConfirmed && (
                  <Badge className="gap-1 rounded-full bg-emerald-600 text-white">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Location confirmed
                  </Badge>
                )}
                {order.recipientName && (
                  <Badge variant="outline" className="gap-1 rounded-full border-gold/60 bg-gold/10 text-forest">
                    <Gift className="size-3" aria-hidden="true" />
                    Gift for {order.recipientName}
                  </Badge>
                )}
              </div>
              {order.address && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Deliver to: </span>
                  {order.address}
                  {order.landmark ? ` · ${order.landmark}` : ""}
                </p>
              )}
              {order.giftMessage && (
                <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm italic leading-relaxed text-forest">
                  “{order.giftMessage}”
                </p>
              )}
              <StatusTimeline events={order.events} />
              <Separator />
              <ul className="space-y-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p>
                      {item.quantity} × {item.productName}{" "}
                      <span className="text-muted-foreground">({item.variantName})</span>
                    </p>
                    {!order.hidePrices && (
                      <span className="shrink-0 font-semibold">{formatMoney(item.lineTotal)}</span>
                    )}
                  </li>
                ))}
              </ul>
              {order.hidePrices ? (
                <p className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-medium text-forest">
                  <Gift className="size-4 shrink-0" aria-hidden="true" />
                  Prices hidden for gift orders.
                </p>
              ) : (
                <div className="flex items-center justify-between text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-display font-bold text-forest">{formatMoney(order.total)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <PaymentBox order={order} />
            </CardContent>
          </Card>

          <a
            href={`https://wa.me/${whatsappContact}?text=${encodeURIComponent(`Hello NAREX Foods, I'd like to ask about my order ${order.reference}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold font-semibold text-forest shadow-sm transition-colors hover:bg-gold/90"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Ask about this order on WhatsApp
          </a>
        </div>
      )}

      {!order && searched && !searching && !error && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <PackageSearch className="size-12 text-muted-foreground/50" aria-hidden="true" />
          <Badge variant="secondary">No order loaded</Badge>
        </div>
      )}
    </div>
  );
}
