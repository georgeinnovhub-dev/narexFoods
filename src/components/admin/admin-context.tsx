"use client";

/**
 * Admin context: permission helpers + toast-bound API with automatic
 * session-expiry handling (any 401 returns the user to the login screen
 * instead of leaving broken menus/tabs behind).
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/client";
import { useAppStore, type AdminModule } from "@/store/app-store";
import { errMessage } from "@/components/admin/admin-utils";

export type { AdminModule };

interface AdminContextValue {
  activeModule: AdminModule;
  setModule: (m: AdminModule) => void;
  can: (permission: string) => boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

/** True when an error carries an HTTP 401 status (expired/invalid session). */
function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && (err as { status?: unknown }).status === 401;
}

export function AdminProvider({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: string[];
}) {
  /* Module lives in the app store so /#/admin/<module> deep links stay in sync. */
  const activeModule = useAppStore((s) => s.adminModule);
  const setModule = useAppStore((s) => s.setAdminModule);
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);

  const value = useMemo(() => ({ activeModule, setModule, can }), [activeModule, setModule, can]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

/**
 * API helpers bound to error toasts.
 * - 401 → session expired: clears the stale staff session so the shell
 *   swaps to the login screen immediately (no more broken menus/tabs).
 * - 403 → friendly permission message.
 * Returns null on failure so callers can bail out of state updates.
 */
export function useAdminApi() {
  const get = useCallback(async <T,>(url: string): Promise<T | null> => {
    try {
      return await apiGet<T>(url);
    } catch (err) {
      if (isUnauthorized(err)) {
        useAppStore.getState().setStaff(null);
        toast.error("Your session has expired. Please sign in again.");
        return null;
      }
      toast.error(errMessage(err));
      return null;
    }
  }, []);

  const send = useCallback(
    async <T,>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T | null> => {
      try {
        return await apiSend<T>(url, method, body);
      } catch (err) {
        if (isUnauthorized(err)) {
          useAppStore.getState().setStaff(null);
          toast.error("Your session has expired. Please sign in again.");
          return null;
        }
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
        if (isUnauthorized(err)) {
          useAppStore.getState().setStaff(null);
          toast.error("Your session has expired. Please sign in again.");
          return null;
        }
        toast.error(errMessage(err));
        return null;
      }
    },
    []
  );

  return { get, send, mutate };
}
