"use client";

/**
 * Eat & Tour promo popup — first-party ad for the Eat & Tour experience.
 * Opens once per session a few seconds after the page settles, tracks a
 * fire-and-forget campaign event when the campaign exists, and its CTA
 * links to the EXACT Eat & Tour page.
 */

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { apiSend } from "@/lib/client";
import { SafeImage } from "./storefront-lib";

const PROMO_DELAY_MS = 7000;
const DISMISS_KEY = "narex-eatntour-promo-dismissed";

export function EatntourPromo() {
  const navigate = useAppStore((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (shown) return;
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    const timer = setTimeout(() => {
      setShown(true);
      setOpen(true);
    }, PROMO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  const persistDismissal = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — ignore */
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && !interactedRef.current) persistDismissal();
  };

  const handleCta = () => {
    interactedRef.current = true;
    persistDismissal();
    setOpen(false);
    navigate("eatntour");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-md [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-forest">
          <SafeImage
            src="/images/eatntour-hero.png"
            alt="NAREX Foods Eat & Tour tasting table on the Akuapem ridges"
            className="h-full w-full"
            sizes="448px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/70 via-transparent to-transparent" aria-hidden="true" />
          <Badge className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-forest">
            New experience
          </Badge>
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <DialogTitle className="font-display text-xl font-bold text-forest">
            Eat &amp; Tour is here — come taste the Akuapem ridges.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            A guided food trail with four tasting stops, real kitchen stories and plates you&apos;ll
            brag about. Seats are small-group and they go fast.
          </DialogDescription>
          <Button
            size="lg"
            onClick={handleCta}
            className="min-h-11 w-full rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
          >
            See the Eat &amp; Tour trail
          </Button>
          <p className="text-center text-[11px] text-muted-foreground/70">
            Shown once — you won&apos;t see this again this session.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
