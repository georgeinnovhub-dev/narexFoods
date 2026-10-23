"use client";

import { motion } from "framer-motion";
import { Clock, Flame, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatGHS } from "@/lib/client";
import { lowestVariantPrice, productAlt, SafeImage } from "./storefront-lib";
import type { ProductDTO } from "@/lib/types";

export function ProductCard({ product }: { product: ProductDTO }) {
  const openProduct = useAppStore((s) => s.openProduct);
  const addToCart = useAppStore((s) => s.addToCart);
  const setCartOpen = useAppStore((s) => s.setCartOpen);

  const soldOut = product.soldOut || !product.available;
  const fromPrice = lowestVariantPrice(product);
  const soleVariant = product.variants.length === 1 ? product.variants[0] : undefined;
  const canQuickAdd =
    !soldOut && Boolean(soleVariant?.available) && product.variants.length === 1 && product.addons.length === 0;

  function quickAdd() {
    if (!soleVariant) return;
    addToCart({ productId: product.id, variantId: soleVariant.id, quantity: 1, addonIds: [] });
    toast.success(`${product.name} added to your cart`, {
      action: { label: "View cart", onClick: () => setCartOpen(true) },
    });
  }

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md focus-within:shadow-md"
    >
      {/* Image */}
      <button
        type="button"
        onClick={() => openProduct(product.id)}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`View details for ${product.name}`}
        aria-disabled={soldOut}
      >
        <SafeImage
          src={product.images[0] || undefined}
          alt={productAlt(product)}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.featured && !soldOut && (
            <Badge className="gap-1 border-transparent bg-gold text-forest">
              <Star className="size-3 fill-forest" aria-hidden="true" />
              Featured
            </Badge>
          )}
          {product.bestSeller && !soldOut && (
            <Badge className="gap-1 border-transparent bg-forest text-cream">
              <Flame className="size-3" aria-hidden="true" />
              Best seller
            </Badge>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-forest/60 backdrop-blur-[2px]">
            <span className="rounded-full border border-cream/40 bg-forest/70 px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-widest text-cream">
              Sold out
            </span>
          </div>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug">{product.name}</h3>
          {fromPrice !== null && (
            <p className="shrink-0 text-sm font-bold text-forest">
              {product.variants.length > 1 && <span className="mr-0.5 text-xs font-medium text-muted-foreground">from </span>}
              {formatGHS(fromPrice)}
            </p>
          )}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {product.categoryName && <span className="rounded-full bg-muted px-2 py-0.5">{product.categoryName}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {product.prepMinutes || product.prep} min
          </span>
        </p>
        {product.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        )}

        <div className="mt-auto pt-3">
          {soldOut ? (
            <Button disabled variant="secondary" className="w-full min-h-11 rounded-xl">
              Sold out
            </Button>
          ) : canQuickAdd ? (
            <Button
              onClick={quickAdd}
              className="w-full min-h-11 gap-1.5 rounded-xl bg-forest text-cream hover:bg-forest/90"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add to cart
            </Button>
          ) : (
            <Button
              onClick={() => openProduct(product.id)}
              className="w-full min-h-11 rounded-xl bg-forest text-cream hover:bg-forest/90"
            >
              Customize &amp; Order
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
