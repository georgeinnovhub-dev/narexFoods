"use client";

/**
 * Currency display context (spec §10) — the charged currency is ALWAYS GHS.
 * A second code is a display estimate only, rendered as
 * `GH₵x · ≈ $y (est.)` next to the primary GHS amount.
 *
 * Hydration safety: the persisted code is read via useSyncExternalStore so the
 * first (server + hydration) render always uses GHS, and the persisted choice
 * is applied right after mount — no setState-in-effect, no mismatch.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAppStore } from "@/store/app-store";
import { apiGet, formatGHS } from "@/lib/client";
import type { CurrencyRatesResponse } from "@/lib/types";

const STORAGE_KEY = "narex-currency";

/** Display symbols for supported estimate currencies. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  NGN: "₦",
  CAD: "C$",
};

const KNOWN_CODES = Object.keys(CURRENCY_SYMBOLS);

export interface CurrencyMeta {
  provider: string;
  fetchedAt: string;
  stale: boolean;
}

export interface CurrencyContextValue {
  /** Active display code — always "GHS" until mounted / when estimates are off. */
  code: string;
  setCode: (code: string) => void;
  /** code -> 1 GHS = rate CODE (null until fetched). */
  rates: Record<string, { rate: number; fetchedAt: string }> | null;
  meta: CurrencyMeta | null;
  /** True when the operator enabled display estimates. */
  enabled: boolean;
  /** Codes offered by the switcher (GHS first). */
  codes: string[];
  /** GHS-first money formatting with an optional `· ≈ x (est.)` suffix. */
  formatMoney: (pesewas: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/* localStorage is not reactive, but a read-once snapshot via
   useSyncExternalStore is the lint-sanctioned hydration-safe pattern. */
const subscribeStorage = () => () => {};

function readStoredCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const [code, setCodeState] = useState("GHS");
  const [rates, setRates] = useState<Record<string, { rate: number; fetchedAt: string }> | null>(null);
  const [meta, setMeta] = useState<CurrencyMeta | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  const persisted = useSyncExternalStore(subscribeStorage, readStoredCode, () => null);
  const currencySettings = bootstrap?.settings.currency;
  const enabled = currencySettings?.enabled ?? false;
  const allowedCodes = useMemo(() => {
    const fromSettings = (currencySettings?.codes ?? []).filter(
      (c) => c === "GHS" || KNOWN_CODES.includes(c)
    );
    return ["GHS", ...fromSettings.filter((c) => c !== "GHS")];
  }, [currencySettings]);

  /* Hydrate the persisted choice after mount (client snapshot only; SSR is null).
     setCode keeps localStorage and state in sync, so persisted ?? code is stable. */
  const effectiveCode = useMemo(() => {
    const persistedCode = persisted && (persisted === "GHS" || KNOWN_CODES.includes(persisted)) ? persisted : null;
    const requested = persistedCode ?? code;
    // If estimates are disabled or the code is no longer offered, GHS wins.
    if (requested !== "GHS" && (!enabled || !allowedCodes.includes(requested))) return "GHS";
    return requested;
  }, [persisted, code, enabled, allowedCodes]);

  /* Fetch rates once when a non-GHS code is in play (mounted state only). */
  useEffect(() => {
    if (effectiveCode === "GHS" || rates || fetchFailed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<CurrencyRatesResponse>("/api/currency");
        if (cancelled) return;
        setRates(res.rates);
        setMeta({ provider: res.provider, fetchedAt: res.fetchedAt, stale: res.stale });
      } catch {
        /* Estimates stay unavailable — formatMoney falls back to GHS-only. */
        if (!cancelled) setFetchFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveCode, rates, fetchFailed]);

  const setCode = useCallback((next: string) => {
    const valid = next === "GHS" || KNOWN_CODES.includes(next);
    const finalCode = valid ? next : "GHS";
    setCodeState(finalCode);
    /* Allow a fresh attempt if a previous fetch failed. */
    setFetchFailed(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, finalCode);
    } catch {
      /* private mode — session-only choice */
    }
  }, []);

  const formatMoney = useCallback(
    (pesewas: number): string => {
      const ghs = formatGHS(pesewas);
      if (effectiveCode === "GHS") return ghs;
      if (fetchFailed || !rates || !meta || meta.stale) return ghs;
      const rate = rates[effectiveCode]?.rate;
      if (!rate || !Number.isFinite(rate) || rate <= 0) return ghs;
      const converted = ((pesewas / 100) * rate).toFixed(2);
      return `${ghs} · ≈ ${CURRENCY_SYMBOLS[effectiveCode] ?? ""}${converted} (est.)`;
    },
    [effectiveCode, rates, meta, fetchFailed]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      code: effectiveCode,
      setCode,
      rates,
      meta,
      enabled,
      codes: allowedCodes,
      formatMoney,
    }),
    [effectiveCode, setCode, rates, meta, enabled, allowedCodes, formatMoney]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
