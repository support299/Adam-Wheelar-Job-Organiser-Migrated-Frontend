import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Briefcase, CheckCircle2, Clock, AlertTriangle, Users, CalendarClock,
  DollarSign, MapPin, Route as RouteIcon, BarChart3, X, Package, TrendingUp,
} from "lucide-react";
import { Toaster } from "sonner";
import { useGetDashboardQuery } from "@/api/dashboardApi";
import { currentWeekRange } from "@/lib/week";

function StatCard({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600"
    : tone === "warning" ? "text-amber-600"
    : tone === "danger" ? "text-rose-600"
    : tone === "info" ? "text-blue-600"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState(() => currentWeekRange().from);
  const [dateTo, setDateTo] = useState(() => currentWeekRange().to);

  const { data, isLoading } = useGetDashboardQuery({ dateFrom, dateTo });

  const stats = data?.stats;
  const topProducts = data?.top_products ?? [];
  const upcomingJobs = data?.upcoming_jobs ?? [];
  const recentCompletions = data?.recent_completions ?? [];

  const clearFilters = () => {
    const w = currentWeekRange();
    setDateFrom(w.from);
    setDateTo(w.to);
  };

  const defaultRange = currentWeekRange();
  const hasFilters = dateFrom !== defaultRange.from || dateTo !== defaultRange.to;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Overview of jobs, revenue, and routes</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <BarChart3 className="h-4 w-4 mr-1" /> Jobs
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {isLoading || !stats ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : (
          <>
            <Card className="p-3 grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="h-9 w-full" onClick={clearFilters} disabled={!hasFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </Card>

            <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <StatCard icon={Briefcase} label="Total Jobs" value={stats.total_jobs} />
              <StatCard icon={Clock} label="Pending" value={stats.by_status.pending ?? 0} tone="info" />
              <StatCard icon={CalendarClock} label="Scheduled" value={stats.by_status.scheduled ?? 0} tone="info" />
              <StatCard icon={CheckCircle2} label="Service Completed" value={stats.by_status.completed ?? 0} tone="success" />
              <StatCard icon={CheckCircle2} label="Installs Completed" value={stats.installs_completed} tone="success" />
              <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} sub={`${stats.due_7} due in 7 days`} tone="danger" />
              <StatCard icon={DollarSign} label="Service Revenue" value={`$${stats.service_revenue.toLocaleString()}`} sub={`Pipeline: $${stats.pipeline_value.toLocaleString()}`} tone="success" />
              <StatCard icon={Package} label="Sales Revenue" value={`$${stats.sales_revenue.toLocaleString()}`} sub="Product sales" tone="success" />
              <StatCard icon={TrendingUp} label="Total Revenue" value={`$${stats.total_revenue.toLocaleString()}`} sub="Service + sales" tone="success" />
              <StatCard icon={Users} label="Active Staff" value={stats.active_staff} sub={`${stats.total_staff} total`} />
              <StatCard icon={RouteIcon} label="Routes Travelled" value={`${stats.total_km.toFixed(0)} km`} sub={`${stats.plans_count} plans`} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Top Product Sales</h2>
                  <Badge variant="outline">{topProducts.length}</Badge>
                </div>
                {topProducts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No product sales in this range.</div>
                ) : (
                  <ul className="divide-y">
                    {topProducts.map((t) => (
                      <li key={t.product_id} className="py-2 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.product_name}</div>
                          <div className="text-xs text-muted-foreground">Qty {t.qty.toLocaleString()}</div>
                        </div>
                        <div className="text-right shrink-0 text-sm font-medium text-emerald-600">${t.revenue.toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Upcoming Jobs</h2>
                  <Badge variant="outline">{upcomingJobs.length}</Badge>
                </div>
                {upcomingJobs.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No upcoming jobs.</div>
                ) : (
                  <ul className="divide-y">
                    {upcomingJobs.map((j) => (
                      <li key={j.id} className="py-2 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{j.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{j.address}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-medium">{j.service_date}</div>
                          <div className="text-[10px] text-muted-foreground">{j.service_time?.slice(0, 5)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Recent Completions</h2>
                  <Badge variant="outline">{stats.completions_count} total</Badge>
                </div>
                {recentCompletions.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No completions yet.</div>
                ) : (
                  <ul className="divide-y">
                    {recentCompletions.map((c) => (
                      <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.service_date}</div>
                        </div>
                        <div className="text-right shrink-0 text-sm font-medium text-emerald-600">
                          ${c.service_value.toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
