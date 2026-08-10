import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
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
  CheckCircle2, ChevronsUpDown, Check, Wallet, Trash2, Pencil, Wrench, Hammer, Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { currentWeekRange } from "@/lib/week";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import type { JobInsert } from "@/api/types";
import type { JobProductLine } from "@/api/types";
import { useListStaffQuery } from "@/api/staffApi";
import { useGetJobQuery, useUpdateJobMutation, useSetJobProductsMutation, useSetJobStaffMutation } from "@/api/jobsApi";
import { useGetStaffReportQuery, useGetStaffReportSummaryQuery } from "@/api/dashboardApi";
import { useListStaffPayoutsQuery, useCreateStaffPayoutMutation, useDeleteStaffPayoutMutation } from "@/api/staffPayoutsApi";

const ALL_STAFF = "__all__";

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "skip") return "bg-purple-500/15 text-purple-700 border-purple-500/30";
  if (s === "not_interested") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (s === "rescheduled") return "bg-orange-500/15 text-orange-700 border-orange-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

export function ReportsPage() {
  const { data: staff = [] } = useListStaffQuery();
  const { data: payouts = [] } = useListStaffPayoutsQuery();
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
  const [payoutFrom, setPayoutFrom] = useState("");
  const [payoutTo, setPayoutTo] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const isSingleStaff = !!selectedStaff && selectedStaff !== ALL_STAFF;

  const { data: report, isFetching: isLoading } = useGetStaffReportQuery(
    isSingleStaff ? { staffId: selectedStaff, dateFrom, dateTo } : skipToken,
  );
  const staffPlans = report?.plans ?? [];
  const staffJobs = report?.jobs ?? [];
  const totals = report?.totals;

  const { data: summary, isFetching: isSummaryLoading } = useGetStaffReportSummaryQuery(
    selectedStaff === ALL_STAFF ? { dateFrom, dateTo } : skipToken,
  );
  const summaryRows = summary?.staff ?? [];

  const { data: editingJobData } = useGetJobQuery(editingJobId ?? skipToken);

  const selectedStaffName = staff.find((s) => s.id === selectedStaff)?.name ?? "Select staff";
  const staffPayouts = payouts.filter((p) => p.staff_id === selectedStaff);
  const totalPayouts = staffPayouts.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const completedRevenue = (totals?.service_revenue ?? 0) + (totals?.install_revenue ?? 0);
  const payoutPct = completedRevenue > 0 ? (totalPayouts / completedRevenue) * 100 : 0;

  async function handleSavePayout() {
    if (!selectedStaff) return;
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) { toast.error("Enter a payout amount"); return; }
    if (!payoutFrom || !payoutTo) { toast.error("Set a Start and End date for the payout period"); return; }
    if (payoutFrom > payoutTo) { toast.error("Start date must be before end date"); return; }
    setSavingPayout(true);
    try {
      await createPayout({ staff_id: selectedStaff, period_from: payoutFrom, period_to: payoutTo, amount: amt, notes: payoutNotes || null }).unwrap();
      toast.success("Payout recorded");
      setPayoutOpen(false); setPayoutAmount(""); setPayoutNotes("");
    } catch { toast.error("Failed to save payout"); }
    finally { setSavingPayout(false); }
  }

  async function handleDeletePayout(id: number) {
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
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <Card className="p-3 grid gap-3 sm:grid-cols-4 items-end">
          <div className="grid gap-1">
            <Label className="text-xs">Staff</Label>
            <Popover open={staffOpen} onOpenChange={setStaffOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={staffOpen} className="h-9 justify-between font-normal">
                  <span className="truncate">
                    {selectedStaff === ALL_STAFF ? "All Staff" : selectedStaff ? (staff.find((s) => s.id === selectedStaff)?.name ?? "Select staff") : "Select staff"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command>
                  <CommandInput placeholder="Search staff..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No staff found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="All Staff" onSelect={() => { setSelectedStaff(ALL_STAFF); setStaffOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedStaff === ALL_STAFF ? "opacity-100" : "opacity-0")} />
                        <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <span className="flex-1 truncate">All Staff</span>
                      </CommandItem>
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
          <Button
            className="h-9 w-full"
            onClick={() => { setPayoutFrom(dateFrom); setPayoutTo(dateTo); setPayoutOpen(true); }}
            disabled={!isSingleStaff}
          >
            <Wallet className="h-4 w-4 mr-2" /> Record Payout
          </Button>
        </Card>

        {!selectedStaff ? (
          <Card className="p-12 text-center text-muted-foreground">Pick a staff member to view their report.</Card>
        ) : selectedStaff === ALL_STAFF ? (
          isSummaryLoading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
          ) : (
            <Card className="p-4">
              <h2 className="font-semibold text-sm mb-3">All Staff — {dateFrom || "—"} to {dateTo || "—"}</h2>
              {summaryRows.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No staff found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Staff</th>
                        <th className="text-right py-2 px-2">Plans</th>
                        <th className="text-right py-2 px-2">Jobs</th>
                        <th className="text-right py-2 px-2">Completed</th>
                        <th className="text-right py-2 px-2">Allocated km</th>
                        <th className="text-right py-2 px-2">Actual km</th>
                        <th className="text-right py-2 px-2">Service $</th>
                        <th className="text-right py-2 px-2">Install $</th>
                        <th className="text-right py-2 px-2">Total $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedStaff(r.id)}
                        >
                          <td className="py-2 px-2">
                            <span className="inline-flex items-center gap-1.5">
                              {r.name}
                              {!r.active && <span className="text-[10px] text-muted-foreground">inactive</span>}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">{r.plans_count}</td>
                          <td className="py-2 px-2 text-right">{r.jobs_count}</td>
                          <td className="py-2 px-2 text-right">{r.completed_count}</td>
                          <td className="py-2 px-2 text-right">{r.allocated_km.toFixed(1)}</td>
                          <td className="py-2 px-2 text-right">{r.actual_km.toFixed(1)}</td>
                          <td className="py-2 px-2 text-right text-emerald-600">${r.service_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-2 text-right text-blue-600">${r.install_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-2 text-right font-medium">${r.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        ) : isLoading || !totals ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
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
                  <CheckCircle2 className="h-3 w-3 inline mr-0.5 text-emerald-600" />{totals.completed_count} completed
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Distance Travelled</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <RouteIcon className="h-5 w-5 text-amber-600" />{totals.actual_km.toFixed(1)} km
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Allocated: {totals.allocated_km.toFixed(1)} km
                  {totals.allocated_km > 0 && <> · {((totals.actual_km / totals.allocated_km) * 100).toFixed(0)}%</>}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Time on Road</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />{Math.floor(totals.allocated_min / 60)}h {totals.allocated_min % 60}m
                </div>
              </Card>
            </section>

            <section className="grid gap-3 grid-cols-1 md:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Service Revenue</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2 text-emerald-600">
                  <Wrench className="h-5 w-5" />${totals.service_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{totals.service_count} service job{totals.service_count === 1 ? "" : "s"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Install Revenue</div>
                <div className="mt-1 text-2xl font-semibold flex items-center gap-2 text-blue-600">
                  <Hammer className="h-5 w-5" />${totals.install_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{totals.install_count} install{totals.install_count === 1 ? "" : "s"}</div>
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
                          <td className="py-2 px-2 text-right">{p.stops}</td>
                          <td className="py-2 px-2 text-right">{p.road_km != null ? `${Number(p.road_km).toFixed(1)} km` : "—"}</td>
                          <td className="py-2 px-2 text-right">{p.road_minutes != null ? `${p.road_minutes} min` : "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <span className="text-emerald-600 font-medium">${p.completed_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({p.completed_count})</span>
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
                        const actualTime = j.actual_time
                          ? new Date(j.actual_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : null;
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
                            <td className={cn("py-2 px-2 text-right", j.is_completed && "text-emerald-600 font-medium")}>
                              ${Number(j.service_value ?? 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">{j.service_time ? j.service_time.slice(0, 5) : "—"}</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">{actualTime ?? "—"}</td>
                            <td className="py-2 px-2 text-right">{j.travel_km != null ? j.travel_km.toFixed(1) : "—"}</td>
                            <td className="py-2 px-2 text-right">{j.actual_km != null ? j.actual_km.toFixed(1) : "—"}</td>
                            <td className="py-2 px-2 text-right">{j.travel_min != null ? j.travel_min : "—"}</td>
                            <td className="py-2 px-2 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingJobId(j.id)} title="Edit job">
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
            <DialogDescription>{selectedStaffName} · {payoutFrom || "—"} to {payoutTo || "—"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(!payoutFrom || !payoutTo) && (
              <div className="text-xs text-amber-600">Set a Start and End date to define the payout period.</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={payoutFrom} onChange={(e) => setPayoutFrom(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={payoutTo} onChange={(e) => setPayoutTo(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Report period summary ({dateFrom || "—"} to {dateTo || "—"})</Label>
              <div className="text-xs text-muted-foreground rounded border p-2 grid gap-0.5">
                <div>Plans: {staffPlans.length} · Jobs: {staffJobs.length}</div>
                <div>Completed: {totals?.completed_count ?? 0} · Revenue: ${completedRevenue.toLocaleString()}</div>
                <div>Distance: {(totals?.allocated_km ?? 0).toFixed(1)} km · Time: {Math.floor((totals?.allocated_min ?? 0) / 60)}h {(totals?.allocated_min ?? 0) % 60}m</div>
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
        open={!!editingJobId}
        onOpenChange={(v) => { if (!v) setEditingJobId(null); }}
        job={editingJobData ?? null}
        onSubmit={async (data: JobInsert, extras: { staffIds: string[]; lineItems: JobProductLine[] }) => {
          if (!editingJobId) return;
          try {
            await updateJob({ id: editingJobId, body: data }).unwrap();
            await setJobStaff({ jobId: editingJobId, staffIds: extras.staffIds }).unwrap();
            await setJobProducts({ jobId: editingJobId, lines: extras.lineItems }).unwrap();
            toast.success("Job updated");
            setEditingJobId(null);
          } catch { toast.error("Failed to update job"); }
        }}
      />
    </div>
  );
}
