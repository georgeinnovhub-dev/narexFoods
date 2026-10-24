"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  MapPin,
  MessageCircle,
  PackageOpen,
  PauseCircle,
  Pencil,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/app-store";
import { useBootstrapData } from "@/hooks/use-bootstrap";
import { apiSend } from "@/lib/client";
import { useCurrency } from "./currency-context";
import { apiErrorBody, apiErrorStatus, cartUnitPrice } from "./storefront-lib";
import { DeliveryMapCard } from "./delivery-map";
import type { CheckoutPayload, CreateOrderResponse, CouponValidateResponse, ZoneDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[0-9+\s-]{9,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIME_WINDOWS = [
  "08:00–10:00",
  "10:00–12:00",
  "12:00–14:00",
  "14:00–16:00",
  "16:00–18:00",
  "18:00–20:00",
] as const;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function leadLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
    landmark: z.string().trim().max(200).optional(),
    isGift: z.boolean().optional(),
    recipientName: z.string().trim().max(80).optional(),
    recipientPhone: z.string().trim().max(15).optional(),
    giftMessage: z.string().trim().max(300, "Gift message is limited to 300 characters").optional(),
    scheduledDate: z.string().trim().max(10).optional(),
    note: z.string().trim().max(500, "Note is a little too long").optional(),
  })
  .superRefine((val, ctx) => {
    if (val.customerEmail && val.customerEmail.length > 0 && !EMAIL_REGEX.test(val.customerEmail)) {
      ctx.addIssue({ code: "custom", path: ["customerEmail"], message: "Enter a valid email address or leave this blank" });
    }
    if (val.fulfillmentType === "delivery" && (!val.address || val.address.trim().length < 6)) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Please enter your delivery address" });
    }
    if (val.scheduledDate && val.scheduledDate.length > 0 && val.scheduledDate < todayYMD()) {
      ctx.addIssue({ code: "custom", path: ["scheduledDate"], message: "Scheduled date cannot be in the past" });
    }
    if (val.isGift) {
      if (!val.recipientName || val.recipientName.trim().length < 2) {
        ctx.addIssue({ code: "custom", path: ["recipientName"], message: "Please enter the recipient's full name" });
      }
      if (val.fulfillmentType === "delivery" && (!val.recipientPhone || !PHONE_REGEX.test(val.recipientPhone))) {
        ctx.addIssue({
          code: "custom",
          path: ["recipientPhone"],
          message: "Enter the recipient's phone number so we can coordinate the delivery",
        });
      }
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
  const { formatMoney } = useCurrency();

  /* One idempotency key per visit to checkout — reused across retries. */
  const [idempotencyKey] = useState(newIdempotencyKey);

  /* One-shot saved-address prefill ("Use at checkout" from the account area). */
  const [initPrefill] = useState(() => useAppStore.getState().checkoutPrefill);

  const settings = bootstrap?.settings;
  const zones = useMemo<ZoneDTO[]>(() => bootstrap?.zones ?? [], [bootstrap]);
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidateResponse | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedSig, setConfirmedSig] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [hidePrices, setHidePrices] = useState(false);
  const mapCardRef = useRef<HTMLDivElement | null>(null);

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
      address: initPrefill?.address ?? "",
      landmark: initPrefill?.landmark ?? "",
      isGift: false,
      recipientName: "",
      recipientPhone: "",
      giftMessage: "",
      scheduledDate: "",
      note: "",
    },
  });

  /* Clear the prefill once consumed (values already seeded above). */
  useEffect(() => {
    useAppStore.getState().setCheckoutPrefill(null);
  }, []);

  const fulfillment = watch("fulfillmentType");
  const addressValue = watch("address") ?? "";
  const landmarkValue = watch("landmark") ?? "";
  const isGift = watch("isGift") ?? false;
  const giftMessageValue = watch("giftMessage") ?? "";
  const deliveryEnabled = settings?.delivery.enabled ?? false;

  /* Zone selection — manual choice wins over the address auto-suggest. */
  const [zoneId, setZoneId] = useState(() => initPrefill?.zoneId ?? "");
  const [manualZone, setManualZone] = useState(() => Boolean(initPrefill?.zoneId));

  const suggestedZone = useMemo(() => {
    const q = addressValue.trim().toLowerCase();
    if (q.length < 4) return null;
    return (
      zones.find((zone) => zone.areas.some((a) => q.includes(a.toLowerCase()))) ?? null
    );
  }, [addressValue, zones]);

  /* Render-phase adjustment: keep the zone in sync with the typed address
     until the customer explicitly chooses one. */
  if (!manualZone && (suggestedZone?.id ?? "") !== zoneId) {
    setZoneId(suggestedZone?.id ?? "");
  }

  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? null;
  const zonesConfigured = zones.length > 0;

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

  /* Mirrors the server (lib/orders.ts): free delivery is measured on the
     PRE-DISCOUNT subtotal, and a matched zone's fee replaces the flat fee. */
  const freeOver = settings?.delivery.freeOver ?? null;
  const baseFee = settings?.delivery.baseFee ?? 0;
  const freeDeliveryApplies = freeOver !== null && freeOver > 0 && subtotal >= freeOver;
  const deliveryFee =
    fulfillment === "delivery" && deliveryEnabled
      ? zonesConfigured
        ? selectedZone
          ? freeDeliveryApplies
            ? 0
            : selectedZone.fee
          : 0
        : freeDeliveryApplies
          ? 0
          : baseFee
      : 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  /* Delivery gates — every one of these blocks submission (server enforces too). */
  const locationSig = `${addressValue.trim()}|${landmarkValue.trim()}|${zoneId}`;
  const locationConfirmed = confirmed && confirmedSig === locationSig;
  const quoteBlocked = selectedZone?.requiresQuote === true;
  const zoneMinUnmet = selectedZone !== null && selectedZone.minSubtotal > 0 && subtotal < selectedZone.minSubtotal;
  const zoneMissing = fulfillment === "delivery" && deliveryEnabled && zonesConfigured && selectedZone === null;
  const deliveryBlocked =
    fulfillment === "delivery" && deliveryEnabled && (zoneMissing || quoteBlocked || zoneMinUnmet || !locationConfirmed);

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
    setServerAlert(null);

    if (values.fulfillmentType === "delivery" && deliveryEnabled) {
      if (quoteBlocked) return; /* guidance card explains; never send */
      if (!locationConfirmed) {
        toast.error("Please confirm your delivery location before placing the order.");
        mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    setPlacing(true);
    try {
      const delivery = values.fulfillmentType === "delivery";
      const payload: CheckoutPayload = {
        idempotencyKey,
        items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, addonIds: [...i.addonIds] })),
        fulfillmentType: values.fulfillmentType,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail ? values.customerEmail : undefined,
        address: delivery ? values.address || undefined : undefined,
        landmark: delivery ? values.landmark || undefined : undefined,
        addressLat: delivery && coords ? coords.lat : undefined,
        addressLng: delivery && coords ? coords.lng : undefined,
        locationConfirmed: delivery ? true : undefined,
        deliveryZoneId: delivery && selectedZone ? selectedZone.id : undefined,
        scheduledDate: scheduleEnabled && values.scheduledDate ? values.scheduledDate : undefined,
        scheduledTime: scheduleEnabled && scheduleTime ? scheduleTime : undefined,
        isGift: Boolean(values.isGift),
        recipientName: values.isGift ? values.recipientName || undefined : undefined,
        recipientPhone: values.isGift ? values.recipientPhone || undefined : undefined,
        giftMessage: values.isGift ? values.giftMessage || undefined : undefined,
        hidePrices: values.isGift ? hidePrices : undefined,
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
      } else if (status === 422 && body?.locationUnconfirmed) {
        toast.error("Please confirm your delivery location on the map first.");
        mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (status === 409 && (body?.outsideZones || body?.quoteRequired || body?.zoneMinSubtotal !== undefined)) {
        const message =
          body?.error ??
          "We can't deliver to that area with the current settings — please check your delivery area or WhatsApp us.";
        setServerAlert(message);
        mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        toast.error(body?.error ?? (err instanceof Error ? err.message : "Could not place your order"));
      }
    } finally {
      setPlacing(false);
    }
  }

  function confirmLocation() {
    setConfirmed(true);
    setConfirmedSig(locationSig);
    setConfirmOpen(false);
    toast.success("Delivery location confirmed");
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

  const whatsappIntl = settings?.contact.whatsappIntl ?? "233559291195";
  const minDate = todayYMD();

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
                          ? freeOver !== null && freeOver > 0
                            ? `Free delivery over ${formatMoney(freeOver)} · zone fees shown below`
                            : "Zone-based fees — choose your delivery area below"
                          : settings?.delivery.note || "Delivery is currently unavailable."}
                      </span>
                    </span>
                  </Label>
                </RadioGroup>

                {fulfillment === "delivery" && deliveryEnabled && (
                  <div className="space-y-4 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
                    {/* Delivery zone */}
                    <div className="space-y-1.5">
                      <Label htmlFor="co-zone">
                        Delivery area <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={zoneId}
                        onValueChange={(v) => {
                          setManualZone(true);
                          setZoneId(v);
                          setServerAlert(null);
                        }}
                      >
                        <SelectTrigger
                          id="co-zone"
                          aria-label="Choose your delivery area"
                          className="min-h-11 w-full rounded-xl bg-background"
                        >
                          <SelectValue placeholder="Choose your delivery area" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((zone) => (
                            <SelectItem key={zone.id} value={zone.id} className="min-h-11">
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {suggestedZone && zoneId === suggestedZone.id && !manualZone && (
                        <p className="text-xs text-muted-foreground">
                          Detected from your address: <span className="font-semibold text-forest">{suggestedZone.name}</span>
                        </p>
                      )}
                      {zonesConfigured && !selectedZone && addressValue.trim().length >= 6 && (
                        <p className="text-xs text-muted-foreground">
                          We couldn&apos;t match your address to a zone yet — pick the closest area above, or{" "}
                          <a
                            href={`https://wa.me/${whatsappIntl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-forest underline underline-offset-2"
                          >
                            WhatsApp us
                          </a>{" "}
                          for a custom arrangement.
                        </p>
                      )}
                    </div>

                    {/* Zone facts / quote warning */}
                    {selectedZone && (
                      <div className="rounded-xl border border-border bg-background p-3.5 text-sm">
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-forest">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <MapPin className="size-3.5 text-gold" aria-hidden="true" />
                            {selectedZone.name}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Bike className="size-3.5 text-gold" aria-hidden="true" />
                            {freeDeliveryApplies ? "Free delivery" : `Fee ${formatMoney(selectedZone.fee)}`}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5 text-gold" aria-hidden="true" />
                            ~{leadLabel(selectedZone.leadMinutes)} lead time
                          </span>
                          {selectedZone.minSubtotal > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <AlertTriangle className="size-3.5 text-gold" aria-hidden="true" />
                              Min order {formatMoney(selectedZone.minSubtotal)}
                            </span>
                          )}
                        </p>
                        {selectedZone.note && (
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{selectedZone.note}</p>
                        )}
                      </div>
                    )}

                    {quoteBlocked && selectedZone && (
                      <Alert className="border-gold/60 bg-gold/10 text-forest">
                        <AlertTriangle className="size-4 text-gold" aria-hidden="true" />
                        <AlertTitle className="font-display text-base font-semibold">
                          {selectedZone.name} is arranged per order
                        </AlertTitle>
                        <AlertDescription className="text-sm leading-relaxed text-forest/90">
                          {selectedZone.note ||
                            "Deliveries to this area are quoted individually."}{" "}
                          Please{" "}
                          <a
                            href={`https://wa.me/${whatsappIntl}?text=${encodeURIComponent(`Hello NAREX Foods, I'd like to arrange a delivery to ${selectedZone.name}.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline underline-offset-2"
                          >
                            WhatsApp us
                          </a>{" "}
                          to confirm this delivery — online checkout isn&apos;t available for this area yet.
                        </AlertDescription>
                      </Alert>
                    )}

                    {zoneMinUnmet && selectedZone && (
                      <Alert className="border-gold/60 bg-gold/10 text-forest">
                        <AlertTriangle className="size-4 text-gold" aria-hidden="true" />
                        <AlertTitle className="font-display text-base font-semibold">
                          Minimum order for {selectedZone.name}
                        </AlertTitle>
                        <AlertDescription className="text-sm leading-relaxed text-forest/90">
                          Orders to {selectedZone.name} need a subtotal of at least {formatMoney(selectedZone.minSubtotal)} —
                          yours is {formatMoney(subtotal)}. Add a little more to your basket.
                        </AlertDescription>
                      </Alert>
                    )}

                    {serverAlert && (
                      <Alert variant="destructive" role="alert">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        <AlertTitle className="font-display text-base font-semibold">We couldn&apos;t take that order</AlertTitle>
                        <AlertDescription className="text-sm leading-relaxed">{serverAlert}</AlertDescription>
                      </Alert>
                    )}

                    {/* Address + landmark */}
                    <div className="space-y-1.5">
                      <Label htmlFor="co-address">
                        Delivery address <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="co-address"
                        rows={3}
                        placeholder="House number, street, area…"
                        aria-invalid={Boolean(errors.address)}
                        className="rounded-xl bg-background"
                        {...register("address")}
                      />
                      {errors.address && (
                        <p className="text-xs font-medium text-destructive">{errors.address.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co-landmark">Nearest landmark (optional)</Label>
                      <Input
                        id="co-landmark"
                        placeholder="e.g. opposite the blue gate, near Melcom"
                        className="min-h-11 rounded-xl bg-background"
                        {...register("landmark")}
                      />
                    </div>

                    {/* Pinned preview map — follows the typed address */}
                    <div ref={mapCardRef}>
                      <DeliveryMapCard
                        address={addressValue}
                        areas={selectedZone?.areas ?? settings?.delivery.areas ?? []}
                        onLocationResolved={setCoords}
                      />
                    </div>

                    {/* Location confirmation (spec §6) */}
                    {locationConfirmed ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
                          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                          Location confirmed
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmOpen(true)}
                          className="min-h-9 gap-1.5 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        className="min-h-11 w-full gap-2 rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                      >
                        <MapPin className="size-4" aria-hidden="true" />
                        Confirm delivery location
                      </Button>
                    )}
                    {!locationConfirmed && !quoteBlocked && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Orders are only accepted once you confirm the pin and details above — the rider follows exactly this.
                      </p>
                    )}
                  </div>
                )}

                {/* Scheduling */}
                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="co-schedule" className="flex items-center gap-2 font-semibold">
                      <CalendarClock className="size-4 text-forest" aria-hidden="true" />
                      Schedule for later
                    </Label>
                    <Switch
                      id="co-schedule"
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                      aria-label="Schedule this order for later"
                    />
                  </div>
                  {scheduleEnabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="co-date">Preferred date</Label>
                        <Input
                          id="co-date"
                          type="date"
                          min={minDate}
                          aria-invalid={Boolean(errors.scheduledDate)}
                          className="min-h-11 rounded-xl"
                          {...register("scheduledDate")}
                        />
                        {errors.scheduledDate && (
                          <p className="text-xs font-medium text-destructive">{errors.scheduledDate.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="co-window">Delivery window</Label>
                        <Select value={scheduleTime || undefined} onValueChange={setScheduleTime}>
                          <SelectTrigger id="co-window" aria-label="Choose a delivery window" className="min-h-11 w-full rounded-xl">
                            <SelectValue placeholder="Choose a window" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_WINDOWS.map((w) => (
                              <SelectItem key={w} value={w} className="min-h-11">
                                {w}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                        We&apos;ll treat this as a request and confirm the exact timing on WhatsApp — the kitchen
                        always cooks your order fresh for the window.
                      </p>
                    </div>
                  )}
                </div>

                {/* Gifting (spec §9) */}
                <div className="space-y-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="co-gift" className="flex items-center gap-2 font-semibold">
                      <Gift className="size-4 text-forest" aria-hidden="true" />
                      Send this order as a gift
                    </Label>
                    <Switch
                      id="co-gift"
                      checked={isGift}
                      onCheckedChange={(checked) => setValue("isGift", checked, { shouldValidate: false })}
                      aria-label="Send this order as a gift"
                    />
                  </div>
                  {isGift && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="co-recipient-name">
                            Recipient&apos;s name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="co-recipient-name"
                            placeholder="Kwame Boateng"
                            autoComplete="off"
                            aria-invalid={Boolean(errors.recipientName)}
                            className="min-h-11 rounded-xl"
                            {...register("recipientName")}
                          />
                          {errors.recipientName && (
                            <p className="text-xs font-medium text-destructive">{errors.recipientName.message}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="co-recipient-phone">
                            Recipient&apos;s phone{fulfillment === "delivery" && <span className="text-destructive"> *</span>}
                          </Label>
                          <Input
                            id="co-recipient-phone"
                            type="tel"
                            inputMode="tel"
                            placeholder="0559 291 195"
                            aria-invalid={Boolean(errors.recipientPhone)}
                            className="min-h-11 rounded-xl"
                            {...register("recipientPhone")}
                          />
                          {errors.recipientPhone && (
                            <p className="text-xs font-medium text-destructive">{errors.recipientPhone.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="co-gift-message">Gift message (optional)</Label>
                          <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                            {giftMessageValue.length}/300
                          </span>
                        </div>
                        <Textarea
                          id="co-gift-message"
                          rows={2}
                          maxLength={300}
                          placeholder="Happy birthday! Enjoy this from all of us 🎉"
                          className="rounded-xl"
                          {...register("giftMessage")}
                        />
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="co-hide-prices"
                          checked={hidePrices}
                          onCheckedChange={(checked) => setHidePrices(checked === true)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="co-hide-prices" className="text-sm font-normal leading-relaxed">
                          Hide prices from the recipient — the receipt and WhatsApp summary will show items
                          without their prices.
                        </Label>
                      </div>
                    </div>
                  )}
                </div>

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
                      <span className="shrink-0 font-semibold">{formatMoney(unit * item.quantity)}</span>
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
                    <span className="font-semibold">{formatMoney(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-forest">
                      <span>Discount ({coupon?.code})</span>
                      <span className="font-semibold">−{formatMoney(discount)}</span>
                    </div>
                  )}
                  {fulfillment === "delivery" && deliveryEnabled && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery fee</span>
                      <span className="font-semibold">
                        {quoteBlocked && selectedZone
                          ? "Quoted per order"
                          : zoneMissing
                            ? "Choose your area"
                            : deliveryFee === 0
                              ? "Free"
                              : formatMoney(deliveryFee)}
                      </span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-display text-xl font-bold text-forest">{formatMoney(total)}</span>
                  </div>
                </div>

                {deliveryBlocked && (
                  <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-xs leading-relaxed text-forest">
                    {quoteBlocked
                      ? "This area is arranged per order — WhatsApp us to confirm your delivery."
                      : zoneMinUnmet
                        ? `Orders here need a ${formatMoney(selectedZone?.minSubtotal ?? 0)} minimum subtotal.`
                        : zoneMissing
                          ? "Choose your delivery area above to continue."
                          : "Confirm your delivery location above to place the order."}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={placing || deliveryBlocked}
                  className="min-h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90"
                >
                  {placing ? (
                    <>
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                      Placing your order…
                    </>
                  ) : (
                    `Place order · ${formatMoney(total)}`
                  )}
                </Button>

                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
                  You&apos;ll confirm your order on WhatsApp right after this — nothing is charged online, and all
                  amounts are charged in Ghana cedis.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Confirm delivery location dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-forest">Confirm delivery location</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Our rider will follow exactly these details. Please check them carefully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p>
              <span className="font-semibold text-forest">Address: </span>
              <span className="text-muted-foreground">{addressValue.trim() || "— not entered yet —"}</span>
            </p>
            <p>
              <span className="font-semibold text-forest">Landmark: </span>
              <span className="text-muted-foreground">{landmarkValue.trim() || "—"}</span>
            </p>
            <p>
              <span className="font-semibold text-forest">Area: </span>
              <span className="text-muted-foreground">{selectedZone ? selectedZone.name : "—"}</span>
            </p>
            <p>
              <span className="font-semibold text-forest">Delivery fee: </span>
              <span className="text-muted-foreground">
                {selectedZone ? (freeDeliveryApplies ? "Free" : formatMoney(selectedZone.fee)) : "—"}
              </span>
            </p>
            {selectedZone && (
              <p>
                <span className="font-semibold text-forest">Lead time: </span>
                <span className="text-muted-foreground">about {leadLabel(selectedZone.leadMinutes)} after the kitchen starts</span>
              </p>
            )}
            {coords && (
              <p className="text-xs text-muted-foreground">
                Pin resolved from your address ({parseFloat(coords.lat).toFixed(4)}, {parseFloat(coords.lng).toFixed(4)}).
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
            >
              Edit location
            </Button>
            <Button
              type="button"
              onClick={confirmLocation}
              disabled={
                addressValue.trim().length < 6 ||
                (zonesConfigured && selectedZone === null) ||
                quoteBlocked ||
                zoneMinUnmet
              }
              className="min-h-11 gap-1.5 rounded-full bg-forest font-semibold text-cream hover:bg-forest/90"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Confirm location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
