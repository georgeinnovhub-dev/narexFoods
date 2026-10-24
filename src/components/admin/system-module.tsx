"use client";

/** System: store controls, brand/contact/hours, payments config, integrations, outbox, audit log. */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Clock3,
  Coins,
  CreditCard,
  MailWarning,
  Save,
  Search,
  Send,
  ShieldAlert,
  Store,
} from "lucide-react";
import { formatDate } from "@/components/admin/admin-utils";
import type { AuditDTO, OutboxDTO } from "@/lib/types";
import type { SiteSettings } from "@/lib/settings";
import { useAdminApi } from "@/components/admin/admin-context";
import { OutboxStatusBadge, PesewasInput, SkeletonRows } from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Integrations {
  paystack: { enabled: boolean; secretConfigured: boolean; publicKey?: string; ready: boolean };
  zenobank: { enabled: boolean; ready: boolean; note: string };
  emailBridge: { configured: boolean; pending: number; failed: number; sent: number; bridgeConfigured?: boolean };
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function SystemModule() {
  return (
    <Tabs defaultValue="store" className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="store">Store & ordering</TabsTrigger>
        <TabsTrigger value="brand">Brand & contact</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="currency">Currency</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="outbox">Notifications</TabsTrigger>
        <TabsTrigger value="audit">Audit log</TabsTrigger>
      </TabsList>
      <TabsContent value="store"><StoreSettingsTab /></TabsContent>
      <TabsContent value="brand"><BrandTab /></TabsContent>
      <TabsContent value="payments"><PaymentsTab /></TabsContent>
      <TabsContent value="currency"><CurrencyTab /></TabsContent>
      <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
      <TabsContent value="outbox"><OutboxTab /></TabsContent>
      <TabsContent value="audit"><AuditTab /></TabsContent>
    </Tabs>
  );
}

function useSettings() {
  const { get } = useAdminApi();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await get<{ settings: SiteSettings; integrations: Integrations }>("/api/admin/settings");
    if (res) {
      setSettings(res.settings);
      setIntegrations(res.integrations);
    }
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<{ settings: SiteSettings; integrations: Integrations }>("/api/admin/settings");
      if (!cancelled) {
        if (res) {
          setSettings(res.settings);
          setIntegrations(res.integrations);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  return { settings, integrations, loading, load };
}

// ---------------- Store & ordering ----------------

function StoreSettingsTab() {
  const { settings, loading, load } = useSettings();
  const { send } = useAdminApi();
  const [orderingEnabled, setOrderingEnabled] = useState(true);
  const [pauseNote, setPauseNote] = useState("");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [baseFee, setBaseFee] = useState<number | null>(0);
  const [freeOver, setFreeOver] = useState<number | null>(null);
  const [areas, setAreas] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Tracks which settings snapshot the form was hydrated from; a fresh fetch re-hydrates.
  const [hydratedFrom, setHydratedFrom] = useState<SiteSettings | null>(null);

  if (settings && settings !== hydratedFrom) {
    setHydratedFrom(settings);
    setOrderingEnabled(settings.ordering.enabled);
    setPauseNote(settings.ordering.pauseNote);
    setDeliveryEnabled(settings.delivery.enabled);
    setBaseFee(settings.delivery.baseFee);
    setFreeOver(settings.delivery.freeOver);
    setAreas(settings.delivery.areas.join(", "));
    setDeliveryNote(settings.delivery.note);
  }

  async function save() {
    setSaving(true);
    const res = await send<{ settings: SiteSettings }>("/api/admin/settings", "PUT", {
      ordering: { enabled: orderingEnabled, pauseNote },
      delivery: {
        enabled: deliveryEnabled,
        baseFee: baseFee ?? 0,
        freeOver: freeOver,
        areas: areas.split(",").map((a) => a.trim()).filter(Boolean),
        note: deliveryNote,
      },
    });
    setSaving(false);
    if (res) {
      toast.success("Store settings saved.");
      await load();
    }
  }

  if (loading && !settings) return <CardSkeleton rows={6} />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base"><Store className="h-4 w-4 text-forest" /> Online ordering</CardTitle>
          <CardDescription>Pause checkout during rush hours or stock shortages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label>Ordering enabled</Label>
              <p className="text-xs text-muted-foreground">When off, the storefront shows the pause notice.</p>
            </div>
            <Switch checked={orderingEnabled} onCheckedChange={setOrderingEnabled} aria-label="Toggle ordering" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pause-note">Pause notice</Label>
            <Textarea id="pause-note" value={pauseNote} onChange={(e) => setPauseNote(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Delivery</CardTitle>
          <CardDescription>Fees are whole cedis×100 (pesewas) under the hood.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label>Delivery enabled</Label>
              <p className="text-xs text-muted-foreground">Customers only see delivery when this is on.</p>
            </div>
            <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} aria-label="Toggle delivery" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Base fee</Label>
              <PesewasInput value={baseFee} onChange={setBaseFee} />
            </div>
            <div className="space-y-1.5">
              <Label>Free delivery over (blank = never)</Label>
              <PesewasInput value={freeOver} onChange={setFreeOver} placeholder="none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-areas">Service areas (comma-separated)</Label>
            <Input id="d-areas" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Mampong-Akuapem, Akropong, Aburi" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-note">Delivery note</Label>
            <Input id="d-note" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save store settings"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Brand & contact ----------------

function BrandTab() {
  const { settings, loading, load } = useSettings();
  const { send } = useAdminApi();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Tracks which settings snapshot the form was hydrated from; a fresh fetch re-hydrates.
  const [hydratedFrom, setHydratedFrom] = useState<SiteSettings | null>(null);

  if (settings && settings !== hydratedFrom) {
    setHydratedFrom(settings);
    setName(settings.brand.name);
    setTagline(settings.brand.tagline);
    setPhone(settings.contact.phone);
    setWhatsapp(settings.contact.whatsapp);
    setEmail(settings.contact.email);
    setAddress(settings.contact.address);
    setHours({ ...settings.hours });
  }

  async function save() {
    setSaving(true);
    const res = await send<{ settings: SiteSettings }>("/api/admin/settings", "PUT", {
      brand: { name: name.trim() || "NAREX Foods", tagline },
      contact: { phone, whatsapp, email, address },
      hours,
    });
    setSaving(false);
    if (res) {
      toast.success("Brand, contact and hours saved.");
      await load();
    }
  }

  if (loading && !settings) return <CardSkeleton rows={6} />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Brand</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-tag">Tagline</Label>
            <Input id="b-tag" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Contact</CardTitle>
          <CardDescription>Shown in the storefront footer and on WhatsApp handoff.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-wa">WhatsApp</Label>
            <Input id="c-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-addr">Address</Label>
            <Input id="c-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-forest" /> Opening hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DAYS.map((day) => (
              <div key={day} className="space-y-1.5">
                <Label htmlFor={`h-${day}`} className="capitalize">{day}</Label>
                <Input id={`h-${day}`} value={hours[day] ?? ""} onChange={(e) => setHours((h) => ({ ...h, [day]: e.target.value }))} placeholder="08:00 – 18:00" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save brand & contact"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Payments ----------------

function PaymentsTab() {
  const { settings, loading, load } = useSettings();
  const { send } = useAdminApi();
  const [manualEnabled, setManualEnabled] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");
  const [instructions, setInstructions] = useState("");
  const [paystackEnabled, setPaystackEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [saving, setSaving] = useState(false);
  // Tracks which settings snapshot the form was hydrated from; a fresh fetch re-hydrates.
  const [hydratedFrom, setHydratedFrom] = useState<SiteSettings | null>(null);

  if (settings && settings !== hydratedFrom) {
    setHydratedFrom(settings);
    setManualEnabled(settings.payments.manual.enabled);
    setRecipientName(settings.payments.manual.recipientName);
    setMethod(settings.payments.manual.method);
    setDetails(settings.payments.manual.details);
    setInstructions(settings.payments.manual.instructions);
    setPaystackEnabled(settings.payments.paystack.enabled);
    setPublicKey(settings.payments.paystack.publicKey ?? "");
  }

  async function save() {
    setSaving(true);
    const res = await send<{ settings: SiteSettings }>("/api/admin/settings", "PUT", {
      payments: {
        manual: { enabled: manualEnabled, recipientName, method, details, instructions },
        paystack: { enabled: paystackEnabled, publicKey },
      },
    });
    setSaving(false);
    if (res) {
      toast.success("Payment settings saved.");
      await load();
    }
  }

  if (loading && !settings) return <CardSkeleton rows={6} />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-forest" /> Manual / mobile money</CardTitle>
          <CardDescription>Customers transfer, then upload evidence for staff review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label>Accept manual payments</Label>
            <Switch checked={manualEnabled} onCheckedChange={setManualEnabled} aria-label="Toggle manual payments" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pm-name">Account name</Label>
              <Input id="pm-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-method">Method label</Label>
              <Input id="pm-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Mobile Money (MTN)" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-details">Payment details</Label>
            <Input id="pm-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="MTN MoMo · 0559291195 · NAREX Foods" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-instr">Customer instructions</Label>
            <Textarea id="pm-instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Paystack</CardTitle>
          <CardDescription>Card &amp; mobile money checkout. The secret key lives in server env only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label>Paystack enabled</Label>
            <Switch checked={paystackEnabled} onCheckedChange={setPaystackEnabled} aria-label="Toggle Paystack" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-pub">Public key</Label>
            <Input id="ps-pub" value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pk_test_…" className="font-mono text-xs" />
          </div>
          <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            Enable Paystack only after the secret key (<code className="font-mono">PAYSTACK_SECRET_KEY</code>) is configured on the server —
            the readiness card on the Integrations tab confirms it. Secret keys are never stored in settings or returned to the browser.
          </p>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save payment settings"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Currency (display estimates only — charged currency stays GHS) ----------------

const CURRENCY_CODE_OPTIONS = ["USD", "GBP", "EUR", "NGN", "CAD"] as const;

function CurrencyTab() {
  const { settings, loading, load } = useSettings();
  const { send } = useAdminApi();
  const [enabled, setEnabled] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [refreshMinutes, setRefreshMinutes] = useState("60");
  const [markupPercent, setMarkupPercent] = useState("0");
  const [saving, setSaving] = useState(false);
  // Tracks which settings snapshot the form was hydrated from; a fresh fetch re-hydrates.
  const [hydratedFrom, setHydratedFrom] = useState<SiteSettings | null>(null);

  if (settings && settings !== hydratedFrom) {
    setHydratedFrom(settings);
    setEnabled(settings.currency.enabled);
    setCodes(settings.currency.codes.filter((c) => (CURRENCY_CODE_OPTIONS as readonly string[]).includes(c)));
    setRefreshMinutes(String(settings.currency.refreshMinutes));
    setMarkupPercent(String(settings.currency.markupPercent));
  }

  function toggleCode(code: string, on: boolean) {
    setCodes((cur) => (on ? (cur.includes(code) ? cur : [...cur, code]) : cur.filter((c) => c !== code)));
  }

  async function save() {
    if (enabled && codes.length === 0) {
      toast.error("Enable at least one currency code, or switch estimates off.");
      return;
    }
    const refresh = Math.round(Number(refreshMinutes));
    if (!Number.isFinite(refresh) || refresh < 5 || refresh > 1440) {
      toast.error("Rate refresh interval must be between 5 and 1440 minutes.");
      return;
    }
    const markup = Math.round(Number(markupPercent));
    if (!Number.isFinite(markup) || markup < 0 || markup > 20) {
      toast.error("Display markup must be between 0 and 20 percent.");
      return;
    }
    setSaving(true);
    const res = await send<{ settings: SiteSettings }>("/api/admin/settings", "PUT", {
      currency: {
        enabled,
        codes: enabled ? CURRENCY_CODE_OPTIONS.filter((c) => codes.includes(c)) : codes,
        refreshMinutes: refresh,
        markupPercent: markup,
      },
    });
    setSaving(false);
    if (res) {
      toast.success("Currency settings saved.");
      await load();
    }
  }

  if (loading && !settings) return <CardSkeleton rows={4} />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-forest" /> Converted price estimates
          </CardTitle>
          <CardDescription>
            Customers always pay in Ghana cedis — converted amounts are display-only estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label>Show converted price estimates</Label>
              <p className="text-xs text-muted-foreground">
                When on, the storefront can show approximate prices in the currencies below.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Toggle currency estimates" />
          </div>
          <div className="space-y-1.5">
            <Label>Currencies offered as estimates</Label>
            <div className="flex flex-wrap gap-2">
              {CURRENCY_CODE_OPTIONS.map((code) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium has-[[data-state=checked]]:border-forest/40 has-[[data-state=checked]]:bg-forest/5"
                >
                  <Checkbox
                    checked={codes.includes(code)}
                    onCheckedChange={(c) => toggleCode(code, c === true)}
                    aria-label={`Offer ${code} estimates`}
                  />
                  {code}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Rates & markup</CardTitle>
          <CardDescription>Rates are fetched from a public provider and cached; refresh prudently.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cur-refresh">Rate refresh interval (minutes, 5–1440)</Label>
              <Input
                id="cur-refresh"
                type="number"
                min={5}
                max={1440}
                value={refreshMinutes}
                onChange={(e) => setRefreshMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cur-markup">Display markup (%, 0–20)</Label>
              <Input
                id="cur-markup"
                type="number"
                min={0}
                max={20}
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
              />
            </div>
          </div>
          <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            The optional markup is a buffer applied to converted estimates only — it is never added to the charged
            GHS total, and stale rates fall back to the last successful fetch.
          </p>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save currency settings"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Integrations ----------------

function IntegrationsTab() {
  const { integrations, loading } = useSettings();

  if (loading && !integrations) return <CardSkeleton rows={3} />;
  if (!integrations) return null;

  const cards = [
    {
      title: "Paystack",
      icon: CreditCard,
      ready: integrations.paystack.ready,
      rows: [
        ["Enabled", integrations.paystack.enabled ? "yes" : "no"],
        ["Secret key on server", integrations.paystack.secretConfigured ? "yes" : "not configured"],
        ["Ready for checkout", integrations.paystack.ready ? "yes" : "no"],
      ] as [string, string][],
    },
    {
      title: "Zenobank",
      icon: ShieldAlert,
      ready: false,
      rows: [["Status", "awaiting credentials"], ["Note", integrations.zenobank.note]] as [string, string][],
    },
    {
      title: "Email bridge",
      icon: MailWarning,
      ready: integrations.emailBridge.configured,
      rows: [
        ["Bridge URL configured", integrations.emailBridge.configured ? "yes" : "no"],
        ["Pending", String(integrations.emailBridge.pending)],
        ["Failed", String(integrations.emailBridge.failed)],
        ["Sent", String(integrations.emailBridge.sent)],
      ] as [string, string][],
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title} className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><c.icon className="h-4 w-4 text-forest" /> {c.title}</span>
              <Badge variant="outline" className={c.ready ? "border-green-300 bg-green-50 text-green-800" : "border-amber-300 bg-amber-50 text-amber-900"}>
                {c.ready ? "ready" : "pending"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {c.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Outbox ----------------

function OutboxTab() {
  const { get, send } = useAdminApi();
  const [items, setItems] = useState<OutboxDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);

  const load = useCallback(async () => {
    const res = await get<{ health: { pending: number; failed: number; sent: number }; items: OutboxDTO[] }>("/api/admin/notifications");
    if (res) setItems(res.items);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<{ health: { pending: number; failed: number; sent: number }; items: OutboxDTO[] }>("/api/admin/notifications");
      if (!cancelled) {
        if (res) setItems(res.items);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  async function drain() {
    setDraining(true);
    const res = await send<{ success: boolean; sent?: number; failed?: number; message?: string }>("/api/admin/settings", "POST");
    setDraining(false);
    if (res) {
      if (res.success) toast.success(`Outbox drained — ${res.sent ?? 0} sent, ${res.failed ?? 0} failed.`);
      else toast.info(res.message ?? "Nothing to send.");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Every customer email is queued here first — ordering never blocks on delivery.</p>
        <Button onClick={() => void drain()} disabled={draining} className="bg-forest text-cream hover:bg-[#23503E]">
          <Send className="h-4 w-4" /> {draining ? "Sending…" : "Drain outbox now"}
        </Button>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !items ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : (items ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Outbox is empty.</p>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[260px] truncate font-medium">{i.subject}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[11px]">{i.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{i.recipient ?? "—"}</TableCell>
                    <TableCell><OutboxStatusBadge status={i.status} /></TableCell>
                    <TableCell className="text-center">{i.attempts}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(i.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Audit log ----------------

function AuditTab() {
  const { get } = useAdminApi();
  const [events, setEvents] = useState<AuditDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 25;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (actionFilter !== "all") params.set("action", actionFilter);
      const res = await get<{ total: number; events: AuditDTO[] }>(`/api/admin/audit?${params.toString()}`);
      if (!cancelled) {
        if (res) {
          setEvents(res.events);
          setTotal(res.total);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, page, actionFilter]);

  useEffect(() => {
    const t = setTimeout(() => setActionFilter(searchDraft.trim() || "all"), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Filter by action e.g. payment.approve" className="pl-9" aria-label="Filter audit log" />
          </div>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} events</p>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {loading && !events ? (
            <div className="p-4"><SkeletonRows rows={8} /></div>
          ) : (events ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No audit events match.</p>
          ) : (
            <div className="max-h-[62vh] overflow-auto">
              <Table className="min-w-[720px]">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(events ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="font-mono text-[11px]">{e.action}</Badge>
                          </TooltipTrigger>
                          {Object.keys(e.meta ?? {}).length > 0 ? (
                            <TooltipContent className="max-w-72 break-all text-xs">
                              <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(e.meta, null, 1)}</pre>
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                      </TableCell>
                      <TableCell>{e.actor}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{e.target ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <SkeletonRows rows={rows} />
    </div>
  );
}
