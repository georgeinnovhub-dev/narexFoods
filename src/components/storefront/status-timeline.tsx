"use client";

import { format } from "date-fns";
import {
  BellRing,
  Bike,
  Check,
  CheckCheck,
  ChefHat,
  Circle,
  ClipboardList,
  MessageSquare,
  ReceiptText,
  ShoppingBag,
  StickyNote,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderEventDTO } from "@/lib/types";

const EVENT_ICONS: Record<string, LucideIcon> = {
  created: ClipboardList,
  accepted: Check,
  preparing: ChefHat,
  ready: BellRing,
  collected: ShoppingBag,
  dispatched: Bike,
  completed: CheckCheck,
  cancelled: XCircle,
  rejected: XCircle,
  note: StickyNote,
  message: MessageSquare,
  whatsapp: ReceiptText,
};

function iconFor(type: string): LucideIcon {
  return EVENT_ICONS[type] ?? Circle;
}

function toneFor(type: string): string {
  if (type === "cancelled" || type === "rejected") return "bg-destructive text-white";
  if (type === "completed" || type === "collected" || type === "ready") return "bg-emerald-600 text-white";
  if (type === "preparing") return "bg-gold text-forest";
  if (type === "note" || type === "message") return "bg-muted text-muted-foreground";
  return "bg-forest text-cream";
}

/** Vertical, icon-led timeline of order events in chronological order. */
export function StatusTimeline({ events, className }: { events: OrderEventDTO[]; className?: string }) {
  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No status updates yet.</p>;
  }
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <ol className={cn("relative space-y-6 border-l border-border pl-6", className)}>
      {ordered.map((event) => {
        const Icon = iconFor(event.type);
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                "absolute -left-[34px] flex size-[26px] items-center justify-center rounded-full ring-4 ring-background",
                toneFor(event.type)
              )}
              aria-hidden="true"
            >
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-semibold leading-snug">{event.message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(event.createdAt), "EEE d MMM yyyy · HH:mm")}
              {event.actor ? ` · ${event.actor}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
