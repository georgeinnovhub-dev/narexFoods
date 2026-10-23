"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, Menu as MenuIcon, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore, type View } from "@/store/app-store";
import { cn } from "@/lib/utils";

const NAV_LINKS: { view: View; label: string }[] = [
  { view: "home", label: "Home" },
  { view: "menu", label: "Menu" },
  { view: "services", label: "Services" },
  { view: "eatntour", label: "Eat & Tour" },
  { view: "track", label: "Track Order" },
];

const MOBILE_LINKS: { view: View; label: string }[] = [
  { view: "home", label: "Home" },
  { view: "menu", label: "Full Menu" },
  { view: "services", label: "Services" },
  { view: "parlays", label: "Parlays & Hangouts" },
  { view: "eatntour", label: "Eat & Tour" },
  { view: "track", label: "Track Order" },
];

export function SiteHeader() {
  const navigate = useAppStore((s) => s.navigate);
  const view = useAppStore((s) => s.view);
  const cart = useAppStore((s) => s.cart);
  const setCartOpen = useAppStore((s) => s.setCartOpen);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const [mobileOpen, setMobileOpen] = useState(false);

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const brandName = bootstrap?.settings.brand.name ?? "NAREX Foods";
  const tagline = bootstrap?.settings.brand.tagline ?? "Good Food. Great Taste. Made with Care.";

  function go(target: View) {
    setMobileOpen(false);
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-cream/85 backdrop-blur-md supports-[backdrop-filter]:bg-cream/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        {/* Brand */}
        <button
          type="button"
          onClick={() => go("home")}
          className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${brandName} — go to home`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest text-cream shadow-sm">
            <UtensilsCrossed className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-bold leading-tight text-forest">
              {brandName}
            </span>
            <span className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
              {tagline}
            </span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.view}
              type="button"
              onClick={() => go(link.view)}
              aria-current={view === link.view ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === link.view
                  ? "bg-forest text-cream"
                  : "text-foreground/80 hover:bg-forest/10 hover:text-forest"
              )}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("admin")}
            className="hidden h-10 gap-1.5 px-3 text-forest hover:bg-forest/10 hover:text-forest lg:inline-flex"
          >
            <LogIn className="size-4" aria-hidden="true" />
            Staff Portal
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label={`Open cart${count > 0 ? ` (${count} item${count === 1 ? "" : "s"})` : ""}`}
            onClick={() => setCartOpen(true)}
            className="relative size-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 1.4, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center"
                >
                  <Badge className="min-w-5 justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-forest">
                    {count > 99 ? "99+" : count}
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream lg:hidden"
                aria-label="Open navigation menu"
              >
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-cream">
              <SheetHeader>
                <SheetTitle className="font-display text-forest">Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="mt-2 flex flex-col gap-1 px-4">
                {MOBILE_LINKS.map((link) => (
                  <button
                    key={link.view}
                    type="button"
                    onClick={() => go(link.view)}
                    aria-current={view === link.view ? "page" : undefined}
                    className={cn(
                      "rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors",
                      view === link.view ? "bg-forest text-cream" : "hover:bg-forest/10 text-foreground"
                    )}
                  >
                    {link.label}
                  </button>
                ))}
                <div className="my-2 border-t border-border" />
                <button
                  type="button"
                  onClick={() => go("admin")}
                  className="rounded-xl px-4 py-3 text-left text-sm font-medium text-forest hover:bg-forest/10"
                >
                  Staff Portal
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
