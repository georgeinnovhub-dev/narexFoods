"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppStore } from "@/store/app-store";
import { apiSend } from "@/lib/client";
import { useCurrency } from "./currency-context";
import { cartUnitPrice } from "./storefront-lib";
import type { CouponValidateResponse } from "@/lib/types";

export function CartSheet() {
  const open = useAppStore((s) => s.cartOpen);
  const setOpen = useAppStore((s) => s.setCartOpen);
  const cart = useAppStore((s) => s.cart);
  const setQuantity = useAppStore((s) => s.setQuantity);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const navigate = useAppStore((s) => s.navigate);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const { formatMoney } = useCurrency();

  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [coupon, setCoupon] = useState<CouponValidateResponse | null>(null);

  const lines = cart.map((item, index) => {
    const product = bootstrap?.products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const addons = product?.addons.filter((a) => item.addonIds.includes(a.id)) ?? [];
    return { item, index, product, variant, addons, unit: cartUnitPrice(product, item.variantId, item.addonIds) };
  });

  const subtotal = lines.reduce((sum, line) => (line.product ? sum + line.unit * line.item.quantity : sum), 0);
  const discount = coupon?.valid ? coupon.discount : 0;

  async function applyCoupon() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a coupon code first");
      return;
    }
    setApplying(true);
    try {
      const res = await apiSend<CouponValidateResponse>("/api/coupons/validate", "POST", {
        code: trimmed,
        items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, addonIds: [...i.addonIds] })),
        fulfillmentType: "pickup",
      });
      setCoupon(res);
      if (res.valid) {
        toast.success(res.message || `Coupon ${res.code ?? trimmed} applied`);
      } else {
        toast.error(res.message || "That coupon is not valid");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not validate coupon");
    } finally {
      setApplying(false);
    }
  }

  function checkout() {
    setOpen(false);
    navigate("checkout");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-cream sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="font-display text-xl text-forest">Your Cart</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {cart.length > 0 ? `${cart.reduce((s, i) => s + i.quantity, 0)} item(s) ready to order` : "Fresh from our kitchen to you"}
          </SheetDescription>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="size-10 text-muted-foreground/50" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Your cart is empty</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add something delicious from our menu.</p>
            </div>
            <Button
              onClick={() => {
                setOpen(false);
                navigate("menu");
              }}
              className="min-h-11 rounded-full bg-forest px-6 text-cream hover:bg-forest/90"
            >
              Browse the menu
            </Button>
          </div>
        ) : (
          <>
            {/* Line items */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
              {lines.map(({ item, index, product, variant, addons, unit }) => (
                <div key={`${item.productId}-${item.variantId}-${index}`} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {product?.name ?? "Unavailable item"}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {variant ? variant.name : "—"}
                        {addons.length > 0 && ` · ${addons.map((a) => a.name).join(", ")}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(unit)} each
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeFromCart(index)}
                      aria-label={`Remove ${product?.name ?? "item"} from cart`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-full"
                        onClick={() => setQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-full"
                        onClick={() => setQuantity(index, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="text-sm font-bold text-forest">{formatMoney(unit * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-4 border-t border-border bg-card px-4 py-4">
              {/* Coupon */}
              {coupon?.valid ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5">
                  <p className="flex min-w-0 items-center gap-2 text-sm text-forest">
                    <Tag className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate font-semibold">{coupon.code ?? code.toUpperCase()}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCode("");
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
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    className="min-h-11 rounded-xl uppercase placeholder:normal-case"
                    onKeyDown={(e) => e.key === "Enter" && void applyCoupon()}
                  />
                  <Button
                    variant="outline"
                    onClick={() => void applyCoupon()}
                    disabled={applying}
                    className="min-h-11 shrink-0 rounded-xl border-forest/30 px-4 font-semibold text-forest hover:bg-forest hover:text-cream"
                  >
                    {applying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Apply"}
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
                <p className="text-xs text-muted-foreground">Delivery fee is calculated at checkout.</p>
                <Separator className="my-2" />
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Estimated total</span>
                  <span className="font-display font-bold text-forest">{formatMoney(Math.max(0, subtotal - discount))}</span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={checkout}
                className="min-h-12 w-full gap-2 rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest/90"
              >
                Proceed to checkout
                <ArrowRight className="size-5" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
