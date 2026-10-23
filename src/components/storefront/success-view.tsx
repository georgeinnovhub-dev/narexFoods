"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Home, MessageCircle, PackageSearch, Route } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { formatGHS } from "@/lib/client";
import { StatusBadge } from "./status-badge";
import { StatusTimeline } from "./status-timeline";
import { PaymentBox } from "./payment-box";
import { usePrefersReducedMotion } from "./storefront-lib";

export function SuccessView() {
  const lastOrder = useAppStore((s) => s.lastOrder);
  const navigate = useAppStore((s) => s.navigate);
  const [waOpened, setWaOpened] = useState(false);
  const reduced = usePrefersReducedMotion();

  if (!lastOrder) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <PackageSearch className="size-12 text-muted-foreground/50" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold text-forest">No recent order</h1>
            <p className="text-sm text-muted-foreground">
              Place an order and it will appear here — or track an existing one with your reference.
            </p>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => navigate("home")} variant="outline" className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream">
                Back to home
              </Button>
              <Button onClick={() => navigate("track")} className="min-h-11 rounded-full bg-forest text-cream hover:bg-forest/90">
                Track an order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, whatsappUrl } = lastOrder;

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(order.reference);
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy — please note it down manually");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <motion.span
          initial={reduced ? false : { scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="flex size-20 items-center justify-center rounded-full bg-forest/10 ring-4 ring-gold/30"
        >
          <CheckCircle2 className="size-11 text-forest" aria-hidden="true" />
        </motion.span>
        <h1 className="mt-5 font-display text-3xl font-bold text-forest sm:text-4xl">
          Thank you, {order.customerName.split(" ")[0]}!
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your order is saved with us. Send it to our kitchen on WhatsApp for the fastest confirmation.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-sm">
          <span className="font-mono text-sm font-bold tracking-wide text-forest">{order.reference}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void copyReference()}
            className="size-9 rounded-full text-muted-foreground hover:text-forest"
            aria-label="Copy order reference"
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* WhatsApp handoff */}
      <div className="mt-8 space-y-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => setWaOpened(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold text-base font-semibold text-forest shadow-md transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          Send order on WhatsApp
        </a>
        {waOpened && (
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest" role="status">
            WhatsApp opened — your order is already saved with us. Reference:{" "}
            <span className="font-mono font-bold">{order.reference}</span>
          </p>
        )}
      </div>

      {/* Status + timeline */}
      <Card className="mt-8 rounded-2xl shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-forest">Order status</h2>
            <div className="flex gap-2">
              <StatusBadge status={order.status} kind="order" />
              <Badge variant="outline" className="rounded-full capitalize">
                {order.fulfillmentType}
              </Badge>
            </div>
          </div>
          <StatusTimeline events={order.events} />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="mt-6 rounded-2xl shadow-sm">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-forest">Order summary</h2>
          <ul className="space-y-3 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity} × {item.productName} <span className="text-muted-foreground">({item.variantName})</span>
                  </p>
                  {item.addons.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.addons.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-semibold">{formatGHS(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {order.address && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Deliver to: </span>
              {order.address}
            </p>
          )}
          {order.note && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>
              {order.note}
            </p>
          )}
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatGHS(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-forest">
                <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span>−{formatGHS(order.discount)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery fee</span>
                <span>{formatGHS(order.deliveryFee)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Total</span>
              <span className="font-display font-bold text-forest">{formatGHS(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card className="mt-6 rounded-2xl shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <PaymentBox order={order} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => navigate("track", { reference: order.reference })}
          variant="outline"
          className="min-h-11 flex-1 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
        >
          <Route className="size-4" aria-hidden="true" />
          Track order
        </Button>
        <Button
          onClick={() => navigate("home")}
          variant="ghost"
          className="min-h-11 flex-1 rounded-full text-forest hover:bg-forest/10"
        >
          <Home className="size-4" aria-hidden="true" />
          Back to home
        </Button>
      </div>
    </div>
  );
}
