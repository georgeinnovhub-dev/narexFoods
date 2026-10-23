"use client";

/**
 * Admin entry point: session gate → login screen or dashboard shell.
 * Exported for the app shell (mounted inside a min-h-screen flex wrapper).
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/client";
import { useAppStore, type StaffSession } from "@/store/app-store";
import { AdminProvider } from "@/components/admin/admin-context";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/admin-shell";

export function AdminApp() {
  const staff = useAppStore((s) => s.staff);
  const setStaff = useAppStore((s) => s.setStaff);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet<{ staff: StaffSession | null }>("/api/auth/me")
      .then((data) => {
        if (alive) setStaff(data.staff ?? null);
      })
      .catch(() => {
        if (alive) setStaff(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [setStaff]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3 text-forest">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium">Preparing your operations hub…</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return <LoginScreen />;
  }

  return (
    <AdminProvider permissions={staff.permissions} initialModule="overview">
      <AdminShell />
    </AdminProvider>
  );
}
