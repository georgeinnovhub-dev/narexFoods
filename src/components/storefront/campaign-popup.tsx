"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { apiSend } from "@/lib/client";
import { SafeImage } from "./storefront-lib";
import type { CampaignDTO } from "@/lib/types";

const OPEN_DELAY_MS = 1200;

export function CampaignPopup() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const navigate = useAppStore((s) => s.navigate);
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
    const url = active.ctaUrl;
    if (url && /^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
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
            {campaign.ctaLabel || "Order now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
