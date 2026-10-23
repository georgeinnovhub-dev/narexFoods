"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BootstrapResponse, OrderDTO } from "@/lib/types";
import { buildHash, type HashView } from "@/lib/hash";

export type View = HashView;

export type AdminModule =
  | "overview"
  | "orders"
  | "menu"
  | "payments"
  | "staff"
  | "dispatch"
  | "marketing"
  | "content"
  | "reports"
  | "system";

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  addonIds: string[];
}

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AppState {
  // View routing (single-page webapp with /#/ deep links)
  view: View;
  params: Record<string, string>;
  navigate: (view: View, params?: Record<string, string>) => void;

  // Admin module routing (synced to /#/admin/<module>)
  adminModule: AdminModule;
  setAdminModule: (m: AdminModule) => void;

  // Cart (variant-aware, persisted)
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  setQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  cartCount: () => number;

  // UI state
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  productModalId: string | null;
  openProduct: (id: string) => void;
  closeProduct: () => void;

  // Data
  bootstrap: BootstrapResponse | null;
  setBootstrap: (b: BootstrapResponse) => void;
  lastOrder: { order: OrderDTO; whatsappUrl: string } | null;
  setLastOrder: (o: { order: OrderDTO; whatsappUrl: string } | null) => void;

  // Staff session (admin)
  staff: StaffSession | null;
  setStaff: (s: StaffSession | null) => void;
}

/**
 * skipHydration is critical: the cart is persisted to localStorage, so the
 * client must NOT rehydrate during the first render — otherwise a persisted
 * cart badge shifts the DOM and breaks React 19 SSR hydration (Radix
 * aria-controls mismatch). We call `useAppStore.persist.rehydrate()` in an
 * effect after mount instead.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: "home",
      params: {},
      navigate: (view, params = {}) => {
        set({ view, params });
        if (typeof window !== "undefined") {
          window.history.pushState(null, "", buildHash(view, params));
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }
      },

      adminModule: "overview",
      setAdminModule: (m) => {
        set({ adminModule: m });
        if (typeof window !== "undefined" && useAppStore.getState().view === "admin") {
          const target = `#/admin/${m}`;
          if (window.location.hash !== target) {
            window.history.pushState(null, "", target);
          }
        }
      },

      cart: [],
      addToCart: (item) => {
        const cart = [...get().cart];
        const idx = cart.findIndex(
          (c) => c.productId === item.productId && c.variantId === item.variantId &&
            JSON.stringify([...c.addonIds].sort()) === JSON.stringify([...item.addonIds].sort())
        );
        if (idx >= 0) {
          cart[idx] = { ...cart[idx], quantity: Math.min(50, cart[idx].quantity + item.quantity) };
        } else {
          cart.push(item);
        }
        set({ cart });
      },
      removeFromCart: (index) => set({ cart: get().cart.filter((_, i) => i !== index) }),
      setQuantity: (index, quantity) => {
        const cart = [...get().cart];
        if (cart[index]) {
          cart[index] = { ...cart[index], quantity: Math.max(1, Math.min(50, quantity)) };
          set({ cart });
        }
      },
      clearCart: () => set({ cart: [] }),
      cartCount: () => get().cart.reduce((s, i) => s + i.quantity, 0),

      cartOpen: false,
      setCartOpen: (open) => set({ cartOpen: open }),
      productModalId: null,
      openProduct: (id) => set({ productModalId: id }),
      closeProduct: () => set({ productModalId: null }),

      bootstrap: null,
      setBootstrap: (b) => set({ bootstrap: b }),
      lastOrder: null,
      setLastOrder: (o) => set({ lastOrder: o }),

      staff: null,
      setStaff: (s) => set({ staff: s }),
    }),
    {
      name: "narex-cart",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }) as unknown as AppState,
    }
  )
);
