"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Bike,
  Loader2,
  MessageCircle,
  PackageOpen,
  PauseCircle,
  Phone,
  Store,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAppStore } from "@/store/app-store";
import { useBootstrapData } from "@/hooks/use-bootstrap";
import { apiSend, formatGHS } from "@/lib/client";
import { apiErrorBody, apiErrorStatus, cartUnitPrice } from "./storefront-lib";
import { DeliveryMapCard } from "./delivery-map";
import type { CheckoutPayload, CreateOrderResponse, CouponValidateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[0-9+\s-]{9,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Please enter your full name"),
    customerPhone: z
      .string()
      .trim()
      .regex(PHONE_REGEX, "Enter a valid phone number (9–15 digits, may start with +)"),
    customerEmail: z.string().trim().max(120).optional(),
    fulfillmentType: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(400).optional(),
    note: z.string().trim().max(500, "Note is a little too long").optional(),
  })
  .superRefine((val, ctx) => {
    if (val.customerEmail && val.customerEmail.length > 0 && !EMAIL_REGEX.test(val.customerEmail)) {
      ctx.addIssue({ code: "custom", path: ["customerEmail"], message: "Enter a valid email address or leave this blank" });
    }
    if (val.fulfillmentType === "delivery" && (!val.address || val.address.trim().length < 6)) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Please enter your delivery address" });
    }
  });

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `narex-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CheckoutView() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const cart = useAppStore((s) => s.cart);
  const navigate = useAppStore((s) => s.navigate);
  const setLastOrder = useAppStore((s) => s.setLastOrder);
  const clearCart = useAppStore((s) => s.clearCart);
  const { refresh } = useBootstrapData();

  /* One idempotency key per visit to checkout — reused across retries. */
  const [idempotencyKey] = useState(newIdempotencyKey);

  const settings = bootstrap?.settings;
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidateResponse | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      fulfillmentType: "pickup",
      address: "",
      note: "",
    },
  });

  const fulfillment = watch("fulfillmentType");
  const addressValue = watch("address") ?? "";
  const deliveryEnabled = settings?.delivery.enabled ?? false;

  const lines = useMemo(
    () =>
      cart.map((item) => {
        const product = bootstrap?.products.find((p) => p.id === item.productId);
        const variant = product?.variants.find((v) => v.id === item.variantId);
        const addons = product?.addons.filter((a) => item.addonIds.includes(a.id)) ?? [];
        return { item, product, variant, addons, unit: cartUnitPrice(product, item.variantId, item.addonIds) };
      }),
    [cart, bootstrap]
  );

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => (l.product ? sum + l.unit * l.item.quantity : sum), 0),
    [lines]
  );
  const discount = coupon?.valid ? coupon.discount : 0;
  const freeOver = settings?.delivery.freeOver ?? null;
  const baseFee = settings?.delivery.baseFee ?? 0;
  const deliveryFee =
    fulfillment === "delivery" && deliveryEnabled
      ? freeOver !== null && subtotal - discount >= freeOver
        ? 0
        : baseFee
      : 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  async function applyCoupon() {
    const trimmed = couponCode.trim();
    if (!trimmed) {
      toast.error("Enter a coupon code first");
      return;
    }
    setCouponBusy(true);
    try {
      const res = await apiSend<CouponValidateResponse>("/api/coupons/validate", "POST", {
        code: trimmed,
        items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, addonIds: [...i.addonIds] })),
        fulfillmentType: fulfillment,
      });
      setCoupon(res);
      if (res.valid) toast.success(res.message || `Coupon ${res.code ?? trimmed} applied`);
      else toast.error(res.message || "That coupon is not valid for this order");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not validate coupon");
    } finally {
      setCouponBusy(false);
    }
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (!settings || cart.length === 0) return;
    setPlacing(true);
    try {
      const payload: CheckoutPayload = {
        idempotencyKey,
        items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, addonIds: [...i.addonIds] })),
        fulfillmentType: values.fulfillmentType,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail ? values.customerEmail : undefined,
        address: values.fulfillmentType === "delivery" ? values.address || undefined : undefined,
        note: values.note ? values.note : undefined,
        couponCode: coupon?.valid ? coupon.code : undefined,
      };
      const res = await apiSend<CreateOrderResponse>("/api/orders", "POST", payload);
      setLastOrder({ order: res.order, whatsappUrl: res.whatsappUrl });
      clearCart();
      navigate("success");
    } catch (err) {
      const status = apiErrorStatus(err);
      const body = apiErrorBody(err);
      if (status === 409 && body?.unavailable && body.unavailable.length > 0) {
        toast.error("Some items just became unavailable", {
          description: body.unavailable.join(" · "),
          duration: 8000,
        });
        void refresh();
      } else if (status === 409 && body?.orderingPaused) {
        toast.error("Online ordering is paused right now — please call or WhatsApp us.");
      } else {
        toast.error(body?.error ?? (err instanceof Error ? err.message : "Could not place your order"));
      }
    } finally {
      setPlacing(false);
    }
  }

  /* Ordering paused */
  if (settings && !settings.ordering.enabled) {
    const contact = settings.contact;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <Card className="rounded-3xl border-gold/40 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-gold/15">
              <PauseCircle className="size-9 text-gold" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl font-bold text-forest">Online ordering is paused</h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {settings.ordering.pauseNote}
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream">
                <a href={`tel:+${contact.phone.replace(/^0/, "233")}`}>
                  <Phone className="size-4" aria-hidden="true" /> Call {contact.phone}
                </a>
              </Button>
              <Button asChild className="min-h-11 rounded-full bg-forest text-cream hover:bg-forest/90">
                <a href={`https://wa.me/${contact.whatsappIntl}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp us
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* Empty cart */
  if (cart.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-muted">
              <PackageOpen className="size-8 text-muted-foreground/60" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl font-bold text-forest">Your cart is empty</h1>
            <p className="text-sm text-muted-foreground">Add a few dishes to your cart before checking out.</p>
            <Button
              onClick={() => navigate("menu")}
              className="mt-1 min-h-11 rounded-full bg-forest px-6 text-cream hover:bg-forest/90"
            >
              Browse the menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
      <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-muted-foreground">Almost there — tell us where the food is going.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: details */}
          <div className="space-y-6">
            {/* Contact */}
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-forest">Your details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="co-name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="co-name"
                      autoComplete="name"
                      placeholder="Ama Mensah"
                      aria-invalid={Boolean(errors.customerName)}
                      className="min-h-11 rounded-xl"
                      {...register("customerName")}
                    />
                    {errors.customerName && (
                      <p className="text-xs font-medium text-destructive">{errors.customerName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="co-phone">
                      Phone number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="co-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0559 291 195"
                      aria-invalid={Boolean(errors.customerPhone)}
                      className="min-h-11 rounded-xl"
                      {...register("customerPhone")}
                    />
                    {errors.customerPhone && (
                      <p className="text-xs font-medium text-destructive">{errors.customerPhone.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co-email">Email (optional)</Label>
                  <Input
                    id="co-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.customerEmail)}
                    className="min-h-11 rounded-xl"
                    {...register("customerEmail")}
                  />
                  {errors.customerEmail && (
                    <p className="text-xs font-medium text-destructive">{errors.customerEmail.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fulfillment */}
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-forest">Pickup or delivery?</h2>
                <RadioGroup
                  value={fulfillment}
                  onValueChange={(v) => setValue("fulfillmentType", v as "pickup" | "delivery", { shouldValidate: true })}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <Label
                    htmlFor="ff-pickup"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                      fulfillment === "pickup" ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-border hover:border-forest/40"
                    )}
                  >
                    <RadioGroupItem id="ff-pickup" value="pickup" className="mt-0.5" />
                    <span className="space-y-1">
                      <span className="flex items-center gap-2 font-semibold">
                        <Store className="size-4 text-forest" aria-hidden="true" />
                        Pickup
                      </span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        Collect your order hot from our kitchen — no delivery fee.
                      </span>
                    </span>
                  </Label>

                  <Label
                    htmlFor="ff-delivery"
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                      !deliveryEnabled && "cursor-not-allowed opacity-60",
                      fulfillment === "delivery" ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-border hover:border-forest/40"
                    )}
                  >
                    <RadioGroupItem
                      id="ff-delivery"
                      value="delivery"
                      disabled={!deliveryEnabled}
                      className="mt-0.5"
                    />
                    <span className="space-y-1">
                      <span className="flex items-center gap-2 font-semibold">
                        <Bike className="size-4 text-forest" aria-hidden="true" />
                        Delivery
                        {!deliveryEnabled && (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            Unavailable
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        {deliveryEnabled
                          ? `Delivered to your door · ${formatGHS(baseFee)}${freeOver !== null ? ` (free over ${formatGHS(freeOver)})` : ""}`
                          : settings?.delivery.note || "Delivery is currently unavailable."}
                      </span>
                    </span>
                  </Label>
                </RadioGroup>

                {fulfillment === "delivery" && deliveryEnabled && (
                  <div className="space-y-4 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="co-address">
                        Delivery address <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="co-address"
                        rows={3}
                        placeholder="House number, street, landmark, area…"
                        aria-invalid={Boolean(errors.address)}
                        className="rounded-xl bg-background"
                        {...register("address")}
                      />
                      {errors.address && (
                        <p className="text-xs font-medium text-destructive">{errors.address.message}</p>
                      )}
                    </div>
                    {/* Pinned preview map — follows the typed address */}
                    <DeliveryMapCard address={addressValue} areas={settings?.delivery.areas ?? []} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="co-note">Order note (optional)</Label>
                  <Textarea
                    id="co-note"
                    rows={2}
                    placeholder="Allergies, spice level, delivery instructions…"
                    className="rounded-xl"
                    aria-invalid={Boolean(errors.note)}
                    {...register("note")}
                  />
                  {errors.note && <p className="text-xs font-medium text-destructive">{errors.note.message}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: summary */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-forest">Order summary</h2>

                <ul className="max-h-56 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
                  {lines.map(({ item, product, variant, addons, unit }, i) => (
                    <li key={`${item.productId}-${item.variantId}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {item.quantity} × {product?.name ?? "Unavailable item"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {variant?.name}
                          {addons.length > 0 && ` · ${addons.map((a) => a.name).join(", ")}`}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">{formatGHS(unit * item.quantity)}</span>
                    </li>
                  ))}
                </ul>

                <Separator />

                {/* Coupon */}
                {coupon?.valid ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-forest">
                      <Tag className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate font-semibold">{coupon.code ?? couponCode.toUpperCase()}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCoupon(null);
                        setCouponCode("");
                      }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Remove coupon"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Coupon code"
                      aria-label="Coupon code"
                      className="min-h-11 rounded-xl uppercase placeholder:normal-case"
                      onKeyDown={(e) => e.key === "Enter" && void applyCoupon()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void applyCoupon()}
                      disabled={couponBusy}
                      className="min-h-11 shrink-0 rounded-xl border-forest/30 px-4 font-semibold text-forest hover:bg-forest hover:text-cream"
                    >
                      {couponBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Apply"}
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatGHS(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-forest">
                      <span>Discount ({coupon?.code})</span>
                      <span className="font-semibold">−{formatGHS(discount)}</span>
                    </div>
                  )}
                  {fulfillment === "delivery" && deliveryEnabled && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery fee</span>
                      <span className="font-semibold">{deliveryFee === 0 ? "Free" : formatGHS(deliveryFee)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-display text-xl font-bold text-forest">{formatGHS(total)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={placing}
                  className="min-h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90"
                >
                  {placing ? (
                    <>
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                      Placing your order…
                    </>
                  ) : (
                    `Place order · ${formatGHS(total)}`
                  )}
                </Button>

                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
                  You&apos;ll confirm your order on WhatsApp right after this — nothing is charged online.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
