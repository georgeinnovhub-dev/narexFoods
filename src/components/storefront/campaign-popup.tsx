"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { parseHash } from "@/lib/hash";
import { apiSend } from "@/lib/client";
import { SafeImage } from "./storefront-lib";
import type { CampaignDTO } from "@/lib/types";

const OPEN_DELAY_MS = 1200;

/* Meal-time targeting (spec §13) — computed after mount, so a mismatched
   popup simply never opens for the rest of the session. */
function mealTimeActive(mt: CampaignDTO["mealTime"]): boolean {
  if (mt === "any") return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mt === "breakfast") return mins >= 6 * 60 && mins <= 10 * 60 + 30; // 06:00–10:30
  if (mt === "lunch") return mins >= 11 * 60 + 30 && mins <= 14 * 60 + 30; // 11:30–14:30
  return mins >= 17 * 60 && mins <= 21 * 60; // supper 17:00–21:00
}

export function CampaignPopup() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
  const openProduct = useAppStore((s) => s.openProduct);
  const campaign = useMemo<CampaignDTO | null>(
    () => (bootstrap?.campaigns ?? []).find((c) => c.placement === "popup") ?? null,
    [bootstrap]
  );
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (!campaign || shown) return;
    let dismissed = false;
    if (campaign.showOnce) {
      try {
        dismissed = window.sessionStorage.getItem(`narex-popup-dismissed-${campaign.id}`) === "1";
      } catch {
        dismissed = false;
      }
    }
    if (dismissed) return;
    const timer = setTimeout(() => {
      if (!mealTimeActive(campaign.mealTime)) return;
      setShown(true);
      setOpen(true);
      void apiSend(`/api/campaigns/${encodeURIComponent(campaign.id)}/event`, "POST", { type: "impression" }).catch(
        () => undefined
      );
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [campaign, shown]);

  if (!campaign) return null;

  const active: CampaignDTO = campaign;
  /* Exact-meal campaigns (spec §13): open that exact dish with correct variant pricing. */
  const exactProduct = active.productId
    ? (bootstrap?.products.find((p) => p.id === active.productId) ?? null)
    : null;

  const persistDismissal = () => {
    if (!active.showOnce) return;
    try {
      window.sessionStorage.setItem(`narex-popup-dismissed-${active.id}`, "1");
    } catch {
      /* private mode — ignore */
    }
  };

  const track = (type: "click" | "dismissal") => {
    void apiSend(`/api/campaigns/${encodeURIComponent(active.id)}/event`, "POST", { type }).catch(() => undefined);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && open && !interactedRef.current) {
      track("dismissal");
      persistDismissal();
    }
    setOpen(next);
  };

  const handleCta = () => {
    interactedRef.current = true;
    track("click");
    persistDismissal();
    setOpen(false);
    if (exactProduct) {
      openProduct(exactProduct.id);
      return;
    }
    const url = active.ctaUrl;
    if (url && /^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (url && url.startsWith("#/")) {
      /* Internal deep link — e.g. "#/eatntour" or "#/menu?category=x" */
      const parsed = parseHash(url);
      navigate(parsed.view ?? "menu", parsed.params);
    } else {
      navigate("menu");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-md [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <SafeImage src={campaign.image ?? undefined} alt={campaign.title} className="h-full w-full" sizes="448px" />
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <DialogTitle className="font-display text-xl font-bold text-forest">{campaign.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {campaign.message}
          </DialogDescription>
          <Button
            size="lg"
            onClick={handleCta}
            className="min-h-11 w-full rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
          >
            {active.ctaLabel || (exactProduct ? "Open dish" : "Order now")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
