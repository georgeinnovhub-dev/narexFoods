"use client";

/** Shared building blocks for the NAREX admin dashboard. */

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { apiSend } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------- Brand palette (hex mirrors the brand token classes) ----------
export const BRAND = {
  forest: "#17362B",
  forestSoft: "#23503E",
  cream: "#FAF6EC",
  gold: "#C9A227",
  ink: "#1C1917",
} as const;

// ---------- Status metadata ----------
type Tone = "neutral" | "gold" | "green" | "solid-green" | "red" | "teal" | "orange" | "violet";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  gold: "bg-amber-100 text-amber-900 border-amber-300",
  green: "bg-green-100 text-green-900 border-green-300",
  "solid-green": "bg-green-700 text-white border-green-700",
  red: "bg-red-100 text-red-900 border-red-300",
  teal: "bg-teal-100 text-teal-900 border-teal-300",
  orange: "bg-orange-100 text-orange-900 border-orange-300",
  violet: "bg-violet-100 text-violet-900 border-violet-300",
};

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  created: { label: "New", tone: "gold" },
  accepted: { label: "Accepted", tone: "gold" },
  preparing: { label: "Preparing", tone: "gold" },
  ready: { label: "Ready", tone: "green" },
  collected: { label: "Collected", tone: "green" },
  dispatched: { label: "Dispatched", tone: "teal" },
  completed: { label: "Completed", tone: "solid-green" },
  cancelled: { label: "Cancelled", tone: "red" },
  rejected: { label: "Rejected", tone: "red" },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  pending_verification: { label: "Pending verification", tone: "gold" },
  paid: { label: "Paid", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  cancelled: { label: "Cancelled", tone: "red" },
  refunded: { label: "Refunded", tone: "orange" },
};

const PAYMENT_ATTEMPT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Initiated", tone: "neutral" },
  awaiting_review: { label: "Awaiting review", tone: "gold" },
  paid: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  failed: { label: "Failed", tone: "red" },
};

const DISPATCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  awaiting: { label: "Awaiting rider", tone: "neutral" },
  assigned: { label: "Assigned", tone: "gold" },
  accepted: { label: "Accepted", tone: "gold" },
  collected: { label: "Collected", tone: "violet" },
  out_for_delivery: { label: "Out for delivery", tone: "teal" },
  delivered: { label: "Delivered", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  returned: { label: "Returned", tone: "orange" },
};

const STAFF_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  pending: { label: "Pending invite", tone: "gold" },
  suspended: { label: "Suspended", tone: "red" },
};

const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "gold" },
  active: { label: "Active", tone: "green" },
  paused: { label: "Paused", tone: "orange" },
  expired: { label: "Expired", tone: "neutral" },
};

const OUTBOX_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gold" },
  sent: { label: "Sent", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

const BLOG_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "green" },
  archived: { label: "Archived", tone: "neutral" },
};

const AVAILABILITY: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "green" },
  off_duty: { label: "Off duty", tone: "neutral" },
  suspended: { label: "Unavailable", tone: "red" },
};

export function MetaBadge({
  map,
  value,
  className,
}: {
  map: Record<string, { label: string; tone: Tone }>;
  value: string;
  className?: string;
}) {
  const meta = map[value] ?? { label: value.replace(/_/g, " "), tone: "neutral" as Tone };
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", TONE_CLASSES[meta.tone], className)}>
      {meta.label}
    </Badge>
  );
}

export const OrderStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={ORDER_STATUS} value={status} className={className} />
);
export const PaymentStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={PAYMENT_STATUS} value={status} className={className} />
);
export const PaymentAttemptBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={PAYMENT_ATTEMPT} value={status} className={className} />
);
export const DispatchStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={DISPATCH_STATUS} value={status} className={className} />
);
export const StaffStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={STAFF_STATUS} value={status} className={className} />
);
export const CampaignStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={CAMPAIGN_STATUS} value={status} className={className} />
);
export const OutboxStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={OUTBOX_STATUS} value={status} className={className} />
);
export const BlogStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={BLOG_STATUS} value={status} className={className} />
);
export const AvailabilityBadge = ({ status, className }: { status: string; className?: string }) => (
  <MetaBadge map={AVAILABILITY} value={status} className={className} />
);

// ---------- Stat card ----------
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  sub,
  tone = "forest",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  sub?: ReactNode;
  tone?: "forest" | "gold" | "green" | "red" | "teal";
}) {
  const tints: Record<string, string> = {
    forest: "bg-[#17362B]/10 text-forest",
    gold: "bg-[#C9A227]/15 text-amber-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    teal: "bg-teal-100 text-teal-800",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" title={hint}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tints[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
      {sub !== undefined ? <div className="mt-2 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

// ---------- Skeletons ----------
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return <Skeleton className="h-[280px] w-full rounded-2xl" />;
}

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

// ---------- Money (pesewas) input ----------
/** Renders cedis for the operator, commits integer pesewas. */
export function PesewasInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
  disabled,
}: {
  value: number | null;
  onChange: (pesewas: number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  // Draft holds the operator's in-progress typing; when null the field mirrors the committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = value === null ? "" : (value / 100).toFixed(2);
  const raw = draft ?? formatted;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">GH₵</span>
      <Input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={cn("pl-12", className)}
        value={raw}
        placeholder={placeholder}
        onFocus={() => setDraft(raw)}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          setDraft(null);
          const n = Number.parseFloat(raw);
          onChange(raw.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 100));
        }}
      />
    </div>
  );
}

// ---------- Image upload ----------
export async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      toast.error(data.error || "Upload failed. Use a JPG/PNG/WebP under 5MB.");
      return null;
    }
    return data.url;
  } catch {
    toast.error("Upload failed — network error.");
    return null;
  }
}

// ---------- Formatting ----------
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------- Confirm dialog ----------
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="space-y-3">{children}</div> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Keep as is
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- API error message helper ----------
export function errMessage(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 409) {
    const msg = err instanceof Error ? err.message : "";
    return msg || "That action conflicts with the current state.";
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/** DELETE with query param helper (apiSend has no body on DELETE in some routes). */
export async function apiDelete(url: string): Promise<unknown> {
  const res = await fetch(url, { method: "DELETE", credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    Object.assign(err, { status: res.status });
    throw err;
  }
  return data;
}

export { apiSend };
