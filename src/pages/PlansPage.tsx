import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, MapPin, Trash2, Users, CalendarClock, Phone, Navigation, Mail,
  Package, ChevronDown, ChevronRight, Pencil, ArrowUp, ArrowDown, X,
} from "lucide-react";
import { toast } from "sonner";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { JOB_PROGRESS_LABELS, JOB_PROGRESS_REQUIRES_NOTES, type JobProgressStatus } from "@/lib/jobProgress";
import { todayIso } from "@/lib/week";
import type { Job, JobInsert, SavedPlan, BaseLocation, Staff, JobProgress, JobProductLine, SavedPlanUpdate } from "@/api/types";
import { useListPlansQuery, useDeletePlanMutation, useUpdatePlanMutation, useListJobProgressQuery, useUpsertJobProgressMutation } from "@/api/plansApi";
import { useListStaffQuery, useListJobStaffQuery } from "@/api/staffApi";
import { useListJobsQuery, useUpdateJobMutation, useSetJobProductsMutation, useSetJobStaffMutation, useListAllJobProductsQuery } from "@/api/jobsApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListBaseLocationsQuery } from "@/api/locationsApi";

function mapsUrl(j: Job): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  if (Number.isFinite(j.lat) && Number.isFinite(j.lng)) {
    if (isApple) return `https://maps.apple.com/?daddr=${j.lat},${j.lng}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`;
  }
  const q = encodeURIComponent(j.address);
  if (isApple) return `https://maps.apple.com/?daddr=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function PlansPage() {
  const { data: plans = [], isLoading } = useListPlansQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: jobs = [] } = useListJobsQuery();
  const { data: products = [] } = useListProductsQuery();
  const { data: allJobStaff = [] } = useListJobStaffQuery();
  const { data: allJobProducts = [] } = useListAllJobProductsQuery();
  const { data: bases = [] } = useListBaseLocationsQuery();
  const [deletePlan] = useDeletePlanMutation();
  const [updateJob] = useUpdateJobMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [setJobStaff] = useSetJobStaffMutation();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingPlan, setEditingPlan] = useState<SavedPlan | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const jobById = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const jobStaffMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of allJobStaff) (m[r.job_id] ??= []).push(r.staff_id);
    return m;
  }, [allJobStaff]);

  const jobProductsMap = useMemo(() => {
    const m: Record<string, Array<{ product_id: string; quantity: number; unit_price: number }>> = {};
    for (const p of allJobProducts) {
      (m[p.job_id] ??= []).push({ product_id: p.product_id, quantity: p.quantity, unit_price: p.unit_price });
    }
    return m;
  }, [allJobProducts]);

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "Unknown";
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const assignableStaff = staff.filter((s) => s.role === "user" && s.active);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (dateFrom && p.plan_date < dateFrom) return false;
      if (dateTo && p.plan_date > dateTo) return false;
      if (staffFilter !== "all" && !(p.staff_ids ?? []).includes(staffFilter)) return false;
      return true;
    });
  }, [plans, dateFrom, dateTo, staffFilter]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    try {
      await deletePlan(id).unwrap();
      toast.success("Plan deleted");
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Saved Plans</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Optimized daily route plans</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-4">
        <Card className="p-3 grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="grid gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="grid gap-1 col-span-2 sm:col-span-1">
            <Label className="text-xs">Staff</Label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {assignableStaff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 col-span-2 sm:col-span-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(JOB_PROGRESS_LABELS) as JobProgressStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{JOB_PROGRESS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">No saved plans match the filters.</Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((p) => {
              const orderedIds = (p.ordered_job_ids ?? []) as string[];
              const sids = (p.staff_ids ?? []) as string[];
              return (
                <Card key={p.id} className="p-2 sm:p-3 overflow-hidden">
                  <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base break-words">{p.name}</span>
                        <Badge variant="outline"><CalendarClock className="h-3 w-3 mr-1" />{p.plan_date}</Badge>
                        {p.base_name && <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" />{p.base_name}</Badge>}
                        {p.route_shape && <Badge variant="secondary">{p.route_shape}</Badge>}
                        {p.optimize_metric && <Badge variant="secondary">{p.optimize_metric}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                        <Users className="h-3 w-3" />
                        <span className="font-medium text-foreground">Staff:</span>
                        {sids.length === 0 ? <span>Unassigned</span> : sids.map((sid, i) => (
                          <span key={sid}>{staffName(sid)}{i < sids.length - 1 ? "," : ""}</span>
                        ))}
                      </div>
                      {(p.road_km != null || p.road_minutes != null) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {p.road_km != null && <>{Number(p.road_km).toFixed(1)} km</>}
                          {p.road_km != null && p.road_minutes != null && " · "}
                          {p.road_minutes != null && <>~{p.road_minutes} min</>}
                        </div>
                      )}
                      {orderedIds.length > 0 && (
                        <PlanJobList
                          planId={p.id}
                          orderedIds={orderedIds}
                          jobById={jobById}
                          jobStaffMap={jobStaffMap}
                          jobProductsMap={jobProductsMap}
                          staffName={staffName}
                          productName={productName}
                          expanded={expanded}
                          setExpanded={setExpanded}
                          onEditJob={setEditingJob}
                        />
                      )}
                      {p.notes && <div className="text-xs text-muted-foreground mt-2 border-t pt-2">{p.notes}</div>}
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditingPlan(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <EditPlanDialog
        plan={editingPlan}
        onOpenChange={(o) => !o && setEditingPlan(null)}
        staff={assignableStaff}
        jobs={jobs}
        bases={bases}
      />

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

function PlanJobList({
  planId, orderedIds, jobById, jobStaffMap, jobProductsMap, staffName, productName,
  expanded, setExpanded, onEditJob,
}: {
  planId: string;
  orderedIds: string[];
  jobById: Map<string, Job>;
  jobStaffMap: Record<string, string[]>;
  jobProductsMap: Record<string, Array<{ product_id: string; quantity: number; unit_price: number }>>;
  staffName: (id: string) => string;
  productName: (id: string) => string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onEditJob: (j: Job) => void;
}) {
  const { data: progressRows = [] } = useListJobProgressQuery(planId);

  const progressMap = useMemo(() => {
    const m: Record<string, JobProgress[]> = {};
    for (const row of progressRows) {
      const k = `${row.plan_id}:${row.job_id}`;
      (m[k] ??= []).push(row);
    }
    return m;
  }, [progressRows]);

  return (
    <ol className="mt-2 space-y-1 min-w-0">
      {orderedIds.map((jid, i) => {
        const j = jobById.get(jid);
        const key = planId + ":" + jid + ":" + i;
        const isOpen = !!expanded[key];
        const lines = j ? (jobProductsMap[j.id] ?? []) : [];
        const linesTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
        const jStaffIds = j ? (jobStaffMap[j.id] ?? []) : [];
        const jobProgress = progressMap[`${planId}:${jid}`] ?? [];
        return (
          <li key={key} className="rounded border bg-card min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
              className="w-full flex items-center gap-2 text-xs p-2 text-left hover:bg-accent/50 rounded min-w-0"
            >
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
              <span className="truncate flex-1">{j ? `${j.name} — ${j.address}` : "(job removed)"}</span>
              {jobProgress.length === 0 ? (
                <Badge variant="outline" className="text-[10px]">{JOB_PROGRESS_LABELS.pending}</Badge>
              ) : (
                jobProgress.map((pr) => (
                  <Badge key={pr.id} variant="secondary" className="text-[10px]" title={staffName(pr.staff_id)}>
                    {JOB_PROGRESS_LABELS[(pr.status as JobProgressStatus) ?? "pending"]}
                  </Badge>
                ))
              )}
              {j && <span className="text-muted-foreground">{j.service_time?.slice(0, 5)}</span>}
            </button>
            {isOpen && j && (
              <div className="border-t p-2 sm:p-3 space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                  {j.phone && (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" asChild>
                      <a href={`tel:${j.phone}`}><Phone className="h-3 w-3 mr-1" /><span className="truncate">Call {j.phone}</span></a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" asChild>
                    <a href={mapsUrl(j)} target="_blank" rel="noopener noreferrer">
                      <Navigation className="h-3 w-3 mr-1" />Open in Maps
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" onClick={() => onEditJob(j)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit job
                  </Button>
                </div>
                <div className="flex items-start gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span className="break-words">{j.address}</span>
                </div>
                {j.email && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3" /><span className="break-all">{j.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
                  <Users className="h-3 w-3" />
                  <span className="font-medium text-foreground">Assigned:</span>
                  {jStaffIds.length === 0 ? <span>Unassigned</span> : jStaffIds.map((sid, k) => (
                    <span key={sid}>{staffName(sid)}{k < jStaffIds.length - 1 ? "," : ""}</span>
                  ))}
                </div>
                <div className="text-muted-foreground">
                  Sale value: ${Number(j.service_value).toFixed(2)}
                  {lines.length > 0 && <> · Line items: ${linesTotal.toFixed(2)}</>}
                </div>
                {lines.length > 0 && (
                  <div className="border-t pt-2">
                    <div className="font-medium mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Products</div>
                    <ul className="text-muted-foreground space-y-0.5">
                      {lines.map((l, k) => (
                        <li key={k} className="flex justify-between gap-3">
                          <span className="truncate">{productName(l.product_id)} × {l.quantity}</span>
                          <span>${(l.quantity * l.unit_price).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {j.notes && (
                  <div className="border-t pt-2">
                    <span className="font-medium text-foreground">Notes: </span>
                    <span className="text-muted-foreground">{j.notes}</span>
                  </div>
                )}
                {jStaffIds.length > 0 && (
                  <div className="border-t pt-2 space-y-3">
                    <div className="font-medium text-foreground">Staff progress</div>
                    {jStaffIds.map((sid) => {
                      const pr = jobProgress.find((x) => x.staff_id === sid);
                      return (
                        <AdminProgressEditor
                          key={sid}
                          planId={planId}
                          jobId={j.id}
                          staffId={sid}
                          staffLabel={staffName(sid)}
                          progress={pr}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function AdminProgressEditor({
  planId, jobId, staffId, staffLabel, progress,
}: {
  planId: string;
  jobId: string;
  staffId: string;
  staffLabel: string;
  progress: JobProgress | undefined;
}) {
  const current = (progress?.status as JobProgressStatus) ?? "pending";
  const [status, setStatus] = useState<JobProgressStatus>(current);
  const [km, setKm] = useState<string>(progress?.actual_km == null ? "" : String(progress.actual_km));
  const [notes, setNotes] = useState<string>(progress?.notes ?? "");
  const [upsert, { isLoading: saving }] = useUpsertJobProgressMutation();

  useEffect(() => {
    setStatus((progress?.status as JobProgressStatus) ?? "pending");
    setKm(progress?.actual_km == null ? "" : String(progress.actual_km));
    setNotes(progress?.notes ?? "");
  }, [progress, planId, jobId, staffId]);

  const requiresNotes = JOB_PROGRESS_REQUIRES_NOTES.includes(status);
  const notesMissing = requiresNotes && !notes.trim();

  async function save() {
    if (notesMissing) { toast.error("Notes required when Cancelled or Not completed"); return; }
    try {
      await upsert({ plan_id: planId, job_id: jobId, staff_id: staffId, status, actual_km: km === "" ? null : Number(km), notes: notes.trim() || null }).unwrap();
      toast.success("Progress saved");
    } catch { toast.error("Failed to save"); }
  }

  return (
    <div className="rounded border p-2 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground truncate">{staffLabel}</span>
        <Badge variant="outline" className="text-[10px]">{JOB_PROGRESS_LABELS[current]}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label className="text-[11px]">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as JobProgressStatus)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(JOB_PROGRESS_LABELS) as JobProgressStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{JOB_PROGRESS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px]">Actual km</Label>
          <Input type="number" min="0" step="0.1" className="h-8 text-xs" value={km} onChange={(e) => setKm(e.target.value)} placeholder="e.g. 12.5" />
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-[11px]">Notes{requiresNotes && <span className="text-rose-600"> *</span>}</Label>
        <Textarea rows={2} className="text-xs" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={requiresNotes ? "Required: explain why cancelled / not completed" : "Optional notes"} />
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={saving || notesMissing} onClick={save}>
          {saving ? "Saving…" : "Save progress"}
        </Button>
      </div>
    </div>
  );
}

function EditPlanDialog({
  plan, onOpenChange, staff, jobs, bases,
}: {
  plan: SavedPlan | null;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  jobs: Job[];
  bases: BaseLocation[];
}) {
  const [name, setName] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [baseId, setBaseId] = useState<string>("none");
  const [routeShape, setRouteShape] = useState("round");
  const [optimizeMetric, setOptimizeMetric] = useState("time");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [updatePlan, { isLoading: saving }] = useUpdatePlanMutation();

  useEffect(() => {
    if (!plan) return;
    setName(plan.name);
    setPlanDate(plan.plan_date);
    setBaseId(plan.base_id ?? "none");
    setRouteShape(plan.route_shape ?? "round");
    setOptimizeMetric(plan.optimize_metric ?? "time");
    setStaffIds((plan.staff_ids ?? []) as string[]);
    setOrderedIds((plan.ordered_job_ids ?? []) as string[]);
    setNotes(plan.notes ?? "");
  }, [plan]);

  const jobById = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  function move(idx: number, dir: -1 | 1) {
    setOrderedIds((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function toggleStaff(id: string) {
    setStaffIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!plan) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!planDate) { toast.error("Plan date is required"); return; }
    try {
      const selectedBase = bases.find((b) => b.id === baseId) ?? null;
      const body: SavedPlanUpdate = {
        name: name.trim(),
        plan_date: planDate,
        base_id: baseId === "none" ? null : baseId,
        base_name: selectedBase?.name ?? null,
        route_shape: routeShape,
        optimize_metric: optimizeMetric,
        staff_ids: staffIds,
        ordered_job_ids: orderedIds,
        notes: notes.trim() || null,
      };
      await updatePlan({ id: plan.id, body }).unwrap();
      toast.success("Plan updated");
      onOpenChange(false);
    } catch { toast.error("Failed to update plan"); }
  }

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit plan</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Plan date</Label>
              <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Base location</Label>
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Route shape</Label>
              <Select value={routeShape} onValueChange={setRouteShape}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Round trip</SelectItem>
                  <SelectItem value="oneway">One-way</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Optimize for</Label>
              <Select value={optimizeMetric} onValueChange={setOptimizeMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="distance">Distance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Assigned staff</Label>
            <div className="border rounded-md p-2 grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {staff.length === 0 ? (
                <span className="text-xs text-muted-foreground">No staff available</span>
              ) : (
                staff.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={staffIds.includes(s.id)} onCheckedChange={() => toggleStaff(s.id)} />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Ordered jobs</Label>
            {orderedIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs in this plan</p>
            ) : (
              <ol className="border rounded-md divide-y">
                {orderedIds.map((jid, i) => {
                  const j = jobById.get(jid);
                  return (
                    <li key={jid + ":" + i} className="flex items-center gap-2 p-2 text-xs">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate">{j ? `${j.name} — ${j.address}` : "(job removed)"}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === orderedIds.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOrderedIds((prev) => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3 text-destructive" /></Button>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="text-[11px] text-muted-foreground">Reorder or remove jobs. Travel distance/time will be recalculated on the next routing pass.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
