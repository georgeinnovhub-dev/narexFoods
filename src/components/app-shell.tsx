"use client";

/**
 * NAREX Foods app shell — single visible route (SPA).
 * Mounts exactly ONE sonner Toaster so both storefront and admin share it,
 * and switches between the customer storefront and the staff portal.
 */

import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/store/app-store";
import { StorefrontApp } from "@/components/storefront/storefront-app";
import { AdminApp } from "@/components/admin/admin-app";

export function AppShell() {
  const view = useAppStore((s) => s.view);
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Toaster position="top-center" richColors closeButton />
      {view === "admin" ? <AdminApp /> : <StorefrontApp />}
    </div>
  );
}
