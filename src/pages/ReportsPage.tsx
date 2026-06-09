import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, MapPin, CalendarClock, Route as RouteIcon, Clock, Briefcase,
  CheckCircle2, ChevronsUpDown, Check, Wallet, Trash2, Pencil, Wrench, Hammer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { currentWeekRange } from "@/lib/week";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import type { Job, JobInsert } from "@/api/types";
import type { JobProductLine } from "@/api/types";
import { useListStaffQuery } from "@/api/staffApi";
import { useListJobsQuery, useUpdateJobMutation, useSetJobProductsMutation, useSetJobStaffMutation } from "@/api/jobsApi";
import { useListPlansQuery, useListAllJobProgressQuery } from "@/api/plansApi";
import { useListStaffPayoutsQuery, useCreateStaffPayoutMutation, useDeleteStaffPayoutMutation } from "@/api/staffPayoutsApi";
import { useListJobStaffQuery } from "@/api/staffApi";

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "skip") return "bg-purple-500/15 text-purple-700 border-purple-500/30";
  if (s === "not_interested") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

export function ReportsPage() {
  const { data: staff = [] } = useListStaffQuery();
  const { data: jobs = [], isLoading } = useListJobsQuery();
  const { data: plans = [] } = useListPlansQuery();
  const { data: allJobStaff = [] } = useListJobStaffQuery();
  const { data: payouts = [] } = useListStaffPayoutsQuery();
  const { data: progress = [] } = useListAllJobProgressQuery();
  const [createPayout] = useCreateStaffPayoutMutation();
  const [deletePayout] = useDeleteStaffPayoutMutation();
  const [updateJob] = useUpdateJobMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [setJobStaff] = useSetJobStaffMutation();

  const [selectedStaff, setSelectedStaff] = useState(() => {
    return "";
  });
  const [dateFrom, setDateFrom] = useState(() => currentWeekRange().from);
  const [dateTo, setDateTo] = useState(() => currentWeekRange().to);
  const [staffOpen, setStaffOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const jobStaffMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of allJobStaff) (m[r.job_id] ??= []).push(r.staff_id);
    return m;
  }, [allJobStaff]);

  const inRange = useCallback((d: string) => {
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }, [dateFrom, dateTo]);

  const staffPlans = useMemo(() => {
    if (!selectedStaff) return [];
    return plans
      .filter((p) => (p.staff_ids ?? []).includes(selectedStaff))
      .filter((p) => inRange(p.plan_date));
  }, [plans, selectedStaff, inRange]);

  const staffJobs = useMemo(() => {
    if (!selectedStaff) return [];
    return jobs
      .filter((j) => (jobStaffMap[j.id] ?? []).includes(selectedStaff))
      .filter((j) => inRange(j.service_date));
  }, [jobs, jobStaffMap, selectedStaff, inRange]);

  const totals = useMemo(() => {
    const km = staffPlans.reduce((s, p) => s + Number(p.road_km ?? 0), 0);
    const min = staffPlans.reduce((s, p) => s + Number(p.road_minutes ?? 0), 0);
    const byStatus: Record<string, number> = {};
    for (const j of staffJobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    return { km, min, byStatus };
  }, [staffPlans, staffJobs]);

  const jobTravel = useMemo(() => {
    const acc: Record<string, { km: number; min: number; visits: number }> = {};
    for (const p of staffPlans) {
      const ordered = (p.ordered_job_ids ?? []) as string[];
      const legs = (p.legs as Array<{ distanceKm?: number; minutes?: number }>) ?? [];
      ordered.forEach((jid, i) => {
        const leg = legs[i];
        const km = Number(leg?.distanceKm ?? 0);
        const min = Number(leg?.minutes ?? 0);
        const e = (acc[jid] ??= { km: 0, min: 0, visits: 0 });
        e.km += km; e.min += min; e.visits += 1;
      });
    }
    return acc;
  }, [staffPlans]);

  const jobActualKm = useMemo(() => {
    const planIds = new Set(staffPlans.map((p) => p.id));
    const acc: Record<string, number> = {};
    for (const pr of progress) {
      if (pr.staff_id !== selectedStaff) continue;
      if (!planIds.has(pr.plan_id)) continue;
      if (pr.actual_km == null) continue;
      acc[pr.job_id] = (acc[pr.job_id] ?? 0) + Number(pr.actual_km);
    }
    return acc;
  }, [progress, staffPlans, selectedStaff]);

  const completedJobIds = useMemo(() => {
    const planIds = new Set(staffPlans.map((p) => p.id));
    const s = new Set<string>();
    for (const pr of progress) {
      if (pr.staff_id !== selectedStaff) continue;
      if (!planIds.has(pr.plan_id)) continue;
      if (pr.status === "completed") s.add(pr.job_id);
    }
    return s;
  }, [progress, selectedStaff, staffPlans]);

  const jobsById = useMemo(() => {
    const m: Record<string, Job> = {};
    for (const j of jobs) m[j.id] = j;
    return m;
  }, [jobs]);

  const completedRevenue = useMemo(() => {
    const ids = new Set<string>();
    for (const j of staffJobs) if (j.status === "completed") ids.add(j.id);
    for (const id of completedJobIds) ids.add(id);
    let total = 0; let count = 0;
    for (const id of ids) {
      const j = jobsById[id];
      if (!j) continue;
      total += Number(j.service_value ?? 0); count += 1;
    }
    return { total, count };
  }, [staffJobs, completedJobIds, jobsById]);

  const revenueSplit = useMemo(() => {
    const ids = new Set<string>();
    for (const j of staffJobs) if (j.status === "completed") ids.add(j.id);
    for (const id of completedJobIds) ids.add(id);
    let serviceTotal = 0; let serviceCount = 0; let installTotal = 0; let installCount = 0;
    for (const id of ids) {
      const j = jobsById[id]; if (!j) continue;
      const val = Number(j.service_value ?? 0);
      if (j.service_type === "installation") { installTotal += val; installCount += 1; }
      else { serviceTotal += val; serviceCount += 1; }
    }
    return { serviceTotal, serviceCount, installTotal, installCount };
  }, [staffJobs, completedJobIds, jobsById]);

  const jobActualTime = useMemo(() => {
    const planIds = new Set(staffPlans.map((p) => p.id));
    const acc: Record<string, string> = {};
    for (const pr of progress) {
      if (pr.staff_id !== selectedStaff || !planIds.has(pr.plan_id) || pr.status !== "completed") continue;
      const d = new Date(pr.updated_at);
      acc[pr.job_id] = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return acc;
  }, [progress, staffPlans, selectedStaff]);

  const planCompletedValue = useMemo(() => {
    const acc: Record<string, { value: number; count: number }> = {};
    for (const p of staffPlans) {
      const ordered = (p.ordered_job_ids ?? []) as string[];
      let value = 0; let count = 0;
      for (const jid of ordered) {
        const j = jobsById[jid]; if (!j) continue;
        if (completedJobIds.has(jid) || j.status === "completed") { value += Number(j.service_value ?? 0); count += 1; }
      }
      acc[p.id] = { value, count };
    }
    return acc;
  }, [staffPlans, jobsById, completedJobIds]);

  const totalActualKm = useMemo(() => Object.values(jobActualKm).reduce((s, v) => s + v, 0), [jobActualKm]);
  const selectedStaffName = staff.find((s) => s.id === selectedStaff)?.name ?? "Select staff";
  const staffPayouts = useMemo(() => payouts.filter((p) => p.staff_id === selectedStaff), [payouts, selectedStaff]);
  const totalPayouts = useMemo(() => staffPayouts.reduce((s, p) => s + Number(p.amount ?? 0), 0), [staffPayouts]);
  const payoutPct = completedRevenue.total > 0 ? (totalPayouts / completedRevenue.total) * 100 : 0;

  async function handleSavePayout() {
    if (!selectedStaff) return;
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) { toast.error("Enter a payout amount"); return; }
    if (!dateFrom || !dateTo) { toast.error("Set a From and To date for the payout period"); return; }
    setSavingPayout(true);
    try {
      await createPayout({ staff_id: selectedStaff, period_from: dateFrom, period_to: dateTo, amount: amt, notes: payoutNotes || null }).unwrap();
      toast.success("Payout recorded");
      setPayoutOpen(false); setPayoutAmount(""); setPayoutNotes("");
    } catch { toast.error("Failed to save payout"); }
    finally { setSavingPayout(false); }
  }

  async function handleDeletePayout(id: string) {
    if (!confirm("Delete this payout?")) return;
    try { await deletePayout(id).unwrap(); }
    catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Staff Reports</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Saved plans, assigned jobs, and travel per staff member</p>
          </div>
          <Button variant="outline" size="sm" asChild><Link to="/dashboard">Dashboard</Link></Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <Card className="p-3 grid gap-3 sm:grid-cols-4 items-end">
          <div className="grid gap-1">
            <Label className="text-xs">Staff</Label>
            <Popover open={staffOpen} onOpenChange={setStaffOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={staffOpen} className="h-9 justify-between font-normal">
                  <span className="truncate">{selectedStaff ? (staff.find((s) => s.id === selectedStaff)?.name ?? "Select staff") : "Select staff"}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command>
                  <CommandInput placeholder="Search staff..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No staff found.</CommandEmpty>
                    <CommandGroup>
                      {staff.map((s) => (
                        <CommandItem key={s.id} value={`${s.name} ${s.email ?? ""}`} onSelect={() => { setSelectedStaff(s.id); setStaffOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedStaff === s.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{s.name}</span>
                          {!s.active && <span className="text-[10px] text-muted-foreground ml-2">inactive</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button className="h-9 w-full" onClick={() => setPayoutOpen(true)} disabled={!selectedStaff}>
            <Wallet className="h-4 w-4 mr-2" /> Record Payout
          </Button>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : !selectedStaff ? (
          <Card className="p-12 text-center text-muted-foreground">Pick a staff member to view their report.</Card>
        ) : (
          <>
            <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Saved Plans</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-blue-600" />{staffPlans.length}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Jobs</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />{staffJobs.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <CheckCircle2 className="h-3 w-3 inline mr-0.5 text-emerald-600" />{totals.byStatus.completed ?? 0} completed
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Distance Travelled</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <RouteIcon className="h-5 w-5 text-amber-600" />{totalActualKm.toFixed(1)} km
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Allocated: {totals.km.toFixed(1)} km
                  {totals.km > 0 && <> · {((totalActualKm / totals.km) * 100).toFixed(0)}%</>}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Time on Road</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />{Math.floor(totals.min / 60)}h {totals.min % 60}m
                </div>
              </Card>
            </section>

            <section className="grid gap-3 grid-cols-1 md:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Service Revenue</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2 text-emerald-600">
                  <Wrench className="h-5 w-5" />${revenueSplit.serviceTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{revenueSplit.serviceCount} service job{revenueSplit.serviceCount === 1 ? "" : "s"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Install Revenue</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2 text-blue-600">
                  <Hammer className="h-5 w-5" />${revenueSplit.installTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{revenueSplit.installCount} install{revenueSplit.installCount === 1 ? "" : "s"}</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Payouts</div>
                  <Badge variant="outline">{payoutPct.toFixed(1)}% of revenue</Badge>
                </div>
                <div className="mt-1 text-3xl font-semibold flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-blue-600" />{totalPayouts.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{staffPayouts.length} payout{staffPayouts.length === 1 ? "" : "s"} in this period</div>
              </Card>
            </section>

            <Card className="p-4">
              <h2 className="font-semibold text-sm mb-3">Saved Plans for {selectedStaffName}</h2>
              {staffPlans.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No saved plans in this range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Plan</th>
                        <th className="text-left py-2 px-2">Base</th>
                        <th className="text-right py-2 px-2">Stops</th>
                        <th className="text-right py-2 px-2">Distance</th>
                        <th className="text-right py-2 px-2">Time</th>
                        <th className="text-right py-2 px-2">Completed $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPlans.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 px-2 whitespace-nowrap">{p.plan_date}</td>
                          <td className="py-2 px-2">{p.name}</td>
                          <td className="py-2 px-2 text-muted-foreground">{p.base_name ?? "—"}</td>
                          <td className="py-2 px-2 text-right">{(p.ordered_job_ids ?? []).length}</td>
                          <td className="py-2 px-2 text-right">{p.road_km != null ? `${Number(p.road_km).toFixed(1)} km` : "—"}</td>
                          <td className="py-2 px-2 text-right">{p.road_minutes != null ? `${p.road_minutes} min` : "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <span className="text-emerald-600 font-medium">${planCompletedValue[p.id]?.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "0"}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({planCompletedValue[p.id]?.count ?? 0})</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="font-semibold text-sm mb-3">Assigned Jobs</h2>
              {staffJobs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No assigned jobs in this range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Customer</th>
                        <th className="text-left py-2 px-2">Address</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-right py-2 px-2">Value</th>
                        <th className="text-right py-2 px-2">Allocated</th>
                        <th className="text-right py-2 px-2">Actual</th>
                        <th className="text-right py-2 px-2">Travel (km)</th>
                        <th className="text-right py-2 px-2">Actual (km)</th>
                        <th className="text-right py-2 px-2">Travel (min)</th>
                        <th className="py-2 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {staffJobs.map((j) => {
                        const t = jobTravel[j.id];
                        const actual = jobActualKm[j.id];
                        const actualTime = jobActualTime[j.id];
                        const isCompleted = j.status === "completed" || completedJobIds.has(j.id);
                        return (
                          <tr key={j.id} className="border-b last:border-0">
                            <td className="py-2 px-2 whitespace-nowrap">{j.service_date}</td>
                            <td className="py-2 px-2">{j.name}</td>
                            <td className="py-2 px-2 text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="line-clamp-1">{j.address}</span>
                              </span>
                            </td>
                            <td className="py-2 px-2"><Badge variant="outline" className="capitalize">{j.service_type}</Badge></td>
                            <td className="py-2 px-2"><Badge variant="outline" className={statusBadgeClass(j.status)}>{j.status}</Badge></td>
                            <td className={cn("py-2 px-2 text-right", isCompleted && "text-emerald-600 font-medium")}>
                              ${Number(j.service_value ?? 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">{j.service_time ? j.service_time.slice(0, 5) : "—"}</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">{actualTime ?? "—"}</td>
                            <td className="py-2 px-2 text-right">{t ? t.km.toFixed(1) : "—"}</td>
                            <td className="py-2 px-2 text-right">{actual != null ? actual.toFixed(1) : "—"}</td>
                            <td className="py-2 px-2 text-right">{t ? t.min : "—"}</td>
                            <td className="py-2 px-2 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingJob(j)} title="Edit job">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Payouts for {selectedStaffName}</h2>
                <Badge variant="outline">Total: ${staffPayouts.reduce((s, p) => s + Number(p.amount ?? 0), 0).toLocaleString()}</Badge>
              </div>
              {staffPayouts.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No payouts recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Paid</th>
                        <th className="text-left py-2 px-2">Period</th>
                        <th className="text-left py-2 px-2">Notes</th>
                        <th className="text-right py-2 px-2">Amount</th>
                        <th className="py-2 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {staffPayouts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 px-2 whitespace-nowrap">{new Date(p.paid_at).toLocaleDateString()}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{p.period_from} → {p.period_to}</td>
                          <td className="py-2 px-2 text-muted-foreground">{p.notes ?? "—"}</td>
                          <td className="py-2 px-2 text-right font-medium">${Number(p.amount ?? 0).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePayout(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </main>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payout</DialogTitle>
            <DialogDescription>{selectedStaffName} · {dateFrom || "—"} to {dateTo || "—"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(!dateFrom || !dateTo) && (
              <div className="text-xs text-amber-600">Set a From and To date above to define the payout period.</div>
            )}
            <div className="grid gap-1">
              <Label className="text-xs">Period summary</Label>
              <div className="text-xs text-muted-foreground rounded border p-2 grid gap-0.5">
                <div>Plans: {staffPlans.length} · Jobs: {staffJobs.length}</div>
                <div>Completed: {totals.byStatus.completed ?? 0} · Revenue: ${completedRevenue.total.toLocaleString()}</div>
                <div>Distance: {totals.km.toFixed(1)} km · Time: {Math.floor(totals.min / 60)}h {totals.min % 60}m</div>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={3} placeholder="Optional notes..." value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePayout} disabled={savingPayout}>{savingPayout ? "Saving..." : "Save Payout"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobFormDialog
        open={!!editingJob}
        onOpenChange={(v) => { if (!v) setEditingJob(null); }}
        job={editingJob}
        onSubmit={async (data: JobInsert, extras: { staffIds: string[]; lineItems: JobProductLine[] }) => {
          if (!editingJob) return;
          try {
            await updateJob({ id: editingJob.id, body: data }).unwrap();
            await setJobStaff({ jobId: editingJob.id, staffIds: extras.staffIds }).unwrap();
            await setJobProducts({ jobId: editingJob.id, lines: extras.lineItems }).unwrap();
            toast.success("Job updated");
            setEditingJob(null);
          } catch { toast.error("Failed to update job"); }
        }}
      />
    </div>
  );
}
