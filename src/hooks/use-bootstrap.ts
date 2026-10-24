"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import type { BootstrapResponse } from "@/lib/types";

/** Fetches storefront data once; exposes it from the shared store. */
export function useBootstrapData() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setBootstrap = useAppStore((s) => s.setBootstrap);
  const [loading, setLoading] = useState(!bootstrap);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<BootstrapResponse>("/api/bootstrap");
      setBootstrap(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load menu");
    } finally {
      setLoading(false);
    }
  }, [setBootstrap]);

  useEffect(() => {
    if (bootstrap) return;
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [bootstrap, refresh]);

  return { bootstrap, loading, error, refresh };
}
