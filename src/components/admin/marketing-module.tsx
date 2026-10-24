"use client";

/** Marketing: coupon codes and site campaigns with engagement counters. */

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  Tag,
  Ticket,
  Trash2,
  XOctagon,
} from "lucide-react";
import { apiGet, apiSend, formatGHS } from "@/lib/client";
import type { CouponDTO, CampaignAdminDTO, ProductDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  CampaignStatusBadge,
  ConfirmDialog,
  EmptyState,
  errMessage,
  PesewasInput,
  SkeletonRows,
  uploadImage,
  formatDate,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

export function MarketingModule() {
  return (
    <Tabs defaultValue="coupons" className="space-y-4">
      <TabsList>
        <TabsTrigger value="coupons" className="gap-2"><Ticket className="h-4 w-4" /> Coupons</TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
      </TabsList>
      <TabsContent value="coupons"><CouponsTab /></TabsContent>
      <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
    </Tabs>
  );
}

// ---------------- Coupons ----------------

function CouponsTab() {
  const { get } = useAdminApi();
  const [coupons, setCoupons] = useState<CouponDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CouponDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<CouponDTO | null>(null);

  const load = useCallback(async () => {
    const res = await get<{ coupons: CouponDTO[] }>("/api/admin/coupons");
    if (res) setCoupons(res.coupons);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<{ coupons: CouponDTO[] }>("/api/admin/coupons");
      if (!cancelled) {
        if (res) setCoupons(res.coupons);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function toggleActive(c: CouponDTO) {
    try {
      await apiSend("/api/admin/coupons", "PATCH", { id: c.id, active: !c.active });
      toast.success(`${c.code} ${c.active ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await apiSend(`/api/admin/coupons?id=${encodeURIComponent(deleting.id)}`, "DELETE");
      toast.success(`Coupon ${deleting.code} deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Codes are validated server-side against the live cart subtotal.</p>
        <Button onClick={() => setEditing("new")} className="bg-forest text-cream hover:bg-[#23503E]">
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !coupons ? (
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : (coupons ?? []).length === 0 ? (
          <div className="p-4"><EmptyState icon={Ticket} title="No coupons yet" body="Create a welcome discount to nudge first orders." /></div>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Min subtotal</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(coupons ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold text-forest">{c.code}</TableCell>
                    <TableCell>
                      {c.type === "percent" ? (
                        <Badge variant="outline" className="border-gold text-amber-800"><Percent className="mr-1 h-3 w-3" />{c.value}% off</Badge>
                      ) : (
                        <Badge variant="outline" className="border-gold text-amber-800"><Tag className="mr-1 h-3 w-3" />{formatGHS(c.value)} off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.minSubtotal > 0 ? formatGHS(c.minSubtotal) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.startsAt ? formatDate(c.startsAt) : "anytime"} → {c.endsAt ? formatDate(c.endsAt) : "no expiry"}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{c.redeemedCount}</span>
                      <span className="text-muted-foreground">{c.maxRedemptions ? ` / ${c.maxRedemptions}` : " / ∞"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={c.active} onCheckedChange={() => void toggleActive(c)} aria-label={`Toggle ${c.code}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Delete ${c.code}`} onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CouponDialog open={editing !== null} coupon={editing === "new" ? null : editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete coupon ${deleting.code}?` : "Delete coupon?"}
        description="Customers can no longer redeem it. Past redemptions stay in order history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function CouponDialog({
  open,
  coupon,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  coupon: CouponDTO | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [percent, setPercent] = useState(10);
  const [fixed, setFixed] = useState<number | null>(500);
  const [minSubtotal, setMinSubtotal] = useState<number | null>(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Re-initialize the form whenever the editor opens for a different coupon.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = open ? (coupon?.id ?? "new") : null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (initKeyNow !== null) {
      setCode(coupon?.code ?? "");
      setType((coupon?.type as "percent" | "fixed") ?? "percent");
      setPercent(coupon?.type === "percent" ? coupon.value : 10);
      setFixed(coupon?.type === "fixed" ? coupon.value : 500);
      setMinSubtotal(coupon?.minSubtotal ?? 0);
      setStartsAt(coupon?.startsAt ? toLocalInput(coupon.startsAt) : "");
      setEndsAt(coupon?.endsAt ? toLocalInput(coupon.endsAt) : "");
      setMaxRedemptions(coupon?.maxRedemptions ? String(coupon.maxRedemptions) : "");
      setActive(coupon?.active ?? true);
    }
  }

  function toIso(local: string): string | undefined {
    if (!local) return undefined;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  async function save() {
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,30}$/.test(cleanCode)) return toast.error("Code must be 2–30 letters/numbers (no spaces).");
    const value = type === "percent" ? Math.round(percent) : (fixed ?? 0);
    if (value < 1) return toast.error("Discount value must be at least 1.");
    if (type === "percent" && value > 100) return toast.error("Percentage discount cannot exceed 100.");
    setSaving(true);
    const payload = {
      code: cleanCode,
      type,
      value,
      minSubtotal: minSubtotal ?? 0,
      ...(toIso(startsAt) ? { startsAt: toIso(startsAt) } : {}),
      ...(toIso(endsAt) ? { endsAt: toIso(endsAt) } : {}),
      ...(maxRedemptions.trim() ? { maxRedemptions: Math.max(1, Math.round(Number(maxRedemptions)) || 1) } : {}),
      active,
    };
    const res = await send(coupon ? "/api/admin/coupons" : "/api/admin/coupons", coupon ? "PATCH" : "POST", coupon ? { id: coupon.id, ...payload } : payload);
    setSaving(false);
    if (res !== null) {
      toast.success(coupon ? "Coupon updated." : `Coupon ${cleanCode} created.`);
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{coupon ? `Edit ${coupon.code}` : "New coupon"}</DialogTitle>
          <DialogDescription>{coupon ? "Code, type and window can be changed." : "Percent discounts apply to the food subtotal."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-code">Code</Label>
              <Input id="c-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "percent" ? (
            <div className="space-y-1.5">
              <Label htmlFor="c-percent">Discount (%)</Label>
              <Input id="c-percent" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Discount amount</Label>
              <PesewasInput value={fixed} onChange={setFixed} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Minimum subtotal (0 = none)</Label>
            <PesewasInput value={minSubtotal} onChange={setMinSubtotal} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-start">Starts</Label>
              <Input id="c-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end">Ends</Label>
              <Input id="c-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="c-max">Max redemptions (blank = ∞)</Label>
              <Input id="c-max" type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={active} onCheckedChange={(c) => setActive(c === true)} /> Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : coupon ? "Save changes" : "Create coupon"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Campaigns ----------------

const MEAL_TIME_LABELS: Record<string, string> = {
  any: "Any time",
  breakfast: "Breakfast",
  lunch: "Lunch",
  supper: "Supper",
};

function CampaignsTab() {
  const { get } = useAdminApi();
  const [campaigns, setCampaigns] = useState<CampaignAdminDTO[] | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CampaignAdminDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<CampaignAdminDTO | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<{ campaigns: CampaignAdminDTO[] }>("/api/admin/campaigns");
      // Product names enrich the exact-dish targeting picker; /api/admin/products is
      // menu.manage-gated, so marketing-only roles silently get an empty list.
      const prods = await apiGet<{ products: ProductDTO[] }>("/api/admin/products")
        .then((r) => r.products.map((p) => ({ id: p.id, name: p.name })))
        .catch(() => [] as { id: string; name: string }[]);
      if (!cancelled) {
        if (res) setCampaigns(res.campaigns);
        setProducts(prods);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, nonce]);

  const productName = useCallback(
    (id: string) => products.find((p) => p.id === id)?.name,
    [products]
  );

  const totals = (campaigns ?? []).reduce(
    (acc, c) => ({ impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks, dismissals: acc.dismissals + c.dismissals }),
    { impressions: 0, clicks: 0, dismissals: 0 }
  );
  const ctr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : "0.0";

  async function setStatus(c: CampaignAdminDTO, status: string) {
    const res = await patchCampaign({ id: c.id, status });
    if (res !== null) {
      toast.success(`Campaign “${c.title}” → ${status}.`);
      setNonce((n) => n + 1);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await apiSend(`/api/admin/campaigns?id=${encodeURIComponent(deleting.id)}`, "DELETE");
      toast.success("Campaign deleted.");
      setDeleting(null);
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">Impressions</p><p className="text-xl font-bold">{totals.impressions.toLocaleString()}</p></Card>
        <Card className="rounded-2xl p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">Clicks</p><p className="text-xl font-bold">{totals.clicks.toLocaleString()}</p></Card>
        <Card className="rounded-2xl p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">Dismissals</p><p className="text-xl font-bold">{totals.dismissals.toLocaleString()}</p></Card>
        <Card className="rounded-2xl p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">Click-through</p><p className="text-xl font-bold text-forest">{ctr}%</p></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Popups and banners shown on the storefront.</p>
        <Button onClick={() => setEditing("new")} className="bg-forest text-cream hover:bg-[#23503E]">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !campaigns ? (
          <div className="p-4"><SkeletonRows rows={3} /></div>
        ) : (campaigns ?? []).length === 0 ? (
          <div className="p-4"><EmptyState icon={Megaphone} title="No campaigns yet" body="Announce a weekend special to returning customers." /></div>
        ) : (
          <div className="max-h-[56vh] overflow-auto">
            <Table className="min-w-[860px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Targeting</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="max-w-[200px] truncate font-medium">{c.title}</p>
                      <p className="max-w-[220px] truncate text-xs text-muted-foreground">{c.message}</p>
                      {c.productId || (c.mealTime && c.mealTime !== "any") ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {c.productId ? (
                            <Badge variant="outline" className="border-teal-300 bg-teal-50 text-[11px] text-teal-900">
                              Exact dish: {productName(c.productId) ?? "selected product"}
                            </Badge>
                          ) : null}
                          {c.mealTime && c.mealTime !== "any" ? (
                            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-[11px] text-orange-900">
                              {MEAL_TIME_LABELS[c.mealTime] ?? c.mealTime}
                            </Badge>
                          ) : null}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.placement}</Badge></TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.startsAt ? formatDate(c.startsAt) : "now"} → {c.endsAt ? formatDate(c.endsAt) : "no end"}
                      <span className="block">priority {c.priority}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.audience} · {c.device} · {c.pageTarget}</TableCell>
                    <TableCell className="text-right text-xs">
                      <span className="flex items-center justify-end gap-1"><MousePointerClick className="h-3 w-3" /> {c.clicks}</span>
                      <span className="text-muted-foreground">{c.impressions} views · {c.dismissals} ✕</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${c.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Status workflow</DropdownMenuLabel>
                          {["active", "paused", "scheduled", "expired", "draft"].map((s) => (
                            <DropdownMenuItem key={s} disabled={c.status === s} onClick={() => void setStatus(c, s)}>
                              {s === "active" ? <MousePointerClick className="h-4 w-4" /> : s === "expired" ? <XOctagon className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                              Mark {s}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" /> Edit campaign
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
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

      <CampaignDialog
        open={editing !== null}
        campaign={editing === "new" ? null : editing}
        products={products}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => setNonce((n) => n + 1)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete “${deleting.title}”?` : "Delete campaign?"}
        description="This removes the campaign and its engagement history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}

async function patchCampaign(body: Record<string, unknown>): Promise<unknown> {
  return apiSend("/api/admin/campaigns", "PATCH", body).catch((err: unknown) => {
    toast.error(errMessage(err));
    return null;
  });
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CampaignDialog({
  open,
  campaign,
  products,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  campaign: CampaignAdminDTO | null;
  products: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { send } = useAdminApi();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [placement, setPlacement] = useState<"popup" | "banner">("popup");
  const [status, setStatus] = useState("draft");
  const [priority, setPriority] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [audience, setAudience] = useState("all");
  const [pageTarget, setPageTarget] = useState("all");
  const [device, setDevice] = useState("all");
  const [productId, setProductId] = useState<string | null>(null);
  const [mealTime, setMealTime] = useState<"any" | "breakfast" | "lunch" | "supper">("any");
  const [showOnce, setShowOnce] = useState(true);
  const [saving, setSaving] = useState(false);

  // Re-initialize the form whenever the editor opens for a different campaign.
  const [initKey, setInitKey] = useState<string | null>(null);
  const initKeyNow = open ? (campaign?.id ?? "new") : null;
  if (initKeyNow !== initKey) {
    setInitKey(initKeyNow);
    if (initKeyNow !== null) {
      setTitle(campaign?.title ?? "");
      setMessage(campaign?.message ?? "");
      setImage(campaign?.image ?? null);
      setCtaLabel(campaign?.ctaLabel ?? "");
      setCtaUrl(campaign?.ctaUrl ?? "");
      setPlacement(campaign?.placement ?? "popup");
      setStatus(campaign?.status ?? "draft");
      setPriority(campaign?.priority ?? 0);
      setStartsAt(campaign?.startsAt ? toLocalInput(campaign.startsAt) : "");
      setEndsAt(campaign?.endsAt ? toLocalInput(campaign.endsAt) : "");
      setAudience(campaign?.audience ?? "all");
      setPageTarget(campaign?.pageTarget ?? "all");
      setDevice(campaign?.device ?? "all");
      setProductId(campaign?.productId ?? null);
      setMealTime(campaign?.mealTime ?? "any");
      setShowOnce(campaign?.showOnce ?? true);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) setImage(url);
  }

  function toIso(local: string): string | undefined {
    if (!local) return undefined;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  async function save() {
    if (title.trim().length < 2) return toast.error("Campaign title is too short.");
    if (message.trim().length < 2) return toast.error("Campaign message is too short.");
    setSaving(true);
    const payload = {
      title: title.trim(),
      message: message.trim(),
      image: image ?? null,
      ctaLabel: ctaLabel.trim() || null,
      ctaUrl: ctaUrl.trim() || null,
      placement,
      status,
      priority: Math.max(0, Math.min(100, Math.round(priority) || 0)),
      ...(toIso(startsAt) ? { startsAt: toIso(startsAt) } : {}),
      ...(toIso(endsAt) ? { endsAt: toIso(endsAt) } : {}),
      audience,
      pageTarget: pageTarget.trim() || "all",
      device,
      productId,
      mealTime,
      showOnce,
    };
    const res = await send(
      "/api/admin/campaigns",
      campaign ? "PATCH" : "POST",
      campaign ? { id: campaign.id, status, priority: payload.priority, productId, mealTime } : payload
    );
    setSaving(false);
    if (res !== null) {
      toast.success(campaign ? "Campaign updated." : "Campaign created.");
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{campaign ? `Edit “${campaign.title}”` : "New campaign"}</DialogTitle>
          <DialogDescription>
            {campaign
              ? "Status, priority and schedule can be changed here — full edits create a new campaign."
              : "Popups appear once per visitor by default; banners sit at the top of the page."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cp-title">Title</Label>
            <Input id="cp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend Waakye Special" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-msg">Message</Label>
            <Textarea id="cp-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Order any family pack this weekend and get free delivery." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Placement</Label>
              <Select value={placement} onValueChange={(v) => setPlacement(v as "popup" | "banner")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popup">Popup</SelectItem>
                  <SelectItem value="banner">Banner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["draft", "scheduled", "active", "paused", "expired"].map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-cta">CTA label</Label>
              <Input id="cp-cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Order now" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-url">CTA link</Label>
              <Input id="cp-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/menu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-priority">Priority</Label>
              <Input id="cp-priority" type="number" min={0} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cp-start">Starts</Label>
              <Input id="cp-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-end">Ends</Label>
              <Input id="cp-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="new">New customers</SelectItem>
                  <SelectItem value="returning">Returning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Device</Label>
              <Select value={device} onValueChange={setDevice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-target">Page target</Label>
              <Input id="cp-target" value={pageTarget} onChange={(e) => setPageTarget(e.target.value)} placeholder="all" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Exact dish (optional)</Label>
              {products.length === 0 ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Product list unavailable for your role — campaigns will target all dishes.
                </p>
              ) : (
                <Select
                  value={productId ?? "none"}
                  onValueChange={(v) => setProductId(v === "none" ? null : v)}
                >
                  <SelectTrigger aria-label="Exact dish">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any product</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Meal time</Label>
              <Select value={mealTime} onValueChange={(v) => setMealTime(v as "any" | "breakfast" | "lunch" | "supper")}>
                <SelectTrigger aria-label="Meal time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="supper">Supper</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label>Campaign image</Label>
              {image ? (
                <div className="mt-2 flex items-center gap-2">
                  <img src={image} alt="Campaign visual" className="h-12 w-20 rounded-lg border border-border object-cover" />
                  <Button variant="ghost" size="sm" onClick={() => setImage(null)}>Remove</Button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Optional banner/popup artwork.</p>
              )}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                {uploading ? "Uploading…" : "Upload"}
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleFile(e)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showOnce} onCheckedChange={setShowOnce} /> Show once per visitor
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : campaign ? "Save changes" : "Create campaign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
