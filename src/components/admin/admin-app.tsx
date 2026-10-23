"use client";

/**
 * Admin entry point: session gate → login screen or dashboard shell.
 * Auth-safe: only a definitive 401 clears the session — network errors
 * and server hiccups show a retry screen instead of logging you out.
 * Exported for the app shell (mounted inside a min-h-screen flex wrapper).
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/client";
import { useAppStore, type StaffSession } from "@/store/app-store";
import { AdminProvider } from "@/components/admin/admin-context";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/admin-shell";

type GateState = "loading" | "ready" | "network-error";

export function AdminApp() {
  const staff = useAppStore((s) => s.staff);
  const setStaff = useAppStore((s) => s.setStaff);
  const [gate, setGate] = useState<GateState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  /* Session check — inline cancelled-IIFE; every setState happens after the await. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<{ staff: StaffSession | null }>("/api/auth/me");
        if (!alive) return;
        setStaff(data.staff ?? null);
        setGate("ready");
      } catch (err) {
        if (!alive) return;
        const status = (err as { status?: unknown }).status;
        if (status === 401) {
          /* Definitive "not signed in" — clear any stale session. */
          setStaff(null);
          setGate("ready");
        } else {
          /* Network/server hiccup — do NOT wipe an existing session. */
          setGate("network-error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [setStaff, retryKey]);

  function retry() {
    /* Event handler — synchronous setState is safe here. */
    setGate("loading");
    setRetryKey((k) => k + 1);
  }

  if (gate === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3 text-forest">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium">Preparing your operations hub…</p>
        </div>
      </div>
    );
  }

  if (gate === "network-error" && !staff) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-cream px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-gold/15">
            <AlertTriangle className="size-7 text-gold" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-bold text-forest">We couldn&apos;t reach the server</h1>
          <p className="text-sm text-muted-foreground">
            Your sign-in couldn&apos;t be verified just now. Check your connection and try again — we
            haven&apos;t logged you out.
          </p>
          <Button
            onClick={retry}
            className="min-h-11 gap-2 rounded-full bg-forest px-6 font-semibold text-cream hover:bg-forest/90"
          >
            <LogIn className="size-4" aria-hidden="true" />
            Retry sign-in check
          </Button>
        </div>
      </div>
    );
  }

  if (!staff) {
    return <LoginScreen />;
  }

  return (
    <AdminProvider permissions={staff.permissions}>
      <AdminShell />
    </AdminProvider>
  );
}
