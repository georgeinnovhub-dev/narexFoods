"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore, type View } from "@/store/app-store";
import { SafeImage, usePrefersReducedMotion, type HeroSlide } from "./storefront-lib";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_MS = 6000;

function isKnownView(action: string): action is View {
  return action === "home" || action === "menu" || action === "checkout" || action === "success" || action === "track";
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const navigate = useAppStore((s) => s.navigate);
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const goTo = useCallback(
    (i: number) => {
      if (count === 0) return;
      setIndex(((i % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (reduced || paused || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [reduced, paused, count]);

  function handleCta(action: string) {
    navigate(isKnownView(action) ? action : "menu");
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(index + (delta < 0 ? 1 : -1));
  }

  if (count === 0) return null;

  const slide = slides[Math.min(index, count - 1)];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      className="relative h-[58vh] min-h-[420px] max-h-[640px] w-full overflow-hidden bg-forest"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <AnimatePresence mode="sync">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: "easeOut" }}
          className="absolute inset-0"
          aria-hidden={false}
        >
          <SafeImage
            src={slide.image || undefined}
            alt={slide.title}
            className="h-full w-full"
            sizes="100vw"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/95 via-forest/45 to-forest/10" aria-hidden="true" />
        </motion.div>
      </AnimatePresence>

      {/* Copy */}
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 sm:pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${index}`}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: reduced ? 0 : 0.5, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">NAREX Foods</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-cream sm:text-5xl">
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream/85 sm:text-base">{slide.subtitle}</p>
              )}
              <Button
                size="lg"
                onClick={() => handleCta(slide.ctaAction)}
                className="mt-6 min-h-11 rounded-full bg-gold px-6 text-sm font-semibold text-forest shadow-md transition-colors hover:bg-gold/90 hover:text-forest"
              >
                {slide.ctaLabel || "Order now"}
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      {count > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous slide"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 size-11 -translate-y-1/2 rounded-full border-cream/30 bg-forest/30 text-cream backdrop-blur-sm hover:bg-forest/60 hover:text-cream"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next slide"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full border-cream/30 bg-forest/30 text-cream backdrop-blur-sm hover:bg-forest/60 hover:text-cream"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>

          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play carousel" : "Pause carousel"}
              className="flex size-9 items-center justify-center rounded-full border border-cream/30 bg-forest/30 text-cream backdrop-blur-sm transition-colors hover:bg-forest/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose slide">
              {slides.map((s, i) => (
                <button
                  key={s.title + i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}: ${s.title}`}
                  onClick={() => goTo(i)}
                  className={cn(
                    "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                    i === index ? "w-6 bg-gold" : "w-2 bg-cream/50 hover:bg-cream/80"
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
