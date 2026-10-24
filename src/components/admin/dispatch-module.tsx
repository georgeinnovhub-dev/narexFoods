"use client";

/** Dispatch control room: delivery queue, live assignments, riders, and the dispatcher self-service view. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Undo2,
  UserRound,
  XCircle,
} from "lucide-react";
import { formatGHS } from "@/lib/client";
import type { DispatchAssignmentDTO, DispatcherDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import { useAppStore } from "@/store/app-store";
import {
  ConfirmDialog,
  DispatchStatusBadge,
  EmptyState,
  AvailabilityBadge,
  PaymentStatusBadge,
  PesewasInput,
  SkeletonRows,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal } from "lucide-react";

/** Mirrors DISPATCH_TRANSITIONS (server-enforced). */
const NEXT_STATUSES: Record<string, { to: string; label: string }[]> = {
  assigned: [{ to: "accepted", label: "Accept delivery" }],
  accepted: [
    { to: "collected", label: "Collected from kitchen" },
    { to: "failed", label: "Mark failed" },
  ],
  collected: [
    { to: "out_for_delivery", label: "Start delivery" },
    { to: "failed", label: "Mark failed" },
  ],
  out_for_delivery: [
    { to: "delivered", label: "Delivered" },
    { to: "failed", label: "Mark failed" },
  ],
  failed: [
    { to: "out_for_delivery", label: "Retry delivery" },
    { to: "returned", label: "Return to shop" },
  ],
};

interface QueueItem {
  orderId: string;
  reference: string;
  customerName: string;
  address: string | null;
  total: number;
  createdAt: string;
  paymentStatus: string;
}

interface QueueResponse {
  assignments: DispatchAssignmentDTO[];
  dispatchers: DispatcherDTO[];
  queue: QueueItem[];
  serviceAreas: string[];
  baseFee: number;
  deliveryEnabled: boolean;
}

interface MineResponse {
  assignments: DispatchAssignmentDTO[];
  availability: string;
}

export function DispatchModule() {
  const staff = useAppStore((s) => s.staff);
  const isManager = staff?.permissions.includes("dispatch.manage") ?? false;
  const isDispatcher = staff?.role === "Dispatcher";
  const [tab, setTab] = useState(isManager ? "queue" : "mine");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        {isManager ? (
          <>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="dispatchers">Dispatchers</TabsTrigger>
          </>
        ) : null}
        {isDispatcher || isManager ? <TabsTrigger value="mine">My deliveries</TabsTrigger> : null}
      </TabsList>
      {isManager ? (
        <>
          <TabsContent value="queue"><ManagerView tab="queue" /></TabsContent>
          <TabsContent value="assignments"><ManagerView tab="assignments" /></TabsContent>
          <TabsContent value="dispatchers"><DispatchersView /></TabsContent>
        </>
      ) : null}
      <TabsContent value="mine"><MineView /></TabsContent>
    </Tabs>
  );
}

// ---------------- Manager views ----------------

function ManagerView({ tab }: { tab: "queue" | "assignments" }) {
  const { get, send } = useAdminApi();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<QueueItem | null>(null);
  const [unassigning, setUnassigning] = useState<DispatchAssignmentDTO | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ assignment: DispatchAssignmentDTO; to: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const res = await get<QueueResponse>("/api/admin/dispatch?view=queue");
    if (res) setData(res);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<QueueResponse>("/api/admin/dispatch?view=queue");
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function doUnassign() {
    if (!unassigning) return;
    setWorking(true);
    const res = await send<{ success: boolean }>("/api/admin/dispatch", "POST", { action: "unassign", assignmentId: unassigning.id });
    setWorking(false);
    if (res !== null) {
      toast.success(`${unassigning.orderReference} returned to the queue.`);
      setUnassigning(null);
      await load();
    }
  }

  async function applyStatus() {
    if (!statusTarget) return;
    const trimmed = reason.trim();
    if ((statusTarget.to === "failed" || statusTarget.to === "returned") && trimmed.length < 3) {
      toast.error("A reason (3+ characters) is required for failed deliveries.");
      return;
    }
    setWorking(true);
    const res = await send<{ assignment: DispatchAssignmentDTO }>("/api/admin/dispatch", "PATCH", {
      assignmentId: statusTarget.assignment.id,
      status: statusTarget.to,
      ...(trimmed ? { reason: trimmed } : {}),
    });
    setWorking(false);
    if (res) {
      toast.success(`${statusTarget.assignment.orderReference} → ${statusTarget.to.replace(/_/g, " ")}`);
      setStatusTarget(null);
      setReason("");
      await load();
    }
  }

  const queue = data?.queue ?? [];
  const assignments = data?.assignments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className={data?.deliveryEnabled ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}>
            Delivery {data?.deliveryEnabled ? "enabled" : "disabled"}
          </Badge>
          <span>Base fee {formatGHS(data?.baseFee ?? 0)}</span>
          <span className="hidden sm:inline">· Areas: {(data?.serviceAreas ?? []).join(", ") || "—"}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><SkeletonRows rows={6} /></div>
      ) : tab === "queue" ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {queue.length === 0 ? (
            <div className="p-4"><EmptyState icon={CheckCircle2} title="Dispatch queue is empty" body="Every delivery order has a rider." /></div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead className="text-right">Assign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((q) => (
                    <TableRow key={q.orderId}>
                      <TableCell className="font-mono text-xs font-semibold text-forest">{q.reference}</TableCell>
                      <TableCell>{q.customerName}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{q.address ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatGHS(q.total)}</TableCell>
                      <TableCell><PaymentStatusBadge status={q.paymentStatus} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="border-forest/30 text-forest hover:bg-forest/5" onClick={() => setAssigning(q)}>
                          <Bike className="h-4 w-4" /> Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {assignments.length === 0 ? (
            <div className="p-4"><EmptyState icon={Bike} title="No assignments yet" /></div>
          ) : (
            <div className="max-h-[62vh] overflow-auto">
              <Table className="min-w-[880px]">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold text-forest">{a.orderReference}</p>
                        <p className="text-xs text-muted-foreground">{a.customerName}</p>
                      </TableCell>
                      <TableCell>{a.dispatcherName ?? <span className="text-xs text-amber-700">awaiting rider</span>}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{a.address ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatGHS(a.fee)}</TableCell>
                      <TableCell><DispatchStatusBadge status={a.status} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{a.assignedAt ? formatDate(a.assignedAt) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${a.orderReference}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>Delivery {a.orderReference}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(NEXT_STATUSES[a.status] ?? []).map((n) => (
                              <DropdownMenuItem key={n.to} onClick={() => { setStatusTarget({ assignment: a, to: n.to, label: n.label }); setReason(""); }}>
                                {n.to === "failed" ? <XCircle className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                                {n.label}
                              </DropdownMenuItem>
                            ))}
                            {a.dispatcherId ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setUnassigning(a)}>
                                  <Undo2 className="h-4 w-4" /> Unassign rider
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {a.failureReason ? (
                              <DropdownMenuLabel className="text-xs font-normal text-red-700">Last failure: {a.failureReason}</DropdownMenuLabel>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <AssignDialog queueItem={assigning} dispatchers={data?.dispatchers ?? []} baseFee={data?.baseFee ?? 0} onOpenChange={(o) => !o && setAssigning(null)} onAssigned={load} />

      <ConfirmDialog
        open={unassigning !== null}
        onOpenChange={(o) => !o && setUnassigning(null)}
        title={unassigning ? `Unassign ${unassigning.dispatcherName ?? "rider"}?` : "Unassign?"}
        description="The order returns to the dispatch queue so another rider can take it."
        confirmLabel="Unassign"
        loading={working}
        onConfirm={() => void doUnassign()}
      />

      <Dialog open={statusTarget !== null} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{statusTarget?.label}</DialogTitle>
            <DialogDescription>
              {statusTarget ? `Delivery for ${statusTarget.assignment.orderReference}. Failed/returned transitions require a reason.` : undefined}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="disp-reason">Reason (required for failed / returned)</Label>
            <Textarea id="disp-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Customer unreachable at gate" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={working}>Back</Button>
            <Button
              onClick={() => void applyStatus()}
              disabled={working}
              className={statusTarget && (statusTarget.to === "failed" || statusTarget.to === "returned") ? "bg-red-700 text-white hover:bg-red-800" : "bg-forest text-cream hover:bg-[#23503E]"}
            >
              {working ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignDialog({
  queueItem,
  dispatchers,
  baseFee,
  onOpenChange,
  onAssigned,
}: {
  queueItem: QueueItem | null;
  dispatchers: DispatcherDTO[];
  baseFee: number;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [dispatcherId, setDispatcherId] = useState<string>("none");
  const [fee, setFee] = useState<number | null>(baseFee);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill defaults whenever a new queue item is opened for assignment.
  const [lastItem, setLastItem] = useState<QueueItem | null>(null);
  if (queueItem !== lastItem) {
    setLastItem(queueItem);
    if (queueItem) {
      setDispatcherId(dispatchers.find((d) => d.availability === "available")?.id ?? dispatchers[0]?.id ?? "none");
      setFee(baseFee);
      setNote("");
    }
  }

  async function submit() {
    if (!queueItem) return;
    setSaving(true);
    const res = await send<{ assignment: DispatchAssignmentDTO }>("/api/admin/dispatch", "POST", {
      action: "assign",
      orderId: queueItem.orderId,
      ...(dispatcherId !== "none" ? { dispatcherId } : {}),
      ...(fee !== null ? { fee } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSaving(false);
    if (res) {
      toast.success(`${queueItem.reference} assigned.`);
      onOpenChange(false);
      await onAssigned();
    }
  }

  return (
    <Dialog open={queueItem !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Assign rider — {queueItem?.reference}</DialogTitle>
          <DialogDescription>{queueItem ? `${queueItem.customerName} · ${queueItem.address ?? "no address"}` : undefined}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dispatcher</Label>
            <Select value={dispatcherId} onValueChange={setDispatcherId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Leave awaiting a rider</SelectItem>
                {dispatchers.map((d) => (
                  <SelectItem key={d.id} value={d.id} disabled={d.status !== "active" || d.availability === "suspended"}>
                    {d.name} · {d.availability === "available" ? "available" : d.availability} · {d.activeAssignments} active
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Delivery fee</Label>
            <PesewasInput value={fee} onChange={setFee} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-note">Note (optional)</Label>
            <Input id="assign-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gate code, landmark…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Assigning…" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Dispatchers ----------------

function DispatchersView() {
  const { get, send } = useAdminApi();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DispatcherDTO | null>(null);

  const load = useCallback(async () => {
    const res = await get<QueueResponse>("/api/admin/dispatch?view=queue");
    if (res) setData(res);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<QueueResponse>("/api/admin/dispatch?view=queue");
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function toggleAvailability(d: DispatcherDTO) {
    const next = d.availability === "available" ? "off_duty" : "available";
    const res = await send<{ success: boolean }>("/api/admin/dispatchers", "PATCH", { id: d.id, action: "set_availability", availability: next });
    if (res !== null) {
      toast.success(`${d.name} is now ${next === "available" ? "available" : "off duty"}.`);
      await load();
    }
  }

  const dispatchers = data?.dispatchers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
        </Button>
      </div>
      {loading && !data ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><SkeletonRows rows={4} /></div>
      ) : dispatchers.length === 0 ? (
        <EmptyState icon={UserRound} title="No dispatch profiles" body="Invite staff with the Dispatcher role to create rider profiles." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dispatchers.map((d) => (
            <Card key={d.id} className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    <CardDescription className="truncate">{d.email}</CardDescription>
                  </div>
                  <AvailabilityBadge status={d.availability} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {d.phone || "no phone set"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bike className="h-4 w-4" aria-hidden="true" /> {d.vehicle || "no vehicle set"}
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-forest">{d.activeAssignments}</p>
                    <p className="text-xs text-muted-foreground">active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-forest">{d.completedCount}</p>
                    <p className="text-xs text-muted-foreground">delivered</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={d.availability === "available"} disabled={d.status !== "active"} onCheckedChange={() => void toggleAvailability(d)} aria-label={`Toggle availability for ${d.name}`} />
                    On duty
                  </label>
                  <Button variant="outline" size="sm" onClick={() => setEditing(d)}>Edit details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DispatcherEditDialog dispatcher={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
    </div>
  );
}

function DispatcherEditDialog({
  dispatcher,
  onOpenChange,
  onSaved,
}: {
  dispatcher: DispatcherDTO | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [areas, setAreas] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill the form whenever a different dispatcher is opened for editing.
  const [lastDispatcher, setLastDispatcher] = useState<DispatcherDTO | null>(null);
  if (dispatcher !== lastDispatcher) {
    setLastDispatcher(dispatcher);
    if (dispatcher) {
      setPhone(dispatcher.phone ?? "");
      setVehicle(dispatcher.vehicle ?? "");
      setAreas((dispatcher as DispatcherDTO & { serviceAreas?: string[] }).serviceAreas?.join(", ") ?? "");
    }
  }

  async function save() {
    if (!dispatcher) return;
    setSaving(true);
    const res = await send<{ success: boolean }>("/api/admin/dispatchers", "PATCH", {
      id: dispatcher.id,
      action: "set_details",
      phone: phone.trim(),
      vehicle: vehicle.trim(),
      ...(areas.trim() ? { serviceAreas: areas.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
    });
    setSaving(false);
    if (res !== null) {
      toast.success("Dispatcher details updated.");
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={dispatcher !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Edit {dispatcher?.name}</DialogTitle>
          <DialogDescription>Contact details appear on assignment records.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-phone">Phone</Label>
            <Input id="d-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0559 000 000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-vehicle">Vehicle</Label>
            <Input id="d-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Red motorbike · M-24-GE-117" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-areas">Service areas (comma-separated)</Label>
            <Input id="d-areas" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Mampong-Akuapem, Akropong" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Dispatcher self-service ----------------

function MineView() {
  const { get, send } = useAdminApi();
  const [data, setData] = useState<MineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusTarget, setStatusTarget] = useState<{ assignment: DispatchAssignmentDTO; to: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const res = await get<MineResponse>("/api/admin/dispatch?view=mine");
    if (res) setData(res);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<MineResponse>("/api/admin/dispatch?view=mine");
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function applyStatus() {
    if (!statusTarget) return;
    const trimmed = reason.trim();
    if ((statusTarget.to === "failed" || statusTarget.to === "returned") && trimmed.length < 3) {
      toast.error("A reason (3+ characters) is required.");
      return;
    }
    setWorking(true);
    const res = await send<{ assignment: DispatchAssignmentDTO }>("/api/admin/dispatch", "PATCH", {
      assignmentId: statusTarget.assignment.id,
      status: statusTarget.to,
      ...(trimmed ? { reason: trimmed } : {}),
    });
    setWorking(false);
    if (res) {
      toast.success(`${statusTarget.assignment.orderReference} → ${statusTarget.to.replace(/_/g, " ")}`);
      setStatusTarget(null);
      setReason("");
      await load();
    }
  }

  const assignments = useMemo(() => {
    const list = data?.assignments ?? [];
    const rank: Record<string, number> = { assigned: 0, accepted: 1, collected: 2, out_for_delivery: 3, failed: 4, awaiting: 5, returned: 6, delivered: 7 };
    return [...list].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className={data?.availability === "available" ? "border-green-300 bg-green-50 text-green-900" : "border-border"}>
            You are {data?.availability === "available" ? "on duty" : "off duty"}
          </Badge>
          <span className="text-muted-foreground">Your availability is set by the dispatch manager.</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><SkeletonRows rows={5} /></div>
      ) : assignments.length === 0 ? (
        <EmptyState icon={Bike} title="No deliveries yet" body="When the manager assigns you an order it appears here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => (
            <Card key={a.id} className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-mono text-sm text-forest">{a.orderReference}</CardTitle>
                    <CardDescription>{a.customerName} · {formatGHS(a.orderTotal)}</CardDescription>
                  </div>
                  <DispatchStatusBadge status={a.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {a.address ?? "No address on file"}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {a.customerPhone}
                </p>
                {(NEXT_STATUSES[a.status] ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(NEXT_STATUSES[a.status] ?? []).map((n) => (
                      <Button
                        key={n.to}
                        size="sm"
                        variant={n.to === "failed" || n.to === "returned" ? "outline" : "default"}
                        className={n.to === "failed" || n.to === "returned" ? "border-red-300 text-red-800 hover:bg-red-50" : "bg-forest text-cream hover:bg-[#23503E]"}
                        onClick={() => { setStatusTarget({ assignment: a, to: n.to, label: n.label }); setReason(""); }}
                      >
                        {n.to === "failed" ? <XCircle className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                        {n.label}
                      </Button>
                    ))}
                  </div>
                ) : a.failureReason ? (
                  <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-800">Failure reason: {a.failureReason}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={statusTarget !== null} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{statusTarget?.label}</DialogTitle>
            <DialogDescription>{statusTarget ? `Delivery ${statusTarget.assignment.orderReference}` : undefined}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mine-reason">Reason (required for failed / returned)</Label>
            <Textarea id="mine-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={working}>Back</Button>
            <Button
              onClick={() => void applyStatus()}
              disabled={working}
              className={statusTarget && (statusTarget.to === "failed" || statusTarget.to === "returned") ? "bg-red-700 text-white hover:bg-red-800" : "bg-forest text-cream hover:bg-[#23503E]"}
            >
              {working ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
