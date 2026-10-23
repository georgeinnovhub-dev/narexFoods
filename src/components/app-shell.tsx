"use client";

/**
 * NAREX Foods app shell — single visible route (SPA webapp).
 * - Mounts exactly ONE sonner Toaster shared by storefront + admin.
 * - Boots /#/ hash deep links (e.g. /#/admin/orders, /#/menu?category=x).
 * - Rehydrates the persisted cart AFTER first paint (prevents SSR hydration mismatch).
 * - Registers the PWA service worker.
 */

import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/store/app-store";
import { parseHash } from "@/lib/hash";
import { StorefrontApp } from "@/components/storefront/storefront-app";
import { AdminApp } from "@/components/admin/admin-app";

export function AppShell() {
  const view = useAppStore((s) => s.view);

  /* Hash deep links + browser back/forward + cart rehydration + service worker. */
  useEffect(() => {
    const applyHash = () => {
      const parsed = parseHash(window.location.hash);
      const state = useAppStore.getState();
      if (parsed.view && parsed.view !== state.view) {
        useAppStore.setState({ view: parsed.view, params: parsed.params });
        window.scrollTo({ top: 0 });
      } else if (parsed.view) {
        useAppStore.setState({ params: parsed.params });
      }
      if (parsed.adminModule && parsed.adminModule !== state.adminModule) {
        useAppStore.setState({ adminModule: parsed.adminModule });
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    void useAppStore.persist.rehydrate();

    const swTimer = setTimeout(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    }, 2000);

    return () => {
      window.removeEventListener("hashchange", applyHash);
      clearTimeout(swTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Toaster position="top-center" richColors closeButton />
      {view === "admin" ? <AdminApp /> : <StorefrontApp />}
    </div>
  );
}
