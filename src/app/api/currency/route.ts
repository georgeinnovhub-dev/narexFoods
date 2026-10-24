import { ok, safeErrorLog } from "@/lib/api";
import { getCurrencyRates } from "@/lib/currency";
import type { CurrencyRatesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/currency — public rates for DISPLAY estimates only.
 * The charged currency at checkout is always GHS (spec §10).
 */
export async function GET() {
  try {
    const data = await getCurrencyRates();
    const response: CurrencyRatesResponse = {
      base: "GHS",
      provider: data.provider,
      fetchedAt: data.fetchedAt,
      rates: data.rates,
      stale: data.stale,
    };
    return ok(response);
  } catch (err) {
    safeErrorLog("currency.GET", err);
    return ok({ base: "GHS", provider: "", fetchedAt: new Date(0).toISOString(), rates: {}, stale: true });
  }
}
