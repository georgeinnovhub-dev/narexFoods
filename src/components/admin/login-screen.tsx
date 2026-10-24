"use client";

/** NAREX Foods staff login — forest/cream brand gradient with gold accents. */

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Lock, LogIn, Mail, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { apiSend } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { errMessage } from "@/components/admin/admin-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginScreen() {
  const setStaff = useAppStore((s) => s.setStaff);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiSend<{ staff: { id: string; name: string; email: string; role: string; permissions: string[] } }>(
        "/api/auth/login",
        "POST",
        { email: email.trim().toLowerCase(), password }
      );
      setStaff(data.staff);
      toast.success(`Welcome back, ${data.staff.name.split(" ")[0]}.`);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-forest px-4 py-10">
      {/* Ambient brand shapes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#0E241B] blur-2xl" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold shadow-lg">
            <UtensilsCrossed className="h-7 w-7 text-forest" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-cream">NAREX Foods</h1>
          <p className="text-sm text-cream/70">Operations Hub · Staff sign-in</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-cream/10 bg-[#132C23] p-6 shadow-xl sm:p-8"
          aria-label="Staff login form"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-cream/90">
                Work email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/50" aria-hidden="true" />
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@narexfoods.com"
                  className="border-cream/15 bg-[#0F241C] pl-9 text-cream placeholder:text-cream/35 focus-visible:ring-gold"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-cream/90">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/50" aria-hidden="true" />
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="border-cream/15 bg-[#0F241C] pl-9 text-cream placeholder:text-cream/35 focus-visible:ring-gold"
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-gold font-semibold text-forest hover:bg-[#D9B23A]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
              {loading ? "Signing in…" : "Sign in to dashboard"}
            </Button>
          </div>
        </form>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-cream/80">
            <span className="font-semibold text-gold">Demo superadmin:</span> admin@narexfoods.com · NarexAdmin2024!
            <span className="mt-0.5 block text-cream/60">Sandbox seed credentials — roles &amp; permissions are fully enforced.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
