"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Clock, Minus, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { useCurrency } from "./currency-context";
import { productAlt, SafeImage, usePrefersReducedMotion } from "./storefront-lib";

const GALLERY_INTERVAL_MS = 4000;
const MAX_QTY = 50;

export function ProductModal() {
  const productModalId = useAppStore((s) => s.productModalId);
  const closeProduct = useAppStore((s) => s.closeProduct);
  const setCartOpen = useAppStore((s) => s.setCartOpen);
  const addToCart = useAppStore((s) => s.addToCart);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const reduced = usePrefersReducedMotion();
  const { formatMoney } = useCurrency();

  const product = productModalId ? (bootstrap?.products.find((p) => p.id === productModalId) ?? null) : null;
  const images = product?.images ?? [];

  const [variantId, setVariantId] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  /* Reset selections during render whenever the modal opens for a (new) product */
  if (!product && lastProductId !== null) {
    setLastProductId(null);
  }
  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    setVariantId(product.variants.find((v) => v.available)?.id ?? "");
    setAddonIds([]);
    setQty(1);
    setImgIndex(0);
    setSlideDirection(1);
    setGalleryPaused(false);
  }

  function goToImage(next: number, direction: 1 | -1) {
    setSlideDirection(direction);
    setImgIndex(((next % images.length) + images.length) % images.length);
  }

  function stepImage(delta: 1 | -1) {
    if (images.length < 2) return;
    goToImage(imgIndex + delta, delta);
  }

  /* Gallery auto-rotation (4s), pausable, respects reduced motion */
  useEffect(() => {
    if (images.length < 2 || galleryPaused || reduced) return;
    const timer = setInterval(() => {
      setSlideDirection(1);
      setImgIndex((i) => (i + 1) % images.length);
    }, GALLERY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length, galleryPaused, reduced]);

  const variant = product?.variants.find((v) => v.id === variantId);
  const chosenAddons = product?.addons.filter((a) => addonIds.includes(a.id)) ?? [];
  const unitPrice = (variant?.price ?? 0) + chosenAddons.reduce((sum, a) => sum + a.price, 0);
  const total = unitPrice * qty;
  const canAdd = Boolean(product && variant && !product.soldOut && product.available);

  function toggleAddon(id: string, checked: boolean) {
    setAddonIds((prev) => (checked ? [...prev, id] : prev.filter((a) => a !== id)));
  }

  function handleAdd() {
    if (!product || !variant) return;
    addToCart({ productId: product.id, variantId: variant.id, quantity: qty, addonIds: [...addonIds] });
    toast.success(`${product.name} added to your cart`, {
      action: { label: "View cart", onClick: () => setCartOpen(true) },
    });
    closeProduct();
    setCartOpen(true);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || images.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    stepImage(delta < 0 ? 1 : -1);
  }

  const open = Boolean(product);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeProduct()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
        {product && (
          <div className="grid md:grid-cols-2">
            {/* Gallery */}
            <div className="relative">
              <div
                className="relative aspect-square w-full overflow-hidden bg-muted md:rounded-tl-2xl"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <AnimatePresence mode="sync" initial={false} custom={slideDirection}>
                  <motion.div
                    key={imgIndex}
                    custom={slideDirection}
                    initial={{ opacity: 0, x: reduced ? 0 : 44 * slideDirection, scale: reduced ? 1 : 1.02 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: reduced ? 0 : -44 * slideDirection }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
                    className="absolute inset-0"
                  >
                    <SafeImage
                      src={images[imgIndex] || undefined}
                      alt={`${productAlt(product)} — image ${imgIndex + 1} of ${Math.max(images.length, 1)}`}
                      className="h-full w-full"
                      sizes="(max-width: 768px) 100vw, 384px"
                    />
                  </motion.div>
                </AnimatePresence>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => stepImage(-1)}
                      className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-forest/40 text-cream backdrop-blur-sm transition-colors hover:bg-forest/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <ChevronLeft className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => stepImage(1)}
                      className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-forest/40 text-cream backdrop-blur-sm transition-colors hover:bg-forest/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={galleryPaused ? "Play image rotation" : "Pause image rotation"}
                      onClick={() => setGalleryPaused((p) => !p)}
                      className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-forest/40 text-cream backdrop-blur-sm transition-colors hover:bg-forest/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      {galleryPaused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                      {images.map((src, i) => (
                        <button
                          key={src + i}
                          type="button"
                          aria-label={`Go to image ${i + 1}`}
                          aria-current={i === imgIndex}
                          onClick={() => goToImage(i, i > imgIndex ? 1 : -1)}
                          className={cn(
                            "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                            i === imgIndex ? "w-5 bg-cream" : "w-1.5 bg-cream/50 hover:bg-cream/80"
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Details */}
            <motion.div
              key={`details-${product.id}`}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut", delay: reduced ? 0 : 0.08 }}
              className="flex flex-col gap-5 p-5 sm:p-6"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {product.categoryName && (
                    <Badge variant="secondary" className="rounded-full">
                      {product.categoryName}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1 rounded-full">
                    <Clock className="size-3" aria-hidden="true" />
                    {product.prepMinutes || product.prep} min
                  </Badge>
                  {(product.soldOut || !product.available) && (
                    <Badge className="border-transparent bg-destructive text-white">Sold out</Badge>
                  )}
                </div>
                <DialogTitle className="mt-2 font-display text-2xl font-bold leading-tight">
                  {product.name}
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </DialogDescription>
              </div>

              <Separator />

              {/* Variants */}
              {product.variants.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Choose an option</legend>
                  <RadioGroup value={variantId} onValueChange={setVariantId} className="grid gap-2">
                    {product.variants.map((v) => (
                      <Label
                        key={v.id}
                        htmlFor={`variant-${v.id}`}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                          variantId === v.id ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-border hover:border-forest/40",
                          !v.available && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <RadioGroupItem id={`variant-${v.id}`} value={v.id} disabled={!v.available} />
                          <span className="font-medium">{v.name}</span>
                        </span>
                        <span className="font-semibold text-forest">{formatMoney(v.price)}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}

              {/* Add-ons */}
              {product.addons.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Add extras</legend>
                  <div className="grid gap-2">
                    {product.addons.map((a) => (
                      <Label
                        key={a.id}
                        htmlFor={`addon-${a.id}`}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                          addonIds.includes(a.id) ? "border-gold bg-gold/10" : "border-border hover:border-gold/50",
                          !a.available && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Checkbox
                            id={`addon-${a.id}`}
                            checked={addonIds.includes(a.id)}
                            onCheckedChange={(checked) => toggleAddon(a.id, checked === true)}
                            disabled={!a.available}
                          />
                          <span className="font-medium">{a.name}</span>
                        </span>
                        <span className="font-semibold text-forest">+{formatMoney(a.price)}</span>
                      </Label>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Quantity + total */}
              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold">Quantity</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-11 rounded-full"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center text-base font-bold tabular-nums" aria-live="polite">
                      {qty}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-11 rounded-full"
                      onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                      disabled={qty >= MAX_QTY}
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className="min-h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90"
                >
                  {canAdd ? (
                    <>
                      <Check className="size-5" aria-hidden="true" />
                      Add to cart · {formatMoney(total)}
                    </>
                  ) : (
                    "Currently unavailable"
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
