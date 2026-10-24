import { db } from "@/lib/db";

/**
 * Delivery zones (spec §7). Zone membership is matched on the confirmed
 * delivery area text — the customer always confirms the location first, then
 * the server resolves the applicable zone, fee and rules. Client values are
 * never trusted for fees.
 */

export interface ZoneRow {
  id: string;
  name: string;
  areas: string; // JSON string[]
  fee: number;
  minSubtotal: number;
  leadMinutes: number;
  requiresQuote: boolean;
  note: string;
  active: boolean;
  sortOrder: number;
}

export interface ResolvedZone {
  id: string;
  name: string;
  fee: number;
  minSubtotal: number;
  leadMinutes: number;
  requiresQuote: boolean;
  note: string;
}

function normalizeArea(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parse a zone's area list safely (never throws on bad admin data). */
export function parseZoneAreas(areas: string): string[] {
  try {
    const parsed = JSON.parse(areas);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

export async function getActiveZones(): Promise<ZoneRow[]> {
  return db.deliveryZone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

/**
 * Resolve the delivery zone for an address. Returns null when no configured
 * zone matches the address text — checkout must then refuse (manual quote
 * workflow), never silently charge a default fee.
 */
export async function resolveZoneForAddress(address: string): Promise<ZoneRow | null> {
  const zones = await getActiveZones();
  const normalized = normalizeArea(address);
  if (!normalized) return null;
  for (const zone of zones) {
    for (const area of parseZoneAreas(zone.areas)) {
      const token = normalizeArea(area);
      if (token && normalized.includes(token)) return zone;
    }
  }
  return null;
}

export function toResolvedZone(zone: ZoneRow): ResolvedZone {
  return {
    id: zone.id,
    name: zone.name,
    fee: zone.fee,
    minSubtotal: zone.minSubtotal,
    leadMinutes: zone.leadMinutes,
    requiresQuote: zone.requiresQuote,
    note: zone.note,
  };
}
