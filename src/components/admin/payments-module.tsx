"use client";

/** Payment evidence review: queue, history, reconciliation exceptions. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { formatGHS } from "@/lib/client";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  EmptyState,
  PaymentAttemptBadge,
  SkeletonRows,
  ConfirmDialog,
  formatDate,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface AdminPayment {
  id: string;
  orderId: string;
  orderReference: string;
  customerName: string;
  customerPhone: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  orderTotal: number;
  reference: string;
  evidenceName: string | null;
  hasEvidence: boolean;
  evidenceUrl: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReconciliationEvent {
  id: string;
  detail: string | null;
  status: string;
  paymentReference: string | null;
  createdAt: string;
}

interface PaymentsResponse {
  payments: AdminPayment[];
  exceptions: ReconciliationEvent[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export function PaymentsModule() {
  const { get, send } = useAdminApi();
  const [tab, setTab] = useState("queue");
  const [statusFilter, setStatusFilter] = useState("awaiting_review");
  const [provider, setProvider] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviewing, setReviewing] = useState<AdminPayment | null>(null);
  const [note, setNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (tab !== "exceptions") {
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (provider !== "all") params.set("provider", provider);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
      }
      const res = await get<PaymentsResponse>(`/api/admin/payments?${params.toString()}`);
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, tab, statusFilter, provider, page]);

  const payments = useMemo(() => data?.payments ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function decide(action: "approve" | "reject") {
    if (!reviewing) return;
    if (action === "reject" && note.trim().length < 3) {
      toast.error("A rejection reason (3+ characters) is required.");
      return;
    }
    setWorking(true);
    const res = await send<{ success: boolean }>("/api/admin/payments", "PATCH", {
      id: reviewing.id,
      action,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setWorking(false);
    if (res !== null) {
      toast.success(action === "approve" ? `Payment for ${reviewing.orderReference} approved.` : `Payment for ${reviewing.orderReference} rejected.`);
      setReviewing(null);
      setNote("");
      setApproveOpen(false);
      setRejectOpen(false);
      await refresh();
    }
  }

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== "exceptions") {
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (provider !== "all") params.set("provider", provider);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
    }
    const res = await get<PaymentsResponse>(`/api/admin/payments?${params.toString()}`);
    if (res) setData(res);
    setLoading(false);
  }, [get, tab, statusFilter, provider, page]);

  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="queue">Review queue</TabsTrigger>
          <TabsTrigger value="all">All payments</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void refresh(); }} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
        </Button>
      </div>

      {tab === "all" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by payment status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="awaiting_review">Awaiting review</SelectItem>
              <SelectItem value="paid">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Initiated</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by provider"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              <SelectItem value="manual">Manual (mobile money)</SelectItem>
              <SelectItem value="paystack">Paystack</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <TabsContent value={tab} className="space-y-4">
        {tab !== "exceptions" ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            {loading && !data ? (
              <div className="p-4"><SkeletonRows rows={6} /></div>
            ) : payments.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Receipt} title={tab === "queue" ? "Queue is clear" : "No payments found"} body={tab === "queue" ? "Every submitted payment has been reviewed." : "Adjust the filters to see more."} />
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <Table className="min-w-[880px]">
                  <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead className="text-right">Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-mono text-xs font-semibold text-forest">{p.orderReference}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{p.reference}</p>
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-[150px] truncate font-medium">{p.customerName}</span>
                          <span className="block text-xs text-muted-foreground">{p.customerPhone}</span>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{p.provider} · {p.method}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold">{formatGHS(p.amount)}</span>
                          {p.amount !== p.orderTotal ? (
                            <span className="block text-xs text-muted-foreground">order {formatGHS(p.orderTotal)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell><PaymentAttemptBadge status={p.status} /></TableCell>
                        <TableCell>
                          {p.hasEvidence ? (
                            <Button variant="outline" size="sm" onClick={() => { setReviewing(p); setNote(p.reviewNote ?? ""); }}>
                              View proof
                            </Button>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><ImageOff className="h-3.5 w-3.5" /> none</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.reviewedBy ? (
                            <>
                              {p.reviewedBy}
                              <span className="block">{formatDate(p.reviewedAt)}</span>
                            </>
                          ) : (
                            formatDate(p.createdAt)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "awaiting_review" ? (
                            <Button size="sm" variant="outline" className="border-forest/30 text-forest hover:bg-forest/5" onClick={() => { setReviewing(p); setNote(""); }}>
                              Review
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {tab !== "queue" && total > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <p className="text-muted-foreground">Page {page} of {pageCount} · {total.toLocaleString()} payments</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((x) => x + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2 text-base">
                <AlertOctagon className="h-5 w-5 text-amber-600" aria-hidden="true" /> Reconciliation exceptions
              </CardTitle>
              <CardDescription>Automated checks that need a human eye (last 20)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <SkeletonRows rows={4} />
              ) : (data?.exceptions ?? []).length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No exceptions" body="Provider webhooks and records agree — nothing to reconcile." />
              ) : (
                <div className="space-y-2">
                  {(data?.exceptions ?? []).map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{e.status}</Badge>
                      <span className="font-mono text-xs text-forest">{e.paymentReference ?? "unknown payment"}</span>
                      <span className="flex-1 text-muted-foreground">{e.detail ?? "No detail recorded."}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Evidence review dialog */}
      <Dialog open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {reviewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Evidence review — {reviewing.orderReference}</DialogTitle>
                <DialogDescription>
                  {reviewing.customerName} · {reviewing.provider} ({reviewing.method}) · attempt {reviewing.reference}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Claimed</p>
                    <p className="font-bold text-forest">{formatGHS(reviewing.amount)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order total</p>
                    <p className="font-bold">{formatGHS(reviewing.orderTotal)}</p>
                  </div>
                  <div className={`rounded-xl border p-3 ${reviewing.amount === reviewing.orderTotal ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Match</p>
                    <p className={`font-bold ${reviewing.amount === reviewing.orderTotal ? "text-green-800" : "text-red-800"}`}>
                      {reviewing.amount === reviewing.orderTotal ? "Exact" : "Mismatch"}
                    </p>
                  </div>
                </div>

                {reviewing.evidenceUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <img src={reviewing.evidenceUrl} alt={`Payment evidence for ${reviewing.orderReference}`} className="max-h-[420px] w-full object-contain" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No evidence image attached to this attempt.
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="review-note">Review note {reviewing.status === "awaiting_review" ? "(required to reject)" : "(optional)"}</Label>
                  <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Momo receipt shows GH₵85 received at 14:02" />
                </div>

                {reviewing.reviewedBy ? (
                  <p className="text-xs text-muted-foreground">Last reviewed by {reviewing.reviewedBy}: “{reviewing.reviewNote ?? "—"}”</p>
                ) : null}
              </div>

              {reviewing.status === "awaiting_review" ? (
                <DialogFooter className="gap-2">
                  <Button variant="outline" className="border-red-300 text-red-800 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={working}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button className="bg-green-700 text-white hover:bg-green-800" onClick={() => setApproveOpen(true)} disabled={working}>
                    <CheckCircle2 className="h-4 w-4" /> Approve payment
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this payment evidence?"
        description={reviewing ? `The order goes back to unpaid and the customer is notified. Order: ${reviewing.orderReference}.` : undefined}
        confirmLabel="Reject payment"
        destructive
        loading={working}
        onConfirm={() => void decide("reject")}
      >
        <p className="text-xs text-muted-foreground">Ensure the note below explains the rejection — it is sent to the customer.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this payment?"
        description={reviewing ? `${reviewing.orderReference} will be marked paid (${formatGHS(reviewing.orderTotal)}).` : undefined}
        confirmLabel="Approve"
        loading={working}
        onConfirm={() => void decide("approve")}
      />
    </Tabs>
  );
}
