"use client";

/** Catering quotations (spec §8): intake queue, lifecycle management and pricing. */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  HandPlatter,
  Inbox,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiGet, formatGHS } from "@/lib/client";
import type { AdminQuoteListResponse, CateringQuoteDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  EmptyState,
  MetaBadge,
  PesewasInput,
  SkeletonRows,
  StatCard,
  formatDate,
} from "@/components/admin/admin-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type BadgeTone = "neutral" | "gold" | "green" | "solid-green" | "red" | "teal" | "orange" | "violet";

const QUOTE_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "gold" },
  reviewing: { label: "Reviewing", tone: "teal" },
  quoted: { label: "Quoted", tone: "violet" },
  approved: { label: "Approved", tone: "green" },
  converted: { label: "Converted", tone: "solid-green" },
  rejected: { label: "Rejected", tone: "red" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  quoted: "Quoted",
  approved: "Approved",
  converted: "Converted",
  rejected: "Rejected",
};

/** Mirrors QUOTE_TRANSITIONS on the server — the select only offers legal moves. */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["reviewing", "quoted", "rejected"],
  reviewing: ["quoted", "rejected"],
  quoted: ["approved", "rejected", "reviewing"],
  approved: ["converted", "rejected"],
  rejected: [],
  converted: [],
};

const SERVICE_LABELS: Record<string, string> = {
  staff_meals: "Staff meals",
  family_group: "Family & group packs",
  meetings: "Meetings",
  conference: "Conferences",
  party: "Parties & events",
  canteen: "Canteen supply",
  recurring: "Recurring supply",
  custom: "Custom request",
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "reviewing", label: "Reviewing" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 20;

/** Silent fetch for the supplementary stat row — failures render "—", no toast noise. */
async function quietGet<T>(url: string): Promise<T | null> {
  try {
    return await apiGet<T>(url);
  } catch {
    return null;
  }
}

export function QuotesModule() {
  const { get, send } = useAdminApi();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("pending");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);

  const [data, setData] = useState<AdminQuoteListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CateringQuoteDTO | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{
    pending: number | null;
    quotedThisWeek: number | null;
    convertedValue: number | null;
    convertedCount: number | null;
  }>({ pending: null, quotedThisWeek: null, convertedValue: null, convertedCount: null });

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("status", tab);
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [tab, q, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<AdminQuoteListResponse>(`/api/admin/quotes?${query}`);
      if (!cancelled) {
        if (res) {
          setData(res);
          setCounts((c) => ({ ...c, [tab]: res.total }));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, query, tab]);

  // Quick stat row — three cheap indexed status counts (silent on failure).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pending, quoted, converted] = await Promise.all([
        quietGet<AdminQuoteListResponse>("/api/admin/quotes?status=pending&pageSize=1"),
        quietGet<AdminQuoteListResponse>("/api/admin/quotes?status=quoted&pageSize=50"),
        quietGet<AdminQuoteListResponse>("/api/admin/quotes?status=converted&pageSize=50"),
      ]);
      if (cancelled) return;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      setCounts((c) => ({
        ...c,
        ...(pending ? { pending: pending.total } : {}),
        ...(quoted ? { quoted: quoted.total } : {}),
        ...(converted ? { converted: converted.total } : {}),
      }));
      setStats({
        pending: pending?.total ?? null,
        quotedThisWeek: quoted
          ? quoted.quotes.filter((r) => new Date(r.updatedAt).getTime() >= weekAgo).length
          : null,
        convertedValue: converted ? converted.quotes.reduce((sum, r) => sum + (r.quotedTotal ?? 0), 0) : null,
        convertedCount: converted?.total ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const quotes = data?.quotes ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Quotations from the catering form — price them, then move them through the lifecycle.
        </p>
        <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      <section aria-label="Quotation snapshot" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending quotes"
          value={stats.pending ?? "—"}
          icon={HandPlatter}
          tone="gold"
          hint="New enquiries awaiting first action"
        />
        <StatCard
          label="Quoted this week"
          value={stats.quotedThisWeek ?? "—"}
          icon={CalendarClock}
          tone="teal"
          hint="Quotations updated in the last 7 days"
        />
        <StatCard
          label="Converted value"
          value={stats.convertedValue !== null ? formatGHS(stats.convertedValue) : "—"}
          icon={CircleDollarSign}
          tone="green"
          sub={
            stats.convertedCount !== null
              ? `${stats.convertedCount} converted quotation${stats.convertedCount === 1 ? "" : "s"}`
              : undefined
          }
          hint="Agreed totals of converted quotations"
        />
      </section>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabKey); setPage(1); }}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              {t.label}
              {counts[t.key] !== undefined ? (
                <span className="rounded-full bg-forest/10 px-1.5 text-[11px] font-semibold text-forest">
                  {counts[t.key]}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search reference, name, phone or organisation…"
            className="pl-9"
            aria-label="Search quotations"
          />
        </div>
        <p className="text-sm text-muted-foreground md:ml-auto">
          {loading ? "Loading…" : `${total.toLocaleString()} quotation${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !data ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Inbox}
              title="No quotations here"
              body={
                tab === "pending"
                  ? "New catering enquiries from the website land in this tab."
                  : "Try another tab or clear the search."
              }
            />
          </div>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-center">People × meals</TableHead>
                  <TableHead>Event date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((qt) => (
                  <TableRow key={qt.id} className="cursor-pointer" onClick={() => setDetail(qt)}>
                    <TableCell className="font-mono text-xs font-semibold text-forest">{qt.reference}</TableCell>
                    <TableCell>
                      <span className="block max-w-[160px] truncate font-medium">{qt.name}</span>
                      {qt.organization ? (
                        <span className="block max-w-[160px] truncate text-xs text-muted-foreground">{qt.organization}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{qt.phone}</TableCell>
                    <TableCell className="whitespace-nowrap">{SERVICE_LABELS[qt.serviceType] ?? qt.serviceType}</TableCell>
                    <TableCell className="text-center font-medium">
                      {qt.people} × {qt.mealsPerPerson}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{qt.eventDate ?? "—"}</TableCell>
                    <TableCell>
                      <MetaBadge map={QUOTE_STATUS_META} value={qt.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {qt.quotedTotal !== null ? formatGHS(qt.quotedTotal) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(qt.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open quotation ${qt.reference}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail(qt);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <QuoteDetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onSaved={(updated) => {
          setData((d) => (d ? { ...d, quotes: d.quotes.map((x) => (x.id === updated.id ? updated : x)) } : d));
          setNonce((n) => n + 1); // status counts + stat row may have shifted
        }}
        send={send}
      />
    </div>
  );
}

function QuoteDetailDialog({
  detail,
  onClose,
  onSaved,
  send,
}: {
  detail: CateringQuoteDTO | null;
  onClose: () => void;
  onSaved: (updated: CateringQuoteDTO) => void;
  send: (url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => Promise<unknown>;
}) {
  const open = detail !== null;
  const [statusValue, setStatusValue] = useState("pending");
  const [quotedTotal, setQuotedTotal] = useState<number | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-initialize the controls whenever the dialog opens for a different quotation.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = detail?.id ?? null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (detail) {
      setStatusValue(detail.status);
      setQuotedTotal(detail.quotedTotal);
      setDeposit(detail.depositAmount);
      setAdminNote(detail.adminNote ?? "");
    }
  }

  const allowed = detail ? (TRANSITIONS[detail.status] ?? []) : [];
  const statusChanged = detail !== null && statusValue !== detail.status;
  const needsPriceBeforeSave =
    (statusValue === "quoted" || statusValue === "approved") && (quotedTotal ?? 0) <= 0;
  const terminal = detail !== null && allowed.length === 0;

  async function save() {
    if (!detail) return;
    if (needsPriceBeforeSave) {
      toast.error("Set a quoted total above GH₵0 before marking this quotation quoted or approved.");
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      id: detail.id,
      quotedTotal,
      depositAmount: deposit,
      adminNote: adminNote.trim(),
    };
    if (statusChanged) body.status = statusValue;
    const res = (await send("/api/admin/quotes", "PATCH", body)) as { quote?: CateringQuoteDTO } | null;
    setSaving(false);
    if (res?.quote) {
      toast.success(`Quotation ${res.quote.reference} updated.`);
      onSaved(res.quote);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {detail ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-lg text-forest">
                {detail.reference}
                <MetaBadge map={QUOTE_STATUS_META} value={detail.status} />
              </DialogTitle>
              <DialogDescription>
                Received {formatDate(detail.createdAt)} ·{" "}
                {SERVICE_LABELS[detail.serviceType] ?? detail.serviceType} · handled by{" "}
                {detail.handledBy ?? "—"} · updated {formatDate(detail.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Contact + event */}
              <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                  <p className="font-semibold">{detail.name}</p>
                  {detail.organization ? <p className="text-muted-foreground">{detail.organization}</p> : null}
                  <p className="text-muted-foreground">{detail.phone}</p>
                  {detail.email ? <p className="break-all text-muted-foreground">{detail.email}</p> : null}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Event</p>
                  <p>
                    <span className="font-semibold">{detail.people}</span> people ×{" "}
                    <span className="font-semibold">{detail.mealsPerPerson}</span> meal
                    {detail.mealsPerPerson === 1 ? "" : "s"} per person
                  </p>
                  <p className="text-muted-foreground">
                    {detail.eventDate ?? "Date TBD"}
                    {detail.eventTime ? ` · ${detail.eventTime}` : ""}
                  </p>
                  {detail.venue ? <p className="text-muted-foreground">Venue: {detail.venue}</p> : null}
                </div>
              </div>

              {/* Requested items */}
              {detail.items.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table className="min-w-[420px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Requested item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item, i) => (
                        <TableRow key={`${item.label}-${i}`}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell className="text-center">{item.qty}</TableCell>
                          <TableCell className="text-muted-foreground">{item.note ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {/* Message */}
              {detail.message ? (
                <blockquote className="rounded-xl border-l-4 border-gold bg-gold/5 px-4 py-3 text-sm text-foreground">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Customer message</p>
                  {detail.message}
                </blockquote>
              ) : null}

              {/* Admin controls */}
              <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
                <p className="text-sm font-semibold text-foreground">Quotation controls</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    {terminal ? (
                      <Input value={STATUS_LABELS[detail.status] ?? detail.status} disabled aria-label="Status (final)" />
                    ) : (
                      <Select value={statusValue} onValueChange={setStatusValue}>
                        <SelectTrigger aria-label="Quotation status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={detail.status}>{STATUS_LABELS[detail.status] ?? detail.status} (current)</SelectItem>
                          {allowed.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quoted total</Label>
                    <PesewasInput value={quotedTotal} onChange={setQuotedTotal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deposit amount</Label>
                    <PesewasInput value={deposit} onChange={setDeposit} placeholder="none" />
                  </div>
                </div>
                {statusChanged && needsPriceBeforeSave ? (
                  <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
                    A quoted total above GH₵0 is required before this quotation can be marked{" "}
                    {STATUS_LABELS[statusValue] ?? statusValue}.
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="quote-admin-note">Internal note</Label>
                  <Textarea
                    id="quote-admin-note"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={2}
                    placeholder="Visible to staff only — e.g. deposit terms, confirmed menu…"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {terminal ? (
                    <p className="mr-auto text-xs text-muted-foreground">
                      This quotation is {STATUS_LABELS[detail.status]?.toLowerCase()} — the record is final.
                    </p>
                  ) : null}
                  <Button variant="outline" onClick={onClose} disabled={saving}>
                    Close
                  </Button>
                  <Button
                    onClick={() => void save()}
                    disabled={saving || (terminal && adminNote.trim() === (detail.adminNote ?? ""))}
                    className="bg-forest text-cream hover:bg-[#23503E]"
                  >
                    {saving ? "Saving…" : statusChanged ? "Save & move status" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
