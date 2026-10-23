"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BootstrapResponse, OrderDTO } from "@/lib/types";

export type View = "home" | "menu" | "checkout" | "success" | "track" | "admin";

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
  // View routing (single-page app)
  view: View;
  params: Record<string, string>;
  navigate: (view: View, params?: Record<string, string>) => void;

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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: "home",
      params: {},
      navigate: (view, params = {}) => {
        set({ view, params });
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }) as unknown as AppState,
    }
  )
);
