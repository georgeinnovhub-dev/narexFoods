"use client";

/** Business reports: date range, totals with definitions, charts, breakdowns, CSV/print export. */

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  CalendarRange,
  Download,
  Percent,
  Printer,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGHS } from "@/lib/client";
import type { ReportsResponse } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  EmptyState,
  SkeletonChart,
  SkeletonRows,
  StatCard,
  formatDateOnly,
} from "@/components/admin/admin-utils";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function HintStat({
  label,
  value,
  icon,
  definition,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  definition: string;
  tone?: "forest" | "gold" | "green" | "red" | "teal";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard label={label} value={value} icon={icon} tone={tone} />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-xs leading-relaxed">{definition}</TooltipContent>
    </Tooltip>
  );
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export function ReportsModule() {
  const { get } = useAdminApi();
  const [from, setFrom] = useState(isoDay(6));
  const [to, setTo] = useState(isoDay(0));
  const [preset, setPreset] = useState("7");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<ReportsResponse>(`/api/admin/reports?from=${from}&to=${to}`);
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, from, to]);

  function applyPreset(days: string) {
    setPreset(days);
    if (days === "custom") return;
    const n = Number(days);
    setFrom(isoDay(n - 1));
    setTo(isoDay(0));
  }

  const chartData = useMemo(
    () =>
      (data?.ordersByDay ?? []).map((d) => ({
        ...d,
        label: d.date.slice(5),
        collectedCedis: d.collected / 100,
      })),
    [data]
  );

  function exportCsv() {
    window.open(`/api/admin/reports?from=${from}&to=${to}&format=csv`, "_blank");
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Range controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-end">
          <div className="space-y-1.5">
            <Label>Range preset</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="w-44" aria-label="Date range preset"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rep-from">From</Label>
              <Input
                id="rep-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-to">To</Label>
              <Input
                id="rep-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => { setTo(e.target.value); setPreset("custom"); }}
              />
            </div>
          </div>
          <div className="flex gap-2 lg:ml-auto">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <>
            <SkeletonChart />
            <SkeletonRows rows={5} />
          </>
        ) : !data ? (
          <EmptyState icon={BarChart3} title="Could not load reports" body="Try a different date range or refresh." />
        ) : (
          <>
            {/* Totals */}
            <section aria-label="Range totals" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <HintStat label="Orders" value={data.totals.orders.toLocaleString()} icon={Receipt} definition="Every order placed in the range, excluding cancelled and rejected." />
              <HintStat label="Gross value" value={formatGHS(data.totals.grossValue)} icon={TrendingUp} tone="teal" definition="Sum of all non-cancelled order totals before payment state." />
              <HintStat label="Collected" value={formatGHS(data.totals.collected)} icon={Banknote} tone="green" definition="Order totals where the payment status is paid." />
              <HintStat label="Discounts" value={formatGHS(data.totals.discounts)} icon={Percent} tone="gold" definition="Coupon discounts applied to orders in the range." />
              <HintStat label="Unpaid" value={formatGHS(data.totals.unpaid)} icon={Wallet} tone="red" definition="Outstanding balance on non-cancelled, unpaid orders." />
              <HintStat label="Avg order" value={formatGHS(data.totals.averageOrderValue)} icon={CalendarRange} definition="Collected revenue ÷ number of paid orders." />
            </section>

            {/* Orders by day */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-base">Orders & collected by day</CardTitle>
                <CardDescription>
                  {formatDateOnly(data.range.from)} → {formatDateOnly(data.range.to)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₵${v}`} />
                    <RechartsTooltip
                      formatter={(value, name) =>
                        name === "Revenue collected" ? [formatGHS(Number(value) * 100), String(name)] : [String(value), String(name)]
                      }
                      contentStyle={{ borderRadius: 12, border: "1px solid #E7E2D3" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#17362B" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="collectedCedis" name="Revenue collected" stroke="#C9A227" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* By product */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-base">Product performance</CardTitle>
                  <CardDescription>Quantity sold and revenue per item</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.byProduct.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No sales in this range.</p>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Product</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byProduct.map((p, i) => (
                            <tr key={`${p.productName}-${p.variantName}-${i}`} className="border-b border-border/60 last:border-0">
                              <td className="px-3 py-2">
                                <span className="font-medium">{p.productName}</span>
                                <span className="block text-xs text-muted-foreground">{p.variantName}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">{p.qty}</td>
                              <td className="px-3 py-2 text-right text-forest">{formatGHS(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment methods */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-base">Payment methods</CardTitle>
                  <CardDescription>Where the money came from</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.paymentMethods.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No payments in this range.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.paymentMethods.map((m) => {
                        const max = Math.max(...data.paymentMethods.map((x) => x.amount), 1);
                        return (
                          <div key={m.provider} className="rounded-xl border border-border px-3 py-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium capitalize">{m.provider}</span>
                              <span className="text-forest">{formatGHS(m.amount)} <span className="text-xs text-muted-foreground">({m.count})</span></span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-forest" style={{ width: `${Math.max(4, (m.amount / max) * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coupon usage */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-base">Coupon usage</CardTitle>
                  <CardDescription>Redemptions and discount cost</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.couponUsage.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No coupons redeemed in this range.</p>
                  ) : (
                    <div className="max-h-60 overflow-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Code</th>
                            <th className="px-3 py-2 text-right font-medium">Redemptions</th>
                            <th className="px-3 py-2 text-right font-medium">Discount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.couponUsage.map((c) => (
                            <tr key={c.code} className="border-b border-border/60 last:border-0">
                              <td className="px-3 py-2 font-mono font-semibold text-forest">{c.code}</td>
                              <td className="px-3 py-2 text-right font-semibold">{c.redemptions}</td>
                              <td className="px-3 py-2 text-right">{formatGHS(c.discount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dispatch performance */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-base">Dispatch performance</CardTitle>
                  <CardDescription>Delivery outcomes in range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-2xl font-bold text-green-700">{data.dispatchPerformance.delivered}</p>
                      <p className="text-xs text-muted-foreground">delivered</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className={cn("text-2xl font-bold", data.dispatchPerformance.failed > 0 ? "text-red-700" : "text-foreground")}>{data.dispatchPerformance.failed}</p>
                      <p className="text-xs text-muted-foreground">failed</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-2xl font-bold text-forest">
                        {data.dispatchPerformance.averageMinutes !== null ? `${Math.round(data.dispatchPerformance.averageMinutes)}m` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">avg assign → door</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
