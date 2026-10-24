"use client";

/** Order operations: searchable list + detail dialog with timeline and state-machine actions. */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gift,
  Inbox,
  MapPin,
  PackageCheck,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import { formatGHS } from "@/lib/client";
import type { AdminOrderListResponse, OrderDTO } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  ConfirmDialog,
  EmptyState,
  PaymentStatusBadge,
  OrderStatusBadge,
  SkeletonRows,
  formatDate,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Mirrors ORDER_TRANSITIONS (server-enforced; UI is cosmetic). */
const TRANSITIONS: Record<string, string[]> = {
  created: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "dispatched", "cancelled"],
  collected: ["completed"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

const ACTION_META: Record<string, { label: string; autoReason: string; destructive?: boolean }> = {
  accepted: { label: "Accept", autoReason: "Accepted via operations dashboard" },
  rejected: { label: "Reject", autoReason: "", destructive: true },
  preparing: { label: "Start preparing", autoReason: "Kitchen started preparing this order" },
  ready: { label: "Mark ready", autoReason: "Food ready for handover" },
  collected: { label: "Collected", autoReason: "Customer collected the order" },
  dispatched: { label: "Dispatch", autoReason: "Handed to dispatch rider" },
  completed: { label: "Complete", autoReason: "Order fulfilled" },
  cancelled: { label: "Cancel", autoReason: "", destructive: true },
};

const PAGE_SIZE = 20;

export function OrdersModule() {
  const staff = useAppStore((s) => s.staff);
  const { get, send } = useAdminApi();
  const canReviewPayments = staff?.permissions.includes("payments.review") ?? false;

  // Filters
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fulfillmentType, setFulfillmentType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminOrderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<OrderDTO | null>(null);

  // Status change dialog
  const [statusTarget, setStatusTarget] = useState<{ order: OrderDTO; next: string } | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (fulfillmentType !== "all") params.set("fulfillmentType", fulfillmentType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [q, status, paymentStatus, fulfillmentType, from, to, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<AdminOrderListResponse>(`/api/admin/orders?${query}`);
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, query]);

  function patchOrders(order: OrderDTO) {
    setData((d) => (d ? { ...d, orders: d.orders.map((o) => (o.id === order.id ? order : o)) } : d));
    setDetail((cur) => (cur && cur.id === order.id ? order : cur));
  }

  async function applyStatus() {
    if (!statusTarget) return;
    const { order, next } = statusTarget;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("Please give a short reason (at least 3 characters) — it is recorded on the order timeline.");
      return;
    }
    setWorking(true);
    const res = await send<{ order: OrderDTO }>("/api/admin/orders", "PATCH", {
      id: order.id,
      action: "status",
      status: next,
      reason: trimmed,
    });
    setWorking(false);
    if (res?.order) {
      patchOrders(res.order);
      toast.success(`Order ${order.reference} → ${ACTION_META[next]?.label ?? next}`);
      setStatusTarget(null);
    }
  }

  async function addNote() {
    if (!detail) return;
    const note = noteDraft.trim();
    if (!note) return;
    setWorking(true);
    const res = await send<{ order: OrderDTO }>("/api/admin/orders", "PATCH", { id: detail.id, action: "note", note });
    setWorking(false);
    if (res?.order) {
      patchOrders(res.order);
      setNoteDraft("");
      toast.success("Note added to timeline.");
    }
  }

  async function markPaid() {
    if (!detail) return;
    setWorking(true);
    const res = await send<{ order: OrderDTO | null }>("/api/admin/orders", "PATCH", { id: detail.id, action: "mark_paid" });
    setWorking(false);
    setMarkPaidOpen(false);
    if (res?.order) {
      patchOrders(res.order);
      toast.success(`Payment confirmed for ${detail.reference}.`);
    }
  }

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search reference, name or phone…"
              className="pl-9"
              aria-label="Search orders"
            />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(TRANSITIONS).map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by payment status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="pending_verification">Pending verification</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fulfillmentType} onValueChange={(v) => { setFulfillmentType(v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by fulfillment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pickup + delivery</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !data ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Inbox} title="No orders match" body="Try clearing filters or widening the date range." />
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => { setDetail(o); setNoteDraft(""); }}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-forest">{o.reference}</TableCell>
                    <TableCell>
                      <span className="block max-w-[160px] truncate font-medium">{o.customerName}</span>
                      <span className="block max-w-[160px] truncate text-xs text-muted-foreground">{o.customerPhone}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 border-border bg-muted/60 font-normal">
                        {o.fulfillmentType === "delivery" ? <Bike className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                        {o.fulfillmentType}
                      </Badge>
                      {o.zoneName ? (
                        <Badge variant="outline" className="mt-1 block max-w-[130px] truncate border-teal-300 bg-teal-50 font-normal text-teal-900">
                          <MapPin className="mr-1 h-3 w-3 shrink-0" />
                          {o.zoneName}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatGHS(o.total)}</TableCell>
                    <TableCell><PaymentStatusBadge status={o.paymentStatus} /></TableCell>
                    <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open order ${o.reference}`}
                        onClick={(e) => { e.stopPropagation(); setDetail(o); setNoteDraft(""); }}
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
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${total.toLocaleString()} order${total === 1 ? "" : "s"} · page ${page} of ${pageCount}`}
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

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-lg text-forest">
                  {detail.reference}
                  <OrderStatusBadge status={detail.status} />
                  <PaymentStatusBadge status={detail.paymentStatus} />
                </DialogTitle>
                <DialogDescription>
                  Placed {formatDate(detail.createdAt)} ·{" "}
                  {detail.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                  {detail.couponCode ? ` · Coupon ${detail.couponCode}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Customer */}
                <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                    <p className="font-semibold">{detail.customerName}</p>
                    <p className="text-muted-foreground">{detail.customerPhone}</p>
                    {detail.customerEmail ? <p className="text-muted-foreground">{detail.customerEmail}</p> : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {detail.fulfillmentType === "delivery" ? "Delivery address" : "Fulfillment"}
                    </p>
                    {detail.address ? <p>{detail.address}</p> : <p className="text-muted-foreground">Pickup at the restaurant</p>}
                    {detail.zoneName ? (
                      <Badge variant="outline" className="mt-1 border-teal-300 bg-teal-50 text-teal-900">
                        <MapPin className="mr-1 h-3 w-3" /> Zone: {detail.zoneName}
                      </Badge>
                    ) : null}
                    {detail.landmark ? (
                      <p className="mt-1 text-xs text-muted-foreground">Landmark: {detail.landmark}</p>
                    ) : null}
                    {detail.fulfillmentType === "delivery" ? (
                      detail.locationConfirmed ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Location confirmed
                        </p>
                      ) : (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Location not confirmed
                        </p>
                      )
                    ) : null}
                    {detail.scheduledDate || detail.scheduledTime ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Scheduled: {detail.scheduledDate ?? "—"}
                        {detail.scheduledTime ? ` · ${detail.scheduledTime}` : ""}
                      </p>
                    ) : null}
                    {detail.note ? (
                      <p className="mt-1 rounded-lg bg-gold/10 px-2 py-1 text-xs text-amber-900">Customer note: {detail.note}</p>
                    ) : null}
                  </div>
                </div>

                {/* Gift order */}
                {detail.recipientName ? (
                  <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-sm">
                    <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                      <Gift className="h-4 w-4" /> Gift order
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700/80">Recipient</p>
                        <p className="font-semibold text-violet-950">{detail.recipientName}</p>
                        {detail.recipientPhone ? <p className="text-violet-900/80">{detail.recipientPhone}</p> : null}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700/80">On the receipt</p>
                        <Badge variant="outline" className="border-violet-300 bg-white text-violet-900">
                          {detail.hidePrices ? "Prices hidden" : "Prices shown"}
                        </Badge>
                      </div>
                    </div>
                    {detail.giftMessage ? (
                      <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs italic text-violet-950">
                        “{detail.giftMessage}”
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Items */}
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Line</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.variantName}
                              {item.addons.length > 0 ? ` + ${item.addons.map((a) => a.name).join(", ")}` : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatGHS(item.unitPrice)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatGHS(item.lineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                  <Row label="Subtotal" value={formatGHS(detail.subtotal)} />
                  {detail.discount > 0 ? <Row label="Discount" value={`− ${formatGHS(detail.discount)}`} accent /> : null}
                  <Row label="Delivery fee" value={formatGHS(detail.deliveryFee)} />
                  <Separator />
                  <Row label="Total" value={formatGHS(detail.total)} bold />
                </div>

                {/* Payment attempts */}
                {detail.payments.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Payment attempts</p>
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                        <span className="font-medium">{p.provider} · {p.method}</span>
                        <span className="font-semibold text-forest">{formatGHS(p.amount)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.reference}</span>
                        {p.hasEvidence ? <Badge variant="outline" className="border-gold text-amber-800">evidence attached</Badge> : null}
                        {p.reviewNote ? <span className="text-xs text-muted-foreground">“{p.reviewNote}”</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {(TRANSITIONS[detail.status] ?? []).map((next) => {
                      const meta = ACTION_META[next];
                      if (!meta) return null;
                      return (
                        <Button
                          key={next}
                          size="sm"
                          variant={meta.destructive ? "destructive" : next === "accepted" ? "default" : "outline"}
                          className={cn(!meta.destructive && next !== "accepted" && "border-forest/30 text-forest hover:bg-forest/5")}
                          onClick={() => {
                            setReason(meta.autoReason);
                            setStatusTarget({ order: detail, next });
                          }}
                        >
                          {next === "dispatched" ? <Bike className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                          {meta.label}
                        </Button>
                      );
                    })}
                    {canReviewPayments && detail.paymentStatus !== "paid" && !["cancelled", "rejected"].includes(detail.status) ? (
                      <Button size="sm" variant="outline" className="border-green-700/40 text-green-800 hover:bg-green-50" onClick={() => setMarkPaidOpen(true)}>
                        <ShoppingBag className="h-4 w-4" /> Mark paid (cash)
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal note to the timeline…"
                      aria-label="Order note"
                      onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }}
                    />
                    <Button variant="outline" onClick={() => void addNote()} disabled={working || !noteDraft.trim()} className="shrink-0">
                      Add note
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Timeline</p>
                  {detail.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events recorded.</p>
                  ) : (
                    <ol className="relative space-y-3 border-l-2 border-forest/15 pl-4">
                      {[...detail.events].reverse().map((ev) => (
                        <li key={ev.id} className="relative text-sm">
                          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-cream" aria-hidden="true" />
                          <p>{ev.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {ev.actor} · {formatDate(ev.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Status change confirm */}
      <Dialog open={statusTarget !== null} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {statusTarget ? `${ACTION_META[statusTarget.next]?.label ?? "Update"} order ${statusTarget.order.reference}?` : "Update order"}
            </DialogTitle>
            <DialogDescription>
              A short reason is required — it is written to the customer-visible timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="status-reason">Reason</Label>
            <Textarea
              id="status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer called to change the order"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={working}>Back</Button>
            <Button
              variant={statusTarget && ACTION_META[statusTarget.next]?.destructive ? "destructive" : "default"}
              onClick={() => void applyStatus()}
              disabled={working || reason.trim().length < 3}
            >
              {working ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid confirm */}
      <ConfirmDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        title="Confirm cash payment received?"
        description={detail ? `${detail.reference} · ${formatGHS(detail.total)} will be marked as paid.` : undefined}
        confirmLabel="Mark as paid"
        loading={working}
        onConfirm={() => void markPaid()}
      />
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-muted-foreground", bold && "font-semibold text-foreground")}>{label}</span>
      <span className={cn(accent && "text-green-700", bold && "text-base font-bold text-forest")}>{value}</span>
    </div>
  );
}
