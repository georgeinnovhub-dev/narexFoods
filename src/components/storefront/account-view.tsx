"use client";

/**
 * Customer account area (spec §16) — self-service auth, profile, saved
 * addresses and order history. Mounted for view === "account".
 * Guests see Sign in / Create account; signed-in customers see the dashboard.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { apiGet, apiSend } from "@/lib/client";
import { useCurrency } from "./currency-context";
import { StatusBadge } from "./status-badge";
import { apiErrorStatus, Eyebrow } from "./storefront-lib";
import type { AccountMeResponse, OrderDTO, SavedAddressDTO, ZoneDTO } from "@/lib/types";

const PHONE_REGEX = /^[0-9+\s-]{9,15}$/;

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid Ghanaian phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name"),
  phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid phone number"),
});

const addressSchema = z.object({
  label: z.string().trim().min(1, "Give this address a label (e.g. Home, Office)"),
  address: z.string().trim().min(5, "Enter the full delivery address"),
  landmark: z.string().trim().max(200).optional(),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type ProfileValues = z.infer<typeof profileSchema>;
type AddressValues = z.infer<typeof addressSchema>;

/** Small password field with an accessible show/hide toggle. */
function PasswordInput({
  id,
  placeholder,
  error,
  autoComplete,
  registration,
}: {
  id: string;
  placeholder: string;
  error?: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="min-h-11 rounded-xl pr-11"
          aria-invalid={Boolean(error)}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function AuthPanel() {
  const setCustomer = useAppStore((s) => s.setCustomer);
  const [signInBusy, setSignInBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);

  const signIn = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });

  async function onSignIn(values: LoginValues) {
    setSignInBusy(true);
    try {
      const res = await apiSend<{ customer: { id: string; name: string; email: string } }>(
        "/api/account/login",
        "POST",
        values
      );
      setCustomer(res.customer);
      toast.success(`Welcome back, ${res.customer.name.split(" ")[0]}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setSignInBusy(false);
    }
  }

  async function onRegister(values: RegisterValues) {
    setRegisterBusy(true);
    try {
      const res = await apiSend<{ customer: { id: string; name: string; email: string } }>(
        "/api/account/register",
        "POST",
        values
      );
      setCustomer(res.customer);
      toast.success(`Your account is ready — welcome, ${res.customer.name.split(" ")[0]}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setRegisterBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 md:py-14">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-forest text-cream shadow-sm">
          <UserRound className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-forest">Your NAREX account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Save your delivery addresses, reorder in two taps and keep every order in one place.
        </p>
      </div>

      <Card className="mt-8 rounded-2xl shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-full bg-muted/60 p-1.5">
              <TabsTrigger
                value="signin"
                className="min-h-9 rounded-full text-sm data-[state=active]:bg-forest data-[state=active]:text-cream"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="min-h-9 rounded-full text-sm data-[state=active]:bg-forest data-[state=active]:text-cream"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn.handleSubmit(onSignIn)} noValidate className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-email">Email</Label>
                  <Input
                    id="acc-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(signIn.formState.errors.email)}
                    className="min-h-11 rounded-xl"
                    {...signIn.register("email")}
                  />
                  {signIn.formState.errors.email && (
                    <p className="text-xs font-medium text-destructive">{signIn.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acc-password">Password</Label>
                  <PasswordInput
                    id="acc-password"
                    placeholder="Your password"
                    autoComplete="current-password"
                    error={signIn.formState.errors.password?.message}
                    registration={signIn.register("password")}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signInBusy}
                  className="min-h-11 w-full rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                >
                  {signInBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={registerForm.handleSubmit(onRegister)} noValidate className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Full name</Label>
                  <Input
                    id="reg-name"
                    autoComplete="name"
                    placeholder="Ama Mensah"
                    aria-invalid={Boolean(registerForm.formState.errors.name)}
                    className="min-h-11 rounded-xl"
                    {...registerForm.register("name")}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-xs font-medium text-destructive">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(registerForm.formState.errors.email)}
                    className="min-h-11 rounded-xl"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs font-medium text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">Phone number</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0559 291 195"
                    aria-invalid={Boolean(registerForm.formState.errors.phone)}
                    className="min-h-11 rounded-xl"
                    {...registerForm.register("phone")}
                  />
                  {registerForm.formState.errors.phone && (
                    <p className="text-xs font-medium text-destructive">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password (min 8 characters)</Label>
                  <PasswordInput
                    id="reg-password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    error={registerForm.formState.errors.password?.message}
                    registration={registerForm.register("password")}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={registerBusy}
                  className="min-h-11 w-full rounded-xl bg-forest font-semibold text-cream hover:bg-forest/90"
                >
                  {registerBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Create account"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We only ask for what we need to deliver your food — nothing more, and we never sell your data.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signed-in dashboard                                                 */
/* ------------------------------------------------------------------ */

function ProfileCard({ me, onUpdated }: { me: AccountMeResponse; onUpdated: (me: AccountMeResponse) => void }) {
  const setCustomer = useAppStore((s) => s.setCustomer);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.customer.name, phone: me.customer.phone },
  });

  /* Render-phase hydration: re-seed the fields whenever the dialog opens
     (or the profile changes) with a fresh identity. */
  const [formKey, setFormKey] = useState("");
  const nextKey = open ? `${me.customer.id}-${me.customer.name}-${me.customer.phone}` : "";
  if (nextKey !== formKey) {
    setFormKey(nextKey);
    if (nextKey) {
      form.reset({ name: me.customer.name, phone: me.customer.phone });
    }
  }

  async function onSave(values: ProfileValues) {
    setBusy(true);
    try {
      const res = await apiSend<{ customer: { id: string; name: string; email: string; phone: string } }>(
        "/api/account/me",
        "PATCH",
        values
      );
      onUpdated({ ...me, customer: res.customer });
      setCustomer({ id: res.customer.id, name: res.customer.name, email: res.customer.email });
      setOpen(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-forest">Profile</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="min-h-9 gap-1.5 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{me.customer.name}</p>
          <p className="text-muted-foreground">{me.customer.email}</p>
          <p className="text-muted-foreground">{me.customer.phone || "No phone saved"}</p>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-forest">Edit profile</DialogTitle>
            <DialogDescription>Update the name and phone we use for your orders.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSave)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Full name</Label>
              <Input
                id="prof-name"
                autoComplete="name"
                className="min-h-11 rounded-xl"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone">Phone number</Label>
              <Input
                id="prof-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="min-h-11 rounded-xl"
                aria-invalid={Boolean(form.formState.errors.phone)}
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-full bg-forest font-semibold text-cream hover:bg-forest/90"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AddAddressDialog({
  open,
  onOpenChange,
  zones,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: ZoneDTO[];
  onSaved: (address: SavedAddressDTO) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneTouched, setZoneTouched] = useState(false);
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: "", address: "", landmark: "" },
  });

  /* Render-phase hydration with an identity key (dialog opens → fresh form). */
  const [formKey, setFormKey] = useState("");
  const nextKey = open ? "open" : "";
  if (nextKey !== formKey) {
    setFormKey(nextKey);
    if (nextKey) {
      form.reset({ label: "", address: "", landmark: "" });
      setZoneName("");
      setZoneTouched(false);
    }
  }

  /* Auto-suggest the delivery zone from the typed address (render-phase sync,
     until the customer overrides it). */
  const addressValue = form.watch("address");
  const suggestedZone = useMemo(() => {
    const q = addressValue.trim().toLowerCase();
    if (q.length < 4) return null;
    return zones.find((zone) => zone.areas.some((a) => q.includes(a.toLowerCase()))) ?? null;
  }, [addressValue, zones]);
  if (!zoneTouched && (suggestedZone?.name ?? "") !== zoneName) {
    setZoneName(suggestedZone?.name ?? "");
  }

  async function onSave(values: AddressValues) {
    setBusy(true);
    try {
      const res = await apiSend<{ address: SavedAddressDTO }>("/api/account/addresses", "POST", {
        ...values,
        zoneName: zoneName || undefined,
      });
      onSaved(res.address);
      onOpenChange(false);
      toast.success(`${res.address.label} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-forest">Save an address</DialogTitle>
          <DialogDescription>Saved addresses make reordering a two-tap affair.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSave)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="addr-label">Label</Label>
            <Input
              id="addr-label"
              placeholder="Home, Office, Mum's place…"
              className="min-h-11 rounded-xl"
              aria-invalid={Boolean(form.formState.errors.label)}
              {...form.register("label")}
            />
            {form.formState.errors.label && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.label.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-address">Address</Label>
            <Input
              id="addr-address"
              placeholder="House number, street, area"
              className="min-h-11 rounded-xl"
              aria-invalid={Boolean(form.formState.errors.address)}
              {...form.register("address")}
            />
            {form.formState.errors.address && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.address.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-landmark">Nearest landmark (optional)</Label>
            <Input id="addr-landmark" placeholder="e.g. near the junction" className="min-h-11 rounded-xl" {...form.register("landmark")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-zone">Delivery area</Label>
            <Select
              value={zoneName || "none"}
              onValueChange={(v) => {
                setZoneTouched(true);
                setZoneName(v === "none" ? "" : v);
              }}
            >
              <SelectTrigger id="addr-zone" aria-label="Delivery area" className="min-h-11 w-full rounded-xl">
                <SelectValue placeholder="Choose your delivery area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="min-h-11">
                  Not sure / outside our zones
                </SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.name} className="min-h-11">
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestedZone && !zoneTouched && (
              <p className="text-xs text-muted-foreground">
                Detected from your address: <span className="font-semibold text-forest">{suggestedZone.name}</span>
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-full bg-forest font-semibold text-cream hover:bg-forest/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Save address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddressesCard({ me, zones, onUpdated }: { me: AccountMeResponse; zones: ZoneDTO[]; onUpdated: (me: AccountMeResponse) => void }) {
  const navigate = useAppStore((s) => s.navigate);
  const setCheckoutPrefill = useAppStore((s) => s.setCheckoutPrefill);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function removeAddress() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await apiSend(`/api/account/addresses?id=${encodeURIComponent(deleteId)}`, "DELETE");
      onUpdated({ ...me, addresses: me.addresses.filter((a) => a.id !== deleteId) });
      toast.success("Address removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the address");
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  }

  function applyAtCheckout(address: SavedAddressDTO) {
    const zone = zones.find((z) => z.name === address.zoneName) ?? null;
    setCheckoutPrefill({
      address: address.address,
      landmark: address.landmark ?? undefined,
      zoneId: zone?.id,
    });
    toast.success(`${address.label} ready at checkout`);
    navigate("checkout");
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-forest">Saved addresses</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={me.addresses.length >= 10}
            className="min-h-9 gap-1.5 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add
          </Button>
        </div>

        {me.addresses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No saved addresses yet — add one to check out even faster.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
            {me.addresses.map((address) => (
              <li key={address.id} className="rounded-xl border border-border bg-background p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                      <MapPin className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
                      {address.label}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{address.address}</p>
                    {address.landmark && <p className="text-xs text-muted-foreground/80">Landmark: {address.landmark}</p>}
                    {address.zoneName && (
                      <Badge variant="secondary" className="mt-1.5 rounded-full text-[11px]">
                        {address.zoneName}
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteId(address.id)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Delete ${address.label}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyAtCheckout(address)}
                  className="mt-2.5 min-h-9 gap-1.5 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
                >
                  Use at checkout
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {me.addresses.length >= 10 && (
          <p className="text-xs text-muted-foreground">You&apos;ve reached the 10-address limit — remove one to add another.</p>
        )}
      </CardContent>

      <AddAddressDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        zones={zones}
        onSaved={(address) => onUpdated({ ...me, addresses: [address, ...me.addresses] })}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(next) => !next && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold text-forest">Remove this address?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Your saved orders aren&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-11 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void removeAddress();
              }}
              disabled={busy}
              className="min-h-11 rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Reads the HTTP status attached by apiGet/apiSend. */
function OrdersCard({ orders, loading }: { orders: OrderDTO[]; loading: boolean }) {
  const navigate = useAppStore((s) => s.navigate);
  const { formatMoney } = useCurrency();

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold text-forest">Order history</h2>
        {loading ? (
          <div className="space-y-2.5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <UtensilsCrossed className="mx-auto size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">No orders yet — your first plate awaits.</p>
            <Button
              onClick={() => navigate("menu")}
              className="mt-3 min-h-11 rounded-full bg-forest px-5 text-cream hover:bg-forest/90"
            >
              Browse the menu
            </Button>
          </div>
        ) : (
          <ul className="max-h-[480px] space-y-2.5 overflow-y-auto pr-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
            {orders.map((order) => (
              <li key={order.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-forest">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.createdAt), "d MMM yyyy · HH:mm")} ·{" "}
                    {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StatusBadge status={order.status} kind="order" />
                    {order.recipientName && (
                      <Badge variant="outline" className="gap-1 rounded-full border-gold/60 bg-gold/10 text-[11px] text-forest">
                        <Gift className="size-3" aria-hidden="true" />
                        {order.recipientName}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-sm font-bold text-forest">{formatMoney(order.total)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("track", { reference: order.reference })}
                    className="min-h-9 rounded-full border-forest/30 px-3 text-forest hover:bg-forest hover:text-cream"
                  >
                    <Package className="size-3.5" aria-hidden="true" />
                    Track
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AccountDashboard() {
  const customer = useAppStore((s) => s.customer);
  const setCustomer = useAppStore((s) => s.setCustomer);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const zones = useMemo<ZoneDTO[]>(() => bootstrap?.zones ?? [], [bootstrap]);
  const [me, setMe] = useState<AccountMeResponse | null>(null);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<AccountMeResponse>("/api/account/me");
        if (!cancelled) setMe(res);
      } catch (err) {
        if (!cancelled) {
          if (apiStatus(err) === 401) {
            setCustomer(null);
          } else {
            toast.error(err instanceof Error ? err.message : "Could not load your account");
          }
        }
      }
    })();
    (async () => {
      try {
        const res = await apiGet<{ orders: OrderDTO[] }>("/api/account/orders");
        if (!cancelled) setOrders(res.orders);
      } catch {
        /* history is best-effort; the dashboard still works */
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCustomer]);

  async function signOut() {
    try {
      await apiSend("/api/account/logout", "POST");
    } catch {
      /* cookie clear is best-effort; the UI signs out regardless */
    }
    setCustomer(null);
    toast.success("Signed out — see you soon!");
  }

  const firstName = (customer?.name ?? "").split(" ")[0] || "there";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-1.5 font-display text-3xl font-bold text-forest sm:text-4xl">Welcome back, {firstName}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-forest" aria-hidden="true" />
            Signed in as {customer?.email}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void signOut()}
          className="min-h-11 gap-1.5 rounded-full border-forest/30 text-forest hover:bg-forest hover:text-cream"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>

      <Separator className="my-8" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className="space-y-6">
          {me ? (
            <>
              <ProfileCard me={me} onUpdated={setMe} />
              <AddressesCard me={me} zones={zones} onUpdated={setMe} />
            </>
          ) : (
            <Card className="rounded-2xl shadow-sm" aria-busy="true">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Separator className="my-2" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </CardContent>
            </Card>
          )}
        </div>
        <OrdersCard orders={orders} loading={ordersLoading} />
      </div>
    </div>
  );
}

/** Reads the HTTP status attached by apiGet/apiSend. */
function apiStatus(err: unknown): number | null {
  if (err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return null;
}

export function AccountView() {
  const customer = useAppStore((s) => s.customer);
  return customer ? <AccountDashboard /> : <AuthPanel />;
}
