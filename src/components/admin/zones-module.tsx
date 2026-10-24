"use client";

/** Delivery zones (spec §7): coverage areas, server-enforced fees and quote requirements. */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Info, MapPin, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatGHS } from "@/lib/client";
import type { AdminZoneListResponse, ZoneDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  ConfirmDialog,
  EmptyState,
  PesewasInput,
  SkeletonRows,
  apiDelete,
} from "@/components/admin/admin-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Humanises lead minutes, e.g. 45 → "45m", 105 → "1h 45m", 4320 → "3d". */
function leadLabel(min: number): string {
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440}d`;
  if (min >= 60 && min % 60 === 0) return `${min / 60}h`;
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function ZonesModule() {
  const { get, mutate } = useAdminApi();
  const [zones, setZones] = useState<ZoneDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ZoneDTO | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<ZoneDTO | null>(null);
  const [nonce, setNonce] = useState(0);
  // ZoneDTO does not expose `active`; track deactivations from this session so the
  // table can still badge them until the API returns the flag.
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<AdminZoneListResponse>("/api/admin/zones");
      if (!cancelled) {
        if (res) setZones(res.zones);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, nonce]);

  async function deactivate() {
    if (!deactivating) return;
    const target = deactivating;
    const res = await mutate(() => apiDelete(`/api/admin/zones?id=${encodeURIComponent(target.id)}`));
    if (res !== null) {
      toast.success(`${target.name} deactivated — it no longer appears at checkout.`);
      setDeactivatedIds((s) => new Set(s).add(target.id));
      setDeactivating(null);
    }
  }

  const list = zones ?? [];

  return (
    <div className="space-y-4">
      <Alert className="border-gold/50 bg-gold/5">
        <Info className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">How delivery zones work</AlertTitle>
        <AlertDescription className="text-amber-900/90">
          Zone fees are enforced server-side at checkout — customers can never override them. A zone with{" "}
          <strong>quote required</strong> blocks online checkout for its areas until the order is confirmed
          manually, so use it for long-distance routes (e.g. Accra runs) where pricing needs a human first.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${list.length} zone${list.length === 1 ? "" : "s"} · ordered by sort position`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
          <Button onClick={() => setEditing("new")} className="bg-forest text-cream hover:bg-[#23503E]">
            <Plus className="h-4 w-4" /> New zone
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !zones ? (
          <div className="p-4">
            <SkeletonRows rows={4} />
          </div>
        ) : list.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={MapPin}
              title="No delivery zones yet"
              body="Create the areas you deliver to — checkout matches the customer's address against them."
            />
          </div>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Areas</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Min subtotal</TableHead>
                  <TableHead>Lead time</TableHead>
                  <TableHead className="text-center">Quote required</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((z) => {
                  const inactive = deactivatedIds.has(z.id);
                  return (
                    <TableRow key={z.id}>
                      <TableCell>
                        <span className={inactive ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                          {z.name}
                        </span>
                        {inactive ? (
                          <Badge variant="outline" className="ml-2 border-red-300 bg-red-50 text-[11px] text-red-800">
                            Inactive
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="flex max-w-[260px] flex-wrap gap-1">
                          {z.areas.map((a) => (
                            <Badge key={a} variant="outline" className="border-border bg-muted/60 font-normal text-[11px]">
                              {a}
                            </Badge>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{z.fee > 0 ? formatGHS(z.fee) : "Free"}</TableCell>
                      <TableCell className="text-right">{z.minSubtotal > 0 ? formatGHS(z.minSubtotal) : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{leadLabel(z.leadMinutes)}</TableCell>
                      <TableCell className="text-center">
                        {z.requiresQuote ? (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                            Quote required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">
                            Instant checkout
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{z.note || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${z.name}`} onClick={() => setEditing(z)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Deactivate ${z.name}`}
                            disabled={inactive}
                            onClick={() => setDeactivating(z)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ZoneDialog
        open={editing !== null}
        zone={editing === "new" ? null : editing}
        assumeActive={editing !== null && editing !== "new" ? !deactivatedIds.has(editing.id) : true}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => setNonce((n) => n + 1)}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={deactivating ? `Deactivate zone “${deactivating.name}”?` : "Deactivate zone?"}
        description="Customers in its areas can no longer check out with delivery. Historical orders keep their zone snapshot."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => void deactivate()}
      />
    </div>
  );
}

function ZoneDialog({
  open,
  zone,
  assumeActive,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  zone: ZoneDTO | null;
  assumeActive: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { send } = useAdminApi();
  const [name, setName] = useState("");
  const [areas, setAreas] = useState("");
  const [fee, setFee] = useState<number | null>(0);
  const [minSubtotal, setMinSubtotal] = useState<number | null>(0);
  const [leadMinutes, setLeadMinutes] = useState("45");
  const [requiresQuote, setRequiresQuote] = useState(false);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  // Re-initialize the form whenever the editor opens for a different zone.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = open ? (zone?.id ?? "new") : null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (initKeyNow !== null) {
      setName(zone?.name ?? "");
      setAreas(zone?.areas.join(", ") ?? "");
      setFee(zone?.fee ?? 0);
      setMinSubtotal(zone?.minSubtotal ?? 0);
      setLeadMinutes(zone ? String(zone.leadMinutes) : "45");
      setRequiresQuote(zone?.requiresQuote ?? false);
      setNote(zone?.note ?? "");
      setActive(zone ? assumeActive : true);
      setSortOrder("0");
    }
  }

  async function save() {
    const cleanName = name.trim();
    if (cleanName.length < 2) return toast.error("Zone name must be at least 2 characters.");
    const areaList = areas.split(",").map((a) => a.trim()).filter(Boolean);
    if (areaList.length === 0) return toast.error("Add at least one area (comma-separated).");
    const lead = Math.round(Number(leadMinutes));
    if (!Number.isFinite(lead) || lead < 15 || lead > 10080) {
      return toast.error("Lead time must be between 15 and 10080 minutes.");
    }
    const sort = Math.round(Number(sortOrder) || 0);
    if (sort < 0 || sort > 999) return toast.error("Sort order must be between 0 and 999.");
    setSaving(true);
    const payload = {
      name: cleanName,
      areas: areaList,
      fee: fee ?? 0,
      minSubtotal: minSubtotal ?? 0,
      leadMinutes: lead,
      requiresQuote,
      note: note.trim(),
      active,
      sortOrder: sort,
    };
    const res = await send("/api/admin/zones", zone ? "PATCH" : "POST", zone ? { id: zone.id, ...payload } : payload);
    setSaving(false);
    if (res !== null) {
      toast.success(zone ? `Zone ${cleanName} updated.` : `Zone ${cleanName} created.`);
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{zone ? `Edit zone “${zone.name}”` : "New delivery zone"}</DialogTitle>
          <DialogDescription>
            Fees and minimum subtotals are charged in Ghana cedis and enforced at checkout.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="z-name">Zone name</Label>
              <Input id="z-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Accra long-distance" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="z-areas">Areas (comma-separated)</Label>
              <Input id="z-areas" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Osu, Labone, Airport Residential" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Delivery fee</Label>
              <PesewasInput value={fee} onChange={setFee} />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum subtotal (0 = none)</Label>
              <PesewasInput value={minSubtotal} onChange={setMinSubtotal} placeholder="none" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="z-lead">Lead time (minutes, 15–10080)</Label>
              <Input
                id="z-lead"
                type="number"
                min={15}
                max={10080}
                value={leadMinutes}
                onChange={(e) => setLeadMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="z-sort">Sort order (0–999)</Label>
              <Input id="z-sort" type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="z-note">Note</Label>
            <Input id="z-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown to customers at checkout" />
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Quote required</Label>
                <p className="text-xs text-muted-foreground">
                  Blocks online checkout for these areas until the order is confirmed manually — use for long-distance zones.
                </p>
              </div>
              <Switch checked={requiresQuote} onCheckedChange={setRequiresQuote} aria-label="Toggle quote required" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive zones are hidden from checkout.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Toggle zone active" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
            {saving ? "Saving…" : zone ? "Save changes" : "Create zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
