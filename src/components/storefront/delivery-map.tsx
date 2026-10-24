"use client";

/**
 * Pinned preview map for checkout delivery.
 * - Shows the NAREX kitchen pin by default (OpenStreetMap embed — no API key).
 * - As the customer types their address, it geocodes (Nominatim, debounced)
 *   and moves the pin to the best match; falls back gracefully offline.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, ExternalLink, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** NAREX kitchen — Mampong-Akuapem, Eastern Region, Ghana. */
const STORE_PIN = { lat: 5.9411, lon: -0.2064, label: "NAREX kitchen · Mampong-Akuapem" };

interface Pin {
  lat: number;
  lon: number;
  label: string;
}

type MapStatus = "idle" | "locating" | "found" | "approx";

function osmEmbedUrl(pin: Pin): string {
  const dLat = 0.012;
  const dLon = 0.016;
  const bbox = [pin.lon - dLon, pin.lat - dLat, pin.lon + dLon, pin.lat + dLat]
    .map((n) => n.toFixed(5))
    .join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pin.lat.toFixed(5)}%2C${pin.lon.toFixed(5)}`;
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function DeliveryMapCard({
  address,
  areas,
  onLocationResolved,
}: {
  address: string;
  areas: string[];
  /** Optional callback with geocoded coordinates (null when unresolved/reset). */
  onLocationResolved?: (coords: { lat: string; lng: string } | null) => void;
}) {
  const [pin, setPin] = useState<Pin | null>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const resolvedRef = useRef(onLocationResolved);
  useEffect(() => {
    resolvedRef.current = onLocationResolved;
  }, [onLocationResolved]);

  /* Render-phase adjustment: short/empty address always resets to the kitchen pin. */
  const query = address.trim();
  const shortQuery = query.length < 6;
  const [resetApplied, setResetApplied] = useState(false);
  if (shortQuery && !resetApplied) {
    setResetApplied(true);
    setPin(null);
    setStatus("idle");
  } else if (!shortQuery && resetApplied) {
    setResetApplied(false);
  }

  /* Debounced geocode of the typed address (best-effort, silently offline-safe). */
  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed.length < 6) {
      resolvedRef.current?.(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setStatus("locating");
      (async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=${encodeURIComponent(`${trimmed}, Ghana`)}`,
            { headers: { Accept: "application/json" } }
          );
          const data: unknown = await res.json();
          if (cancelled) return;
          if (Array.isArray(data) && data.length > 0) {
            const hit = data[0] as { lat?: string; lon?: string; display_name?: string };
            const lat = parseFloat(hit.lat ?? "");
            const lon = parseFloat(hit.lon ?? "");
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              setPin({ lat, lon, label: hit.display_name ?? trimmed });
              setStatus("found");
              resolvedRef.current?.({ lat: String(lat), lng: String(lon) });
              return;
            }
          }
          setPin(null);
          setStatus("approx");
          resolvedRef.current?.(null);
        } catch {
          if (!cancelled) {
            setPin(null);
            setStatus("approx");
            resolvedRef.current?.(null);
          }
        }
      })();
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address]);

  const active = pin ?? STORE_PIN;
  const src = useMemo(() => osmEmbedUrl(active), [active]);
  const mapsQuery = pin ? pin.label : `${STORE_PIN.label}, Ghana`;

  const caption =
    status === "found"
      ? "Pin dropped on your address — our rider will follow this route."
      : status === "locating"
        ? "Finding your address on the map…"
        : status === "approx"
          ? "We couldn't pin that address exactly — drop a landmark in the note and we'll call to confirm."
          : "Our kitchen pin. Type your address above and we'll pin your door.";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] w-full bg-forest/5">
        <iframe
          key={src}
          src={src}
          title="Delivery map preview"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
        {/* Branded pin overlay — stays legible even while tiles load */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="relative flex size-10 items-center justify-center">
            <span
              aria-hidden="true"
              className={cn(
                "absolute inline-flex h-full w-full rounded-full bg-gold/40",
                status === "locating" ? "animate-ping" : "animate-pulse"
              )}
            />
            <span className="relative flex size-9 items-center justify-center rounded-full border-2 border-cream bg-gold shadow-lg">
              {status === "locating" ? (
                <Loader2 className="size-4 animate-spin text-forest" aria-hidden="true" />
              ) : (
                <MapPin className="size-4 text-forest" aria-hidden="true" />
              )}
            </span>
          </span>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Compass className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
          <span aria-live="polite">{caption}</span>
        </p>
        {areas.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {areas.map((area) => (
              <li key={area}>
                <Badge variant="outline" className="rounded-full border-forest/30 text-forest">
                  <MapPin className="mr-1 size-3" aria-hidden="true" />
                  {area}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <a
          href={mapsSearchUrl(mapsQuery)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded text-xs font-semibold text-forest underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
