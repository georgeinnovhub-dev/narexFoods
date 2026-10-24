import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

/**
 * Real currency conversion (spec §10).
 *
 * - Base currency is ALWAYS GHS — all pricing, totals and charges stay in GHS.
 * - Rates come from a genuine provider (open.er-api.com, free, no key) via a
 *   replaceable adapter; nothing is invented locally.
 * - Rates are cached in the CurrencyRate table + memory and refreshed per the
 *   configured policy. On provider outage the last stored rates are served and
 *   flagged `stale` — GHS checkout is never blocked.
 * - Converted amounts are display ESTIMATES only; the charged amount is the
 *   GHS total, always preserved with the order.
 */

const PROVIDER = "open.er-api.com";
const FALLBACK_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface MemoryCache {
  at: number;
  payload: {
    base: "GHS";
    provider: string;
    fetchedAt: string;
    rates: Record<string, { rate: number; fetchedAt: string }>;
    stale: boolean;
  } | null;
}

const memory: MemoryCache = { at: 0, payload: null };

export interface RateSnapshot {
  code: string;
  rate: number;
  fetchedAt: Date;
  provider: string;
}

async function fetchFromProvider(codes: string[]): Promise<RateSnapshot[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://open.er-api.com/v6/latest/GHS`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== "success" || !data.rates) return null;
    const now = new Date();
    const snapshots: RateSnapshot[] = [];
    for (const code of codes) {
      const rate = data.rates[code];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        snapshots.push({ code, rate, fetchedAt: now, provider: PROVIDER });
      }
    }
    return snapshots.length > 0 ? snapshots : null;
  } catch {
    return null; // outage / sandbox offline — safe fallback below
  }
}

/** Get current rates for the configured codes, refreshing per policy. */
export async function getCurrencyRates(): Promise<{
  rates: Record<string, { rate: number; fetchedAt: string }>;
  fetchedAt: string;
  provider: string;
  stale: boolean;
}> {
  const settings = await getSettings();
  const codes = (settings.currency.codes || []).filter((c) => /^[A-Z]{3}$/.test(c));
  if (!settings.currency.enabled || codes.length === 0) {
    return { rates: {}, fetchedAt: new Date(0).toISOString(), provider: PROVIDER, stale: true };
  }

  // Memory cache (per hot-reload cycle)
  const ttlMs = Math.max(5, settings.currency.refreshMinutes) * 60 * 1000;
  if (memory.payload && Date.now() - memory.at < ttlMs) return memory.payload;

  const rows = await db.currencyRate.findMany({ where: { code: { in: codes } } });
  const newest = rows.reduce<Date | null>(
    (acc, r) => (!acc || r.fetchedAt > acc ? r.fetchedAt : acc),
    null
  );
  const fresh = newest && Date.now() - newest.getTime() < ttlMs;

  if (!fresh) {
    const snapshots = await fetchFromProvider(codes);
    if (snapshots) {
      for (const s of snapshots) {
        await db.currencyRate.upsert({
          where: { code: s.code },
          create: { code: s.code, rate: s.rate, provider: s.provider, fetchedAt: s.fetchedAt },
          update: { rate: s.rate, provider: s.provider, fetchedAt: s.fetchedAt },
        });
      }
    }
  }

  const finalRows = await db.currencyRate.findMany({ where: { code: { in: codes } } });
  const rates: Record<string, { rate: number; fetchedAt: string }> = {};
  for (const r of finalRows) {
    rates[r.code] = { rate: r.rate, fetchedAt: r.fetchedAt.toISOString() };
  }
  const fetchedAt =
    finalRows.reduce<Date | null>((acc, r) => (!acc || r.fetchedAt > acc ? r.fetchedAt : acc), null) ??
    new Date(0);
  const stale =
    finalRows.length < codes.length || Date.now() - fetchedAt.getTime() > FALLBACK_MAX_AGE_MS;

  const payload = {
    base: "GHS" as const,
    provider: finalRows[0]?.provider || PROVIDER,
    fetchedAt: fetchedAt.toISOString(),
    rates,
    stale,
  };
  memory.at = Date.now();
  memory.payload = payload;
  return payload;
}

/**
 * Convert a GHS pesewas amount for DISPLAY only. Applies the configured
 * display markup (never a real charge). Returns null when no usable rate.
 */
export function convertForDisplay(
  pesewas: number,
  code: string,
  rate: number,
  markupPercent: number
): number | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const markup = Math.max(0, Math.min(20, markupPercent || 0));
  const value = (pesewas / 100) * rate * (1 + markup / 100);
  return Math.round(value * 100) / 100;
}
