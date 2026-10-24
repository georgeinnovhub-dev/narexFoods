"use client";

/** Live KPIs, 14-day sales trend, order status mix, best sellers, ops alerts. */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  Clock3,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGHS } from "@/lib/client";
import type { AdminQuoteListResponse, OverviewStats } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import { useAppStore } from "@/store/app-store";
import {
  EmptyState,
  OrderStatusBadge,
  SkeletonCards,
  SkeletonChart,
  StatCard,
} from "@/components/admin/admin-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PIE_COLORS = ["#17362B", "#C9A227", "#0F766E", "#B45309", "#7C2D12", "#4D7C0F", "#57534E", "#991B1B"];

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function OverviewModule() {
  const { get } = useAdminApi();
  const canCatering = useAppStore((s) => s.staff?.permissions.includes("catering.manage") ?? false);
  const setAdminModule = useAppStore((s) => s.setAdminModule);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [pendingQuotes, setPendingQuotes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await get<OverviewStats>("/api/admin/overview");
    if (data) setStats(data);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await get<OverviewStats>("/api/admin/overview");
      if (!cancelled) {
        if (data) setStats(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  useEffect(() => {
    if (!canCatering) return;
    let cancelled = false;
    (async () => {
      const res = await get<AdminQuoteListResponse>("/api/admin/quotes?status=pending&pageSize=1");
      if (!cancelled && res) setPendingQuotes(res.total);
    })();
    return () => {
      cancelled = true;
    };
  }, [get, canCatering]);

  const trend = (stats?.salesTrend ?? []).map((t) => ({
    ...t,
    label: dayLabel(t.date),
    revenueCedis: t.revenue / 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Real figures from live orders — revenue counts paid orders only.
        </p>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {loading && !stats ? (
        <>
          <SkeletonCards />
          <div className="grid gap-4 xl:grid-cols-3">
            <SkeletonChart />
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </>
      ) : !stats ? (
        <EmptyState icon={ClipboardList} title="Could not load overview" body="Check your connection and refresh." />
      ) : (
        <>
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total orders"
              value={stats.totalOrders.toLocaleString()}
              icon={ShoppingBag}
              sub={
                <span>
                  <span className="font-semibold text-gold">{stats.newOrders}</span> new awaiting action
                </span>
              }
            />
            <StatCard
              label="Revenue collected"
              value={formatGHS(stats.revenueCollected)}
              icon={Banknote}
              tone="green"
              sub="Paid orders only"
            />
            <StatCard
              label="Pending verification"
              value={stats.pendingVerification}
              icon={Clock3}
              tone="gold"
              sub="Payment evidence to review"
            />
            <StatCard
              label="Outstanding"
              value={formatGHS(stats.outstandingAmount)}
              icon={Wallet}
              tone="red"
              sub="Unpaid, non-cancelled orders"
            />
            <StatCard label="Orders today" value={stats.ordersToday} icon={ClipboardList} />
            <StatCard
              label="Average order value"
              value={formatGHS(stats.averageOrderValue)}
              icon={TrendingUp}
              tone="teal"
              sub="Across paid orders"
            />
          </section>

          {pendingQuotes !== null && pendingQuotes > 0 ? (
            <button
              type="button"
              onClick={() => setAdminModule("quotes")}
              className="flex w-full items-center gap-3 rounded-2xl border border-gold/50 bg-gold/10 px-5 py-4 text-left transition-colors hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardList className="size-5 shrink-0 text-gold" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">
                {pendingQuotes} catering quotation{pendingQuotes === 1 ? "" : "s"} awaiting review
                <span className="ml-1 font-normal text-muted-foreground">— open the quotes queue</span>
              </span>
            </button>
          ) : null}

          {stats.alerts.length > 0 ? (
            <Card className="rounded-2xl border-amber-300 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  Needs attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {stats.alerts.map((alert, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                      {alert}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl shadow-sm xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base">Revenue — last 14 days</CardTitle>
                <CardDescription>Daily revenue in cedis (paid orders)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#17362B" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#17362B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `₵${v}`} />
                    <Tooltip
                      formatter={(value) => [formatGHS(Number(value) * 100), "Revenue"]}
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #E7E2D3" }}
                    />
                    <Area type="monotone" dataKey="revenueCedis" stroke="#17362B" strokeWidth={2.5} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-base">Status mix</CardTitle>
                <CardDescription>Where every order currently sits</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.statusDistribution.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={stats.statusDistribution}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {stats.statusDistribution.map((entry, i) => (
                          <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} orders`, String(name)]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #E7E2D3" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {stats.statusDistribution.map((entry, i) => (
                    <span key={entry.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <OrderStatusBadge status={entry.status} />
                      <span className="font-semibold text-foreground">{entry.count}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-base">Best sellers</CardTitle>
              <CardDescription>Top products by quantity sold (all time)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.bestSellers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Product</th>
                        <th className="px-4 py-2.5 font-medium">Variant</th>
                        <th className="px-4 py-2.5 text-right font-medium">Qty sold</th>
                        <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bestSellers.map((b, i) => (
                        <tr key={`${b.productName}-${b.variantName}-${i}`} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-foreground">{b.productName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{b.variantName}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{b.qty}</td>
                          <td className="px-4 py-2.5 text-right text-forest">{formatGHS(b.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
