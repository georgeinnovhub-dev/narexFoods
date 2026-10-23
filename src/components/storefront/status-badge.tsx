"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status → label / colour mapping.
 * Palette is amber / stone / forest / emerald — deliberately no blue or indigo.
 */

interface StatusStyle {
  label: string;
  className: string;
}

const ORDER_STYLES: Record<string, StatusStyle> = {
  created: { label: "Placed", className: "bg-secondary text-secondary-foreground border-transparent" },
  accepted: { label: "Accepted", className: "bg-forest text-cream border-transparent" },
  preparing: { label: "Preparing", className: "bg-gold text-forest border-transparent" },
  ready: { label: "Ready", className: "bg-emerald-600 text-white border-transparent" },
  collected: { label: "Collected", className: "bg-forest text-cream border-transparent" },
  dispatched: { label: "Out for delivery", className: "bg-forest text-cream border-transparent" },
  completed: { label: "Completed", className: "bg-emerald-600 text-white border-transparent" },
  cancelled: { label: "Cancelled", className: "bg-destructive text-white border-transparent" },
  rejected: { label: "Rejected", className: "bg-destructive text-white border-transparent" },
};

const PAYMENT_STYLES: Record<string, StatusStyle> = {
  paid: { label: "Paid", className: "bg-emerald-600 text-white border-transparent" },
  unpaid: { label: "Unpaid", className: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
  awaiting_review: { label: "Awaiting review", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  failed: { label: "Failed", className: "bg-destructive text-white border-transparent" },
};

function humanize(status: string): string {
  return status
    .split(/[_\s-]+/)
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function statusLabel(status: string, kind: "order" | "payment" = "order"): string {
  const map = kind === "payment" ? PAYMENT_STYLES : ORDER_STYLES;
  return map[status]?.label ?? humanize(status);
}

export function StatusBadge({
  status,
  kind = "order",
  className,
}: {
  status: string;
  kind?: "order" | "payment";
  className?: string;
}) {
  const map = kind === "payment" ? PAYMENT_STYLES : ORDER_STYLES;
  const style = map[status];
  return (
    <Badge
      className={cn(
        "px-2.5 py-1 text-xs font-semibold",
        style?.className ?? "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {statusLabel(status, kind)}
    </Badge>
  );
}
