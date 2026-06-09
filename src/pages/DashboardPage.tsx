import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, CheckCircle2, Clock, AlertTriangle, Users, CalendarClock,
  DollarSign, MapPin, Route as RouteIcon, BarChart3, X, Package, TrendingUp,
} from "lucide-react";
import { Toaster } from "sonner";
import { useListJobsQuery, useListJobCompletionsQuery } from "@/api/jobsApi";
import { useListPlansQuery } from "@/api/plansApi";
import { useListStaffQuery } from "@/api/staffApi";
import { useListProductsQuery } from "@/api/productsApi";
import { getDueTag } from "@/lib/jobs";
import { currentWeekRange } from "@/lib/week";
import type { Job, JobCompletion, SavedPlan, Product } from "@/api/types";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");

  const { data: jobs = [], isLoading: jobsLoading } = useListJobsQuery();
  const { data: completions = [], isLoading: completionsLoading } = useListJobCompletionsQuery();
  const { data: plans = [] } = useListPlansQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: products = [] } = useListProductsQuery();

  const loading = jobsLoading || completionsLoading;

  const inRange = (d: string | null | undefined) => {
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const filteredJobs = useMemo(() => jobs.filter((j: Job) => {
    if (!inRange(j.service_date)) return false;
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (serviceTypeFilter !== "all" && j.service_type !== serviceTypeFilter) return false;
    return true;
  }), [jobs, dateFrom, dateTo, statusFilter, serviceTypeFilter]);

  const filteredCompletions = useMemo(() => completions.filter((c: JobCompletion) => {
    if (!inRange(c.service_date)) return false;
    return true;
  }), [completions, dateFrom, dateTo]);

  const filteredPlans = useMemo(() => plans.filter((p: SavedPlan) => {
    if (!inRange(p.plan_date)) return false;
    if (staffFilter !== "all" && !(p.staff_ids ?? []).includes(staffFilter)) return false;
    return true;
  }), [plans, dateFrom, dateTo, staffFilter]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const j of filteredJobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    let overdue = 0, due7 = 0;
    for (const j of filteredJobs) {
      const t = getDueTag(j);
      if (t === "overdue") overdue++;
      else if (t === "due_7") due7++;
    }
    const serviceRevenue = filteredCompletions.reduce((s, c) => s + Number(c.service_value ?? 0), 0);
    const productTotals = new Map<string, { qty: number; revenue: number }>();
    let salesRevenue = 0;
    for (const c of filteredCompletions) {
      const lines = (c.product_lines as Array<{ product_id: string; quantity: number; unit_price: number }>) ?? [];
      for (const l of lines) {
        const qty = Number(l.quantity ?? 0);
        const price = Number(l.unit_price ?? 0);
        const total = qty * price;
        salesRevenue += total;
        const prev = productTotals.get(l.product_id) ?? { qty: 0, revenue: 0 };
        productTotals.set(l.product_id, { qty: prev.qty + qty, revenue: prev.revenue + total });
      }
    }
    const topProducts = Array.from(productTotals.entries())
      .map(([pid, v]) => ({ pid, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    const pipelineValue = filteredJobs
      .filter((j) => j.status === "pending" || j.status === "scheduled")
      .reduce((s, j) => s + Number(j.service_value ?? 0), 0);
    const totalKm = filteredPlans.reduce((s, p) => s + Number(p.total_km ?? 0), 0);
    const activeStaff = staff.filter((s) => s.active).length;
    return { byStatus, overdue, due7, serviceRevenue, salesRevenue, totalRevenue: serviceRevenue + salesRevenue, topProducts, pipelineValue, totalKm, activeStaff };
  }, [filteredJobs, filteredCompletions, filteredPlans, staff]);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const upcomingJobs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredJobs.filter((j) => j.service_date >= today && (j.status === "pending" || j.status === "scheduled")).slice(0, 8);
  }, [filteredJobs]);

  const serviceTypes = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) if (j.service_type) set.add(j.service_type);
    return Array.from(set).sort();
  }, [jobs]);

  const clearFilters = () => {
    const w = currentWeekRange();
    setDateFrom(w.from);
    setDateTo(w.to);
    setStatusFilter("all");
    setStaffFilter("all");
    setServiceTypeFilter("all");
  };

  const hasFilters = statusFilter !== "all" || staffFilter !== "all" || serviceTypeFilter !== "all";

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
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : (
          <>
            <Card className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["pending", "scheduled", "completed", "skip", "not_interested"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Service Type</Label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {serviceTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="h-9 w-full" onClick={clearFilters} disabled={!hasFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </Card>

            <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <StatCard icon={Briefcase} label="Total Jobs" value={filteredJobs.length} />
              <StatCard icon={Clock} label="Pending" value={stats.byStatus.pending ?? 0} tone="info" />
              <StatCard icon={CalendarClock} label="Scheduled" value={stats.byStatus.scheduled ?? 0} tone="info" />
              <StatCard icon={CheckCircle2} label="Service Completed" value={stats.byStatus.completed ?? 0} tone="success" />
              <StatCard icon={CheckCircle2} label="Installs Completed" value={filteredCompletions.filter((c) => c.service_type === "installation").length} tone="success" />
              <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} sub={`${stats.due7} due in 7 days`} tone="danger" />
              <StatCard icon={DollarSign} label="Service Revenue" value={`$${stats.serviceRevenue.toLocaleString()}`} sub={`Pipeline: $${stats.pipelineValue.toLocaleString()}`} tone="success" />
              <StatCard icon={Package} label="Sales Revenue" value={`$${stats.salesRevenue.toLocaleString()}`} sub="Product sales" tone="success" />
              <StatCard icon={TrendingUp} label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} sub="Service + sales" tone="success" />
              <StatCard icon={Users} label="Active Staff" value={stats.activeStaff} sub={`${staff.length} total`} />
              <StatCard icon={RouteIcon} label="Routes Travelled" value={`${stats.totalKm.toFixed(0)} km`} sub={`${filteredPlans.length} plans`} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Top Product Sales</h2>
                  <Badge variant="outline">{stats.topProducts.length}</Badge>
                </div>
                {stats.topProducts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No product sales in this range.</div>
                ) : (
                  <ul className="divide-y">
                    {stats.topProducts.map((t) => {
                      const p = productById.get(t.pid);
                      return (
                        <li key={t.pid} className="py-2 text-sm flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p?.name ?? "Unknown product"}</div>
                            <div className="text-xs text-muted-foreground">Qty {t.qty.toLocaleString()}</div>
                          </div>
                          <div className="text-right shrink-0 text-sm font-medium text-emerald-600">${t.revenue.toLocaleString()}</div>
                        </li>
                      );
                    })}
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
                  <Badge variant="outline">{filteredCompletions.length} total</Badge>
                </div>
                {filteredCompletions.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No completions yet.</div>
                ) : (
                  <ul className="divide-y">
                    {filteredCompletions.slice(0, 8).map((c) => (
                      <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.service_date}</div>
                        </div>
                        <div className="text-right shrink-0 text-sm font-medium text-emerald-600">
                          ${Number(c.service_value ?? 0).toLocaleString()}
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
