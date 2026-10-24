"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { useBootstrapData } from "@/hooks/use-bootstrap";
import { BootstrapSkeleton } from "./storefront-lib";
import { SiteHeader } from "./header";
import { SiteFooter } from "./footer";
import { HomeView } from "./home-view";
import { MenuView } from "./menu-view";
import { ServicesView } from "./services-view";
import { ParlaysView } from "./parlays-view";
import { EatntourView } from "./eatntour-view";
import { CheckoutView } from "./checkout-view";
import { SuccessView } from "./success-view";
import { TrackView } from "./track-view";
import { CartSheet } from "./cart-sheet";
import { ProductModal } from "./product-modal";
import { CampaignPopup } from "./campaign-popup";
import { EatntourPromo } from "./eatntour-promo";
import { CurrencyProvider } from "./currency-context";
import { AccountView } from "./account-view";
import { BlogView } from "./blog-view";
import { DeliveryInfoView, PrivacyView, TermsView } from "./info-views";

export function StorefrontApp() {
  const view = useAppStore((s) => s.view);
  const { bootstrap, loading, error, refresh } = useBootstrapData();

  /* The admin portal is rendered by the app shell, not the storefront. */
  if (view === "admin") return null;

  function renderBody() {
    const needsBootstrap =
      view === "home" ||
      view === "menu" ||
      view === "checkout" ||
      view === "services" ||
      view === "parlays" ||
      view === "eatntour";
    if (needsBootstrap && loading && !bootstrap) return <BootstrapSkeleton />;
    if (needsBootstrap && !bootstrap) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
          <AlertCircle className="size-10 text-destructive" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold text-forest">We couldn&apos;t load the kitchen</h2>
          <p className="text-sm text-muted-foreground">
            {error ?? "Something went wrong while loading the menu. Please try again."}
          </p>
          <Button
            onClick={() => void refresh()}
            className="min-h-11 rounded-full bg-forest px-6 font-semibold text-cream hover:bg-forest/90"
          >
            Try again
          </Button>
        </div>
      );
    }
    switch (view) {
      case "home":
        return <HomeView />;
      case "menu":
        return <MenuView />;
      case "services":
        return <ServicesView />;
      case "parlays":
        return <ParlaysView />;
      case "eatntour":
        return <EatntourView />;
      case "checkout":
        return <CheckoutView />;
      case "success":
        return <SuccessView />;
      case "track":
        return <TrackView />;
      case "account":
        return <AccountView />;
      case "blog":
        return <BlogView />;
      case "privacy":
        return <PrivacyView />;
      case "terms":
        return <TermsView />;
      case "delivery-info":
        return <DeliveryInfoView />;
      default:
        return null;
    }
  }

  return (
    <CurrencyProvider>
      <div className="flex w-full flex-1 flex-col bg-cream">
        <a
          href="#storefront-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="storefront-main" className="flex-1">
          {renderBody()}
        </main>
        <SiteFooter className="mt-auto" />
        <CartSheet />
        <ProductModal />
        <CampaignPopup />
        <EatntourPromo />
      </div>
    </CurrencyProvider>
  );
}
