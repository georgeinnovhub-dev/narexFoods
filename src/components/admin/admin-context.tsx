"use client";

/** Lightweight admin context: active module routing + permission helpers + toast-bound API. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/client";
import { errMessage } from "@/components/admin/admin-utils";

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

interface AdminContextValue {
  module: AdminModule;
  setModule: (m: AdminModule) => void;
  can: (permission: string) => boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  children,
  permissions,
  initialModule = "overview",
}: {
  children: ReactNode;
  permissions: string[];
  initialModule?: AdminModule;
}) {
  const [module, setModule] = useState<AdminModule>(initialModule);

  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);

  const value = useMemo(() => ({ module, setModule, can }), [module, can]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

/**
 * API helpers bound to error toasts (403 renders a friendly permission message).
 * Returns null on failure so callers can bail out of state updates.
 */
export function useAdminApi() {
  const get = useCallback(async <T,>(url: string): Promise<T | null> => {
    try {
      return await apiGet<T>(url);
    } catch (err) {
      toast.error(errMessage(err));
      return null;
    }
  }, []);

  const send = useCallback(
    async <T,>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T | null> => {
      try {
        return await apiSend<T>(url, method, body);
      } catch (err) {
        toast.error(errMessage(err));
        return null;
      }
    },
    []
  );

  const mutate = useCallback(
    /** Wraps a mutation with pending toast handling; returns null on failure. */
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        toast.error(errMessage(err));
        return null;
      }
    },
    []
  );

  return { get, send, mutate };
}
