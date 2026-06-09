import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, MapPin, Sparkles, Search, ArrowUp, ArrowDown,
  CalendarIcon, CalendarClock, Settings as SettingsIcon, Users, History,
  Circle as CircleIcon, ExternalLink, Phone, Copy, BarChart3,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Job, JobInsert, JobProductLine, Staff } from "@/api/types";
import {
  useListJobsQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useSetJobStaffMutation,
  useSetJobProductsMutation,
  useCreateJobCompletionMutation,
} from "@/api/jobsApi";
import { useListStaffQuery, useListJobStaffQuery } from "@/api/staffApi";
import { useListBaseLocationsQuery } from "@/api/locationsApi";
import { useGetDistanceMatrixMutation } from "@/api/mapsApi";
import { useCreatePlanMutation } from "@/api/plansApi";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { JobMap } from "@/components/jobs/JobMap";
import { optimizeOrder } from "@/lib/directions";
import {
  addFrequency,
  FREQUENCY_LABELS,
  type RecurrenceFrequency,
  getDueTag,
  DUE_TAG_LABELS,
  type DueTag,
  daysUntil,
  distanceKm,
  estimateMinutes,
} from "@/lib/jobs";
import { buildGhlContactUrl } from "@/lib/ghlContactUrl";

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "skip") return "bg-purple-500/15 text-purple-700 border-purple-500/30";
  if (s === "not_interested") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

function dueTagBadgeClass(t: DueTag) {
  switch (t) {
    case "overdue": return "bg-red-500/15 text-red-700 border-red-500/30";
    case "due_7": return "bg-orange-500/15 text-orange-700 border-orange-500/30";
    case "due_15": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "due_30": return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "due_60": return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  }
}

async function copyPhone(phone: string) {
  try {
    await navigator.clipboard.writeText(phone);
    toast.success(`Copied ${phone}`);
  } catch {
    toast.error("Failed to copy");
  }
}

// ─── calendar helpers ───────────────────────────────────────────────────────

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const CAL_HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
function parseHour(time: string): number {
  const n = parseInt(time.slice(0, 2), 10);
  return Number.isFinite(n) ? n : 0;
}
function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${period}`;
}

// ─── filter components ──────────────────────────────────────────────────────

function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="scheduled">Scheduled</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="skip">Skip This Time</SelectItem>
        <SelectItem value="not_interested">Not Interested Anymore</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DueTagFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Due tag" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All due tags</SelectItem>
        <SelectItem value="overdue">Service Overdue</SelectItem>
        <SelectItem value="due_7">Service Due in 07 Days</SelectItem>
        <SelectItem value="due_15">Service Due in 15 Days</SelectItem>
        <SelectItem value="due_30">Service Due in 30 Days</SelectItem>
        <SelectItem value="due_60">Service Due in 60 Days</SelectItem>
      </SelectContent>
    </Select>
  );
}

function StaffFilter({ value, onChange, staff }: { value: string; onChange: (v: string) => void; staff: Staff[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Staff" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All staff</SelectItem>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {staff.filter((s) => s.role === "user").map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CallStatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]"><SelectValue placeholder="Call status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All call statuses</SelectItem>
        <SelectItem value="not_called">Not Called</SelectItem>
        <SelectItem value="connected">Call Connected</SelectItem>
        <SelectItem value="not_connected">Call Not Connected</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── MapCalendar and sub-views ──────────────────────────────────────────────

type CalView = "month" | "week" | "day";

function MapCalendar({
  jobs,
  staff,
  jobStaffMap,
  circle,
  onEditJob,
}: {
  jobs: Job[];
  staff: Staff[];
  jobStaffMap: Record<string, string[]>;
  circle: { center: { lat: number; lng: number }; radiusMeters: number } | null;
  onEditJob: (job: Job) => void;
}) {
  const [view, setView] = useState<CalView>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [useCircle, setUseCircle] = useState(false);
  const [slotPick, setSlotPick] = useState<{ date: Date; hour: number } | null>(null);

  const range = useMemo(() => {
    if (view === "day") {
      return { start: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), end: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()) };
    }
    if (view === "week") {
      const s = startOfWeek(anchor);
      return { start: s, end: addDays(s, 6) };
    }
    const mStart = startOfMonth(anchor);
    const mEnd = endOfMonth(anchor);
    return { start: startOfWeek(mStart), end: addDays(startOfWeek(mEnd), 6) };
  }, [view, anchor]);

  const filtered = useMemo(() => {
    const startIso = isoDate(range.start);
    const endIso = isoDate(range.end);
    return jobs.filter((j) => {
      if (j.status !== "scheduled") return false;
      if (j.service_date < startIso || j.service_date > endIso) return false;
      if (staffFilter !== "all") {
        const ids = jobStaffMap[j.id] ?? [];
        if (staffFilter === "unassigned") { if (ids.length > 0) return false; }
        else if (!ids.includes(staffFilter)) return false;
      }
      if (useCircle && circle) {
        if (distanceKm(circle.center, { lat: j.lat, lng: j.lng }) > circle.radiusMeters / 1000) return false;
      }
      return true;
    });
  }, [jobs, range, staffFilter, useCircle, circle, jobStaffMap]);

  const jobsByDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const j of filtered) {
      (map[j.service_date] ||= []).push(j);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.service_time.localeCompare(b.service_time));
    }
    return map;
  }, [filtered]);

  const goPrev = () => {
    if (view === "day") setAnchor(addDays(anchor, -1));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "day") setAnchor(addDays(anchor, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  };

  const label = useMemo(() => {
    if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
    if (view === "week") {
      const s = startOfWeek(anchor);
      const e = addDays(s, 6);
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(anchor, "MMMM yyyy");
  }, [view, anchor]);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={goPrev} title="Previous">‹</Button>
          <Button variant="ghost" size="icon" onClick={goNext} title="Next">›</Button>
          <div className="font-semibold text-base ml-1">{label}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StaffFilter value={staffFilter} onChange={setStaffFilter} staff={staff} />
          <Button
            variant={useCircle ? "default" : "outline"}
            size="sm"
            disabled={!circle}
            onClick={() => setUseCircle((v) => !v)}
            title={circle ? "Filter by drawn circle on map" : "Draw a circle on the map first"}
          >
            <CircleIcon className="h-4 w-4 mr-1" />
            {useCircle ? "Circle filter on" : "Apply circle filter"}
          </Button>
          <Select value={view} onValueChange={(v) => setView(v as CalView)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid anchor={anchor} range={range} jobsByDay={jobsByDay} onEditJob={onEditJob} />
      ) : view === "week" ? (
        <WeekGrid range={range} jobsByDay={jobsByDay} onEditJob={onEditJob} onSlotClick={(d, h) => setSlotPick({ date: d, hour: h })} />
      ) : (
        <DayList date={anchor} jobs={jobsByDay[isoDate(anchor)] ?? []} onEditJob={onEditJob} onSlotClick={(d, h) => setSlotPick({ date: d, hour: h })} />
      )}

      <div className="text-xs text-muted-foreground mt-3">
        {filtered.length} scheduled job{filtered.length === 1 ? "" : "s"} in range
        {useCircle && circle ? ` · within ${(circle.radiusMeters / 1000).toFixed(2)} km of drawn circle` : ""}
      </div>
      <AvailableStaffDialog pick={slotPick} onClose={() => setSlotPick(null)} staff={staff} jobs={jobs} jobStaffMap={jobStaffMap} />
    </Card>
  );
}

function MonthGrid({
  anchor, range, jobsByDay, onEditJob,
}: {
  anchor: Date;
  range: { start: Date; end: Date };
  jobsByDay: Record<string, Job[]>;
  onEditJob: (j: Job) => void;
}) {
  const days: Date[] = [];
  for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) days.push(new Date(d));
  const today = new Date();
  const month = anchor.getMonth();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50 text-[10px] font-medium text-muted-foreground">
        {dayNames.map((d) => (
          <div key={d} className="px-2 py-1 text-center border-r last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)]">
        {days.map((d, i) => {
          const iso = isoDate(d);
          const items = jobsByDay[iso] ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          return (
            <div key={i} className={`border-r border-b last:border-r-0 p-1 overflow-hidden ${inMonth ? "" : "bg-muted/30 text-muted-foreground"}`}>
              <div className={`text-xs font-medium mb-1 flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((j) => (
                  <button key={j.id} type="button" onClick={() => onEditJob(j)}
                    className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/10 hover:bg-primary/20 truncate"
                    title={`${j.service_time.slice(0, 5)} ${j.name}`}
                  >
                    <span className="text-primary font-medium">{j.service_time.slice(0, 5)}</span>{" "}
                    <span className="truncate">{j.name}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  range, jobsByDay, onEditJob, onSlotClick,
}: {
  range: { start: Date; end: Date };
  jobsByDay: Record<string, Job[]>;
  onEditJob: (j: Job) => void;
  onSlotClick: (date: Date, hour: number) => void;
}) {
  const days: Date[] = [];
  for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) days.push(new Date(d));
  const today = new Date();
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid bg-muted/50 text-xs font-medium" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
        <div className="border-r" />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} className="px-2 py-2 text-center border-r last:border-r-0">
              <div className="text-[10px] text-muted-foreground">{format(d, "EEE")}</div>
              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
          {CAL_HOURS.map((h) => (
            <Fragment key={h}>
              <div className="border-r border-b text-[10px] text-muted-foreground text-right pr-2 pt-1 h-12 bg-muted/20">
                {formatHour(h)}
              </div>
              {days.map((d) => {
                const items = (jobsByDay[isoDate(d)] ?? []).filter((j) => parseHour(j.service_time) === h);
                return (
                  <div
                    key={d.toISOString() + h}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-job-btn]")) return;
                      onSlotClick(d, h);
                    }}
                    className="relative border-r last:border-r-0 border-b h-12 hover:bg-accent/40 cursor-pointer p-0.5 space-y-0.5 overflow-hidden"
                  >
                    {items.map((j) => (
                      <button key={j.id} data-job-btn type="button" onClick={(ev) => { ev.stopPropagation(); onEditJob(j); }}
                        className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/15 hover:bg-primary/25 truncate"
                      >
                        <span className="text-primary font-medium">{j.service_time.slice(0, 5)}</span>{" "}
                        <span>{j.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayList({
  date, jobs, onEditJob, onSlotClick,
}: {
  date: Date;
  jobs: Job[];
  onEditJob: (j: Job) => void;
  onSlotClick: (date: Date, hour: number) => void;
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid bg-muted/50 text-xs font-medium" style={{ gridTemplateColumns: "60px minmax(0,1fr)" }}>
        <div className="border-r" />
        <div className="px-2 py-2 text-center">{format(date, "EEEE, MMM d")}</div>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "60px minmax(0,1fr)" }}>
          {CAL_HOURS.map((h) => {
            const items = jobs.filter((j) => parseHour(j.service_time) === h);
            return (
              <Fragment key={h}>
                <div className="border-r border-b text-[10px] text-muted-foreground text-right pr-2 pt-1 h-14 bg-muted/20">
                  {formatHour(h)}
                </div>
                <div
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-job-btn]")) return;
                    onSlotClick(date, h);
                  }}
                  className="border-b h-14 hover:bg-accent/40 cursor-pointer p-1 space-y-1 overflow-hidden"
                >
                  {items.map((j) => (
                    <button key={j.id} data-job-btn type="button" onClick={(ev) => { ev.stopPropagation(); onEditJob(j); }}
                      className="w-full text-left text-xs px-2 py-1 rounded bg-primary/15 hover:bg-primary/25 flex items-center gap-2"
                    >
                      <span className="text-primary font-medium w-12 shrink-0">{j.service_time.slice(0, 5)}</span>
                      <span className="flex-1 min-w-0 truncate">{j.name}</span>
                      <span className="text-muted-foreground shrink-0">${Number(j.service_value).toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AvailableStaffDialog({
  pick, onClose, staff, jobs, jobStaffMap,
}: {
  pick: { date: Date; hour: number } | null;
  onClose: () => void;
  staff: Staff[];
  jobs: Job[];
  jobStaffMap: Record<string, string[]>;
}) {
  const open = pick !== null;
  const iso = pick ? isoDate(pick.date) : "";
  const hour = pick?.hour ?? 0;

  const { available, busy } = useMemo(() => {
    if (!pick) return { available: [] as Staff[], busy: [] as Array<{ s: Staff; job: Job }> };
    const busyMap = new Map<string, Job>();
    for (const j of jobs) {
      if (j.status !== "scheduled") continue;
      if (j.service_date !== iso) continue;
      if (parseHour(j.service_time) !== hour) continue;
      for (const sid of jobStaffMap[j.id] ?? []) busyMap.set(sid, j);
    }
    const available: Staff[] = [];
    const busy: Array<{ s: Staff; job: Job }> = [];
    for (const s of staff) {
      if (!s.active) continue;
      const j = busyMap.get(s.id);
      if (j) busy.push({ s, job: j });
      else available.push(s);
    }
    return { available, busy };
  }, [pick, jobs, staff, jobStaffMap, iso, hour]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Available staff · {pick ? format(pick.date, "EEE, MMM d") : ""} at {formatHour(hour)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Available ({available.length})</div>
            {available.length === 0 ? (
              <div className="text-xs text-muted-foreground">No staff available at this time.</div>
            ) : (
              <div className="space-y-1">
                {available.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Available</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          {busy.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Busy ({busy.length})</div>
              <div className="space-y-1">
                {busy.map(({ s, job }) => (
                  <div key={s.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">On: {job.name}</div>
                    </div>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">Busy</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MapViewPanel ────────────────────────────────────────────────────────────

function MapViewPanel({
  jobs,
  allJobs,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  statusFilter,
  setStatusFilter,
  dueTagFilter,
  setDueTagFilter,
  staffFilter,
  setStaffFilter,
  callStatusFilter,
  setCallStatusFilter,
  callsMin,
  setCallsMin,
  callsMax,
  setCallsMax,
  staff,
  jobStaffMap,
  mapSearch,
  setMapSearch,
  focusedJobId,
  setFocusedJobId,
  onEditJob,
}: {
  jobs: Job[];
  allJobs: Job[];
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  dueTagFilter: string;
  setDueTagFilter: (v: string) => void;
  staffFilter: string;
  setStaffFilter: (v: string) => void;
  callStatusFilter: string;
  setCallStatusFilter: (v: string) => void;
  callsMin: string;
  setCallsMin: (v: string) => void;
  callsMax: string;
  setCallsMax: (v: string) => void;
  staff: Staff[];
  jobStaffMap: Record<string, string[]>;
  mapSearch: string;
  setMapSearch: (v: string) => void;
  focusedJobId: string | null;
  setFocusedJobId: (id: string | null) => void;
  onEditJob: (job: Job) => void;
}) {
  const [drawCircleEnabled, setDrawCircleEnabled] = useState(false);
  const [circle, setCircle] = useState<{ center: { lat: number; lng: number }; radiusMeters: number } | null>(null);

  const circleFilteredJobs = useMemo(() => {
    if (!circle) return jobs;
    const radiusKm = circle.radiusMeters / 1000;
    return jobs.filter((j) => distanceKm(circle.center, { lat: j.lat, lng: j.lng }) <= radiusKm);
  }, [jobs, circle]);

  const sideJobs = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    const base = circleFilteredJobs;
    if (!q) return base;
    return base.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.email.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q),
    );
  }, [circleFilteredJobs, mapSearch]);

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto w-full">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-3 items-stretch">
        <Card className="p-3 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {jobs.length} job{jobs.length === 1 ? "" : "s"} on map
              {dateFrom || dateTo ? ` ${dateFrom || "…"} → ${dateTo || "…"}` : ""}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" className="w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
                )}
              </div>
              <StatusFilter value={statusFilter} onChange={setStatusFilter} />
              <DueTagFilter value={dueTagFilter} onChange={setDueTagFilter} />
              <StaffFilter value={staffFilter} onChange={setStaffFilter} staff={staff} />
              <CallStatusFilter value={callStatusFilter} onChange={setCallStatusFilter} />
              <div className="flex items-center gap-1">
                <Input type="number" min={0} step="1" value={callsMin} onChange={(e) => setCallsMin(e.target.value)} placeholder="Min calls" className="w-[100px]" title="Minimum calls made" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" min={0} step="1" value={callsMax} onChange={(e) => setCallsMax(e.target.value)} placeholder="Max calls" className="w-[100px]" title="Maximum calls made" />
                {(callsMin || callsMax) && (
                  <Button variant="ghost" size="sm" onClick={() => { setCallsMin(""); setCallsMax(""); }}>Clear</Button>
                )}
              </div>
              <Button
                variant={drawCircleEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDrawCircleEnabled((v) => {
                    const next = !v;
                    if (next) setCircle(null);
                    return next;
                  });
                }}
                title="Click and drag on the map to draw a circle"
              >
                <CircleIcon className="h-4 w-4 mr-1" />
                {drawCircleEnabled ? "Drawing… (drag on map)" : "Draw Circle"}
              </Button>
              {circle && (
                <Button variant="ghost" size="sm" onClick={() => { setCircle(null); setDrawCircleEnabled(false); }}>
                  Clear circle
                </Button>
              )}
            </div>
          </div>
          <JobMap
            jobs={circleFilteredJobs}
            focusedId={focusedJobId}
            showLabels
            onMarkerClick={(j) => setFocusedJobId(j.id)}
            drawCircleEnabled={drawCircleEnabled}
            circle={circle}
            onCircleChange={(c) => { setCircle(c); setDrawCircleEnabled(false); }}
            className="w-full flex-1 min-h-[50vh] rounded-md overflow-hidden border bg-muted"
          />
        </Card>

        <Card className="p-3 flex flex-col h-full min-h-[50vh]">
          <div className="relative mb-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search jobs on map" value={mapSearch} onChange={(e) => setMapSearch(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {sideJobs.length} job{sideJobs.length === 1 ? "" : "s"}
            {circle ? ` within ${(circle.radiusMeters / 1000).toFixed(2)} km` : (dateFrom || dateTo) ? " in date range" : " (all dates)"}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {sideJobs.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">No jobs match</div>
            ) : (
              sideJobs.map((j) => {
                const active = focusedJobId === j.id;
                return (
                  <div
                    key={j.id}
                    className={`w-full text-left p-2 rounded border text-xs transition-colors cursor-pointer ${active ? "bg-accent border-primary/50" : "hover:bg-accent/50"}`}
                    onClick={() => { setFocusedJobId(j.id); onEditJob(j); }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{j.name}</span>
                      <span className="shrink-0 text-muted-foreground">${Number(j.service_value).toFixed(0)}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span>{j.service_time.slice(0, 5)}</span>
                      <span>·</span>
                      <span className="truncate">{j.service_date}</span>
                    </div>
                    {j.phone && (
                      <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <button type="button" className="hover:underline inline-flex items-center gap-1" onClick={(e) => { e.stopPropagation(); void copyPhone(j.phone!); }} title="Copy phone number">
                          {j.phone}
                          <Copy className="h-3 w-3 opacity-60" />
                        </button>
                        {j.ghl_contact_id && (
                          <button type="button" className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground" title="Open contact"
                            onClick={(e) => { e.stopPropagation(); window.open(buildGhlContactUrl(j.ghl_contact_id!), "_blank", "noopener,noreferrer"); }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {j.address}
                    </div>
                    {(() => {
                      const ids = jobStaffMap[j.id] ?? [];
                      const names = ids.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean) as string[];
                      return (
                        <div className="text-muted-foreground truncate mt-0.5">
                          Assigned: {names.length > 0 ? names.join(", ") : <span className="italic">Unassigned</span>}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
      <MapCalendar jobs={allJobs} staff={staff} jobStaffMap={jobStaffMap} circle={circle} onEditJob={onEditJob} />
    </div>
  );
}

// ─── DailyPlanner ────────────────────────────────────────────────────────────

function DailyPlanner({
  jobs,
  staff,
  jobStaffMap,
}: {
  jobs: Job[];
  staff: Staff[];
  jobStaffMap: Record<string, string[]>;
}) {
  const { data: bases = [] } = useListBaseLocationsQuery();
  const [getDistanceMatrix] = useGetDistanceMatrixMutation();
  const [createPlan] = useCreatePlanMutation();

  const dates = useMemo(() => Array.from(new Set(jobs.map((j) => j.service_date))).sort(), [jobs]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("scheduled");
  const [dueTagFilter, setDueTagFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [baseId, setBaseId] = useState<string>("");
  const [routeShape, setRouteShape] = useState<"round" | "oneway">("round");
  const [optimizeMetric, setOptimizeMetric] = useState<"distance" | "time">("time");
  const [optimizing, setOptimizing] = useState(false);
  const [routeStats, setRouteStats] = useState<{
    roadKm: number;
    roadMinutes: number;
    legs: { distanceKm: number; minutes: number }[];
  } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Default base on first load
  useEffect(() => {
    if (bases.length && !baseId) setBaseId(bases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases]);

  // Default date to nearest upcoming
  useEffect(() => {
    if (!selectedDate && dates.length) {
      const today = new Date().toISOString().slice(0, 10);
      setSelectedDate(dates.find((d) => d >= today) ?? dates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates]);

  const selectedBase = useMemo(() => bases.find((b) => b.id === baseId) ?? null, [bases, baseId]);

  const dayJobs = useMemo(
    () => jobs.filter(
      (j) =>
        j.service_date === selectedDate &&
        (statusFilter === "all" || j.status === statusFilter) &&
        (dueTagFilter === "all" || getDueTag(j) === dueTagFilter) &&
        (() => {
          if (staffFilter === "all") return true;
          const ids = jobStaffMap[j.id] ?? [];
          if (staffFilter === "unassigned") return ids.length === 0;
          return ids.includes(staffFilter);
        })(),
    ),
    [jobs, selectedDate, statusFilter, dueTagFilter, staffFilter, jobStaffMap],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  // Reset on date change
  useEffect(() => {
    setSelectedIds(new Set());
    setOrderedIds([]);
    setRouteStats(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const selectedJobs = useMemo(() => dayJobs.filter((j) => selectedIds.has(j.id)), [dayJobs, selectedIds]);

  const orderedJobs = useMemo(() => {
    if (orderedIds.length === 0) return selectedJobs;
    const map = new Map(selectedJobs.map((j) => [j.id, j]));
    const result: Job[] = [];
    for (const id of orderedIds) {
      const j = map.get(id);
      if (j) result.push(j);
    }
    for (const j of selectedJobs) if (!orderedIds.includes(j.id)) result.push(j);
    return result;
  }, [orderedIds, selectedJobs]);

  const totals = useMemo(() => {
    let km = 0;
    for (let i = 1; i < orderedJobs.length; i++) {
      km += distanceKm(orderedJobs[i - 1], orderedJobs[i]);
    }
    return { km, minutes: estimateMinutes(km) };
  }, [orderedJobs]);

  const proximityHints = useMemo(() => {
    const groups: Job[][] = [];
    const used = new Set<string>();
    for (const j of dayJobs) {
      if (used.has(j.id)) continue;
      const group = [j];
      used.add(j.id);
      for (const k of dayJobs) {
        if (used.has(k.id)) continue;
        if (distanceKm(j, k) <= 5) { group.push(k); used.add(k.id); }
      }
      if (group.length > 1) groups.push(group);
    }
    return groups;
  }, [dayJobs]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setOrderedIds([]);
    setRouteStats(null);
  }

  function clearSel() {
    setSelectedIds(new Set());
    setOrderedIds([]);
    setRouteStats(null);
  }

  async function optimizeRoad() {
    if (!selectedBase) { toast.error("Select a base location first"); return; }
    const pool = selectedJobs.length >= 1 ? selectedJobs : dayJobs;
    if (pool.length < 1) { toast.error("Select at least 1 job to optimize"); return; }
    try {
      setOptimizing(true);
      const points = [
        { lat: selectedBase.lat, lng: selectedBase.lng },
        ...pool.map((j) => ({ lat: j.lat, lng: j.lng })),
      ];
      const matrix = await getDistanceMatrix({ points }).unwrap();
      const cost = optimizeMetric === "time" ? matrix.duration : matrix.distance;
      const { order, totalDistance, totalDuration } = optimizeOrder(cost, matrix.distance, matrix.duration, 0, routeShape === "round");
      const jobOrder = order
        .filter((idx, i) => idx !== 0 || (i !== 0 && i !== order.length - 1))
        .filter((idx) => idx !== 0)
        .map((idx) => pool[idx - 1].id);
      const legs: { distanceKm: number; minutes: number }[] = [];
      for (let i = 1; i < order.length; i++) {
        const a = order[i - 1]; const b = order[i];
        legs.push({ distanceKm: matrix.distance[a][b] / 1000, minutes: Math.round(matrix.duration[a][b] / 60) });
      }
      setSelectedIds(new Set(pool.map((j) => j.id)));
      setOrderedIds(jobOrder);
      setRouteStats({ roadKm: totalDistance / 1000, roadMinutes: Math.round(totalDuration / 60), legs });
      toast.success(`Optimized by ${optimizeMetric === "time" ? "shortest time" : "shortest distance"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to optimize route");
    } finally {
      setOptimizing(false);
    }
  }

  async function handleSavePlan() {
    if (!planName.trim()) { toast.error("Enter a plan name"); return; }
    if (orderedJobs.length === 0) { toast.error("No route to save"); return; }
    const staffIdSet = new Set<string>();
    for (const j of orderedJobs) {
      for (const sid of jobStaffMap[j.id] ?? []) staffIdSet.add(sid);
    }
    try {
      setSavingPlan(true);
      await createPlan({
        name: planName.trim(),
        plan_date: selectedDate,
        base_id: selectedBase?.id ?? null,
        base_name: selectedBase?.name ?? null,
        route_shape: routeShape,
        optimize_metric: optimizeMetric,
        ordered_job_ids: orderedJobs.map((j) => j.id),
        staff_ids: Array.from(staffIdSet),
        road_km: routeStats?.roadKm ?? null,
        road_minutes: routeStats?.roadMinutes ?? null,
        legs: (routeStats?.legs ?? []) as unknown as never,
        notes: null,
        total_km: routeStats?.roadKm ?? 0,
      }).unwrap();
      toast.success("Plan saved");
      setSaveOpen(false);
      setPlanName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...orderedJobs.map((j) => j.id)];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOrderedIds(next);
  }

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4">
      <div className="space-y-3">
        <Card className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Day</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? `${new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${dayJobs.length} job${dayJobs.length === 1 ? "" : "s"}`
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                  onSelect={(d) => d && setSelectedDate(format(d, "yyyy-MM-dd"))}
                  modifiers={{ hasJobs: dates.map((d) => new Date(d + "T00:00:00")) }}
                  modifiersClassNames={{ hasJobs: "font-bold underline decoration-primary underline-offset-4" }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filters</label>
            <div className="grid gap-2">
              <div className="[&>*]:w-full"><StatusFilter value={statusFilter} onChange={setStatusFilter} /></div>
              <div className="[&>*]:w-full"><DueTagFilter value={dueTagFilter} onChange={setDueTagFilter} /></div>
              <div className="[&>*]:w-full"><StaffFilter value={staffFilter} onChange={setStaffFilter} staff={staff} /></div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Route</label>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Base location</label>
              <Select value={baseId || "__none"} onValueChange={(v) => setBaseId(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={bases.length ? "Pick a base" : "Add bases in Settings"} />
                </SelectTrigger>
                <SelectContent>
                  {bases.length === 0 ? (
                    <SelectItem value="__none" disabled>No bases — add in Settings</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="__none">— None —</SelectItem>
                      {bases.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Route shape</label>
                <Select value={routeShape} onValueChange={(v) => setRouteShape(v as "round" | "oneway")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round trip</SelectItem>
                    <SelectItem value="oneway">One-way</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Optimize by</label>
                <Select value={optimizeMetric} onValueChange={(v) => setOptimizeMetric(v as "time" | "distance")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Shortest time</SelectItem>
                    <SelectItem value="distance">Shortest distance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={optimizeRoad} className="w-full" disabled={optimizing || dayJobs.length === 0 || !selectedBase}>
            <Sparkles className="h-4 w-4 mr-2" />
            {optimizing ? "Optimizing road route…" : "Optimize Road Route"}
          </Button>

          {routeStats && orderedJobs.length > 0 && (
            <Button variant="secondary" className="w-full" onClick={() => { setPlanName(`${selectedDate} · ${selectedBase?.name ?? "Plan"}`); setSaveOpen(true); }}>
              Save Plan
            </Button>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={clearSel} disabled={selectedIds.size === 0 && orderedIds.length === 0}>
              Clear
            </Button>
          </div>
        </Card>

        {proximityHints.length > 0 && (
          <Card className="p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Nearby groups (≤ 5km)</div>
            <div className="space-y-1">
              {proximityHints.map((group, i) => (
                <button key={i} onClick={() => { setSelectedIds(new Set(group.map((j) => j.id))); setOrderedIds([]); }}
                  className="w-full text-left text-xs p-2 rounded hover:bg-accent border"
                >
                  📍 {group.length} jobs near {group[0].name.split(" ")[0]}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Day jobs ({dayJobs.length})</div>
          {dayJobs.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No jobs for this date</div>
          ) : (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {dayJobs.map((j) => {
                const checked = selectedIds.has(j.id);
                return (
                  <label key={j.id} className={`flex items-start gap-2 p-2 rounded text-xs cursor-pointer border ${checked ? "bg-accent border-primary/40" : "hover:bg-accent/50"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(j.id)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{j.name}</div>
                      <div className="text-muted-foreground truncate">{j.service_time.slice(0, 5)} · {j.address}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </Card>

        {orderedJobs.length > 1 && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Route</div>
              <div className="text-xs text-muted-foreground">
                {routeStats
                  ? `${routeStats.roadKm.toFixed(1)} km road · ~${routeStats.roadMinutes} min`
                  : `${totals.km.toFixed(1)} km · ~${totals.minutes} min (straight-line)`}
              </div>
            </div>
            {selectedBase && (
              <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Starting from <strong className="font-medium">{selectedBase.name}</strong>
                {routeShape === "round" ? " · returns to base" : " · one-way"}
              </div>
            )}
            <ol className="space-y-1">
              {orderedJobs.map((j, i) => {
                const legIdx = selectedBase && routeStats ? i : i - 1;
                const leg = routeStats?.legs[legIdx];
                return (
                  <li key={j.id} className="flex flex-col gap-1 text-xs p-2 rounded border bg-card">
                    {leg && (
                      <div className="text-[10px] text-muted-foreground pl-7">
                        ↳ {leg.distanceKm.toFixed(1)} km · ~{leg.minutes} min from{" "}
                        {i === 0 && selectedBase ? selectedBase.name : `stop ${i}`}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate flex-1">{j.name}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === orderedJobs.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                );
              })}
              {selectedBase && routeShape === "round" && routeStats && (
                <li className="flex items-center gap-2 text-xs p-2 rounded border bg-muted/50">
                  <span className="h-5 w-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] font-bold shrink-0">B</span>
                  <span className="truncate flex-1">Return to {selectedBase.name}</span>
                  {(() => {
                    const leg = routeStats.legs[routeStats.legs.length - 1];
                    return leg ? (
                      <span className="text-[10px] text-muted-foreground">{leg.distanceKm.toFixed(1)} km · ~{leg.minutes} min</span>
                    ) : null;
                  })()}
                </li>
              )}
            </ol>
          </Card>
        )}
      </div>

      <JobMap
        jobs={dayJobs}
        routeOrder={orderedJobs.length > 1 ? orderedJobs : undefined}
        selectedIds={selectedIds}
        originPoint={selectedBase ? { lat: selectedBase.lat, lng: selectedBase.lng, label: selectedBase.name } : null}
        routeReturnsToOrigin={routeShape === "round"}
        className="w-full h-[75vh] rounded-lg overflow-hidden border bg-muted"
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Save Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Plan name</Label>
              <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">
              {orderedJobs.length} stop{orderedJobs.length === 1 ? "" : "s"} · {selectedDate}
              {routeStats && <> · {routeStats.roadKm.toFixed(1)} km · ~{routeStats.roadMinutes} min</>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={savingPlan}>{savingPlan ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── IndexPage ───────────────────────────────────────────────────────────────

export function IndexPage() {
  const { data: jobs = [], isLoading } = useListJobsQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: jobStaffRows = [], refetch: refetchJobStaff } = useListJobStaffQuery();
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [setJobStaff] = useSetJobStaffMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [createCompletion] = useCreateJobCompletionMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueTagFilter, setDueTagFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [mapSearch, setMapSearch] = useState("");
  const [mapStatusFilter, setMapStatusFilter] = useState("pending");
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [mapDateFrom, setMapDateFrom] = useState("");
  const [mapDateTo, setMapDateTo] = useState("");
  const [mapCallStatusFilter, setMapCallStatusFilter] = useState("all");
  const [mapCallsMin, setMapCallsMin] = useState("");
  const [mapCallsMax, setMapCallsMax] = useState("");

  const jobStaffMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const r of jobStaffRows) {
      (map[r.job_id] ??= []).push(r.staff_id);
    }
    return map;
  }, [jobStaffRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (dateFilter && j.service_date !== dateFilter) return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (dueTagFilter !== "all") {
        const t = getDueTag(j);
        if (t !== dueTagFilter) return false;
      }
      if (staffFilter !== "all") {
        const ids = jobStaffMap[j.id] ?? [];
        if (staffFilter === "unassigned") { if (ids.length > 0) return false; }
        else if (!ids.includes(staffFilter)) return false;
      }
      if (!q) return true;
      return (
        j.name.toLowerCase().includes(q) ||
        j.email.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q)
      );
    });
  }, [jobs, search, dateFilter, statusFilter, dueTagFilter, staffFilter, jobStaffMap]);

  const mapFiltered = useMemo(() => {
    return jobs.filter((j) => {
      if (mapDateFrom && j.service_date < mapDateFrom) return false;
      if (mapDateTo && j.service_date > mapDateTo) return false;
      if (mapStatusFilter !== "all" && j.status !== mapStatusFilter) return false;
      if (dueTagFilter !== "all") {
        const t = getDueTag(j);
        if (t !== dueTagFilter) return false;
      }
      if (staffFilter !== "all") {
        const ids = jobStaffMap[j.id] ?? [];
        if (staffFilter === "unassigned") { if (ids.length > 0) return false; }
        else if (!ids.includes(staffFilter)) return false;
      }
      const callStatus = j.call_status ?? "not_called";
      if (mapCallStatusFilter !== "all" && callStatus !== mapCallStatusFilter) return false;
      const callsMade = Number(j.calls_made ?? 0);
      if (mapCallsMin !== "" && callsMade < Number(mapCallsMin)) return false;
      if (mapCallsMax !== "" && callsMade > Number(mapCallsMax)) return false;
      return true;
    });
  }, [jobs, mapDateFrom, mapDateTo, mapStatusFilter, dueTagFilter, staffFilter, jobStaffMap, mapCallStatusFilter, mapCallsMin, mapCallsMax]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const j of filtered) {
      const arr = map.get(j.service_date) ?? [];
      arr.push(j);
      map.set(j.service_date, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function handleSubmit(data: JobInsert, extras: { staffIds: string[]; lineItems: JobProductLine[] }) {
    let savedId: string | null;
    if (editing) {
      const isDone = (s: string) => s === "completed" || s === "skip";
      const wasCompleted = isDone(editing.status);
      const nowCompleted = isDone(data.status);
      if (!wasCompleted && nowCompleted) {
        try {
          await createCompletion({
            job_id: editing.id,
            name: data.name,
            email: data.email,
            phone: data.phone ?? null,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            service_date: data.service_date,
            service_time: data.service_time,
            service_value: data.service_value,
            notes: data.notes ?? null,
            staff_ids: extras.staffIds,
            product_lines: extras.lineItems,
            service_type: data.service_type ?? "installation",
            sale_date: data.sale_date ?? null,
          }).unwrap();
        } catch (e) {
          toast.error(e instanceof Error ? `Completion not recorded: ${e.message}` : "Completion not recorded");
        }
      }
      if (!wasCompleted && nowCompleted && data.is_recurring && data.frequency) {
        const nextDate = addFrequency(data.service_date, data.frequency as RecurrenceFrequency);
        await updateJob({ id: editing.id, body: { ...data, service_date: nextDate, status: "pending", service_type: "servicing", sale_date: null } }).unwrap();
        toast.success(`Recurring job rolled to ${nextDate}`);
      } else {
        await updateJob({ id: editing.id, body: data }).unwrap();
        toast.success("Job updated");
      }
      savedId = editing.id;
    } else {
      const created = await createJob(data).unwrap();
      savedId = created.id;
      toast.success("Job created");
    }
    if (savedId) {
      try {
        await setJobStaff({ jobId: savedId, staffIds: extras.staffIds }).unwrap();
        await setJobProducts({ jobId: savedId, lines: extras.lineItems }).unwrap();
        void refetchJobStaff();
      } catch (e) {
        toast.error(e instanceof Error ? `Saved job, but assignments failed: ${e.message}` : "Saved job, but assignments failed");
      }
    }
    setEditing(null);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job?")) return;
    try {
      await deleteJob(id).unwrap();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Job Routes</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Plan, map, and optimize your service day</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings"><SettingsIcon className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Settings</span></Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/contacts"><History className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Job History</span></Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports"><BarChart3 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Staff Reports</span></Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/plans"><CalendarClock className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Saved Plans</span></Link>
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Job</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="jobs">Jobs List</TabsTrigger>
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="planner">Daily Planner</TabsTrigger>
          </TabsList>

          {/* JOBS LIST */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by name, email, or address" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Input type="date" className="w-auto" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear date</Button>}
              <StatusFilter value={statusFilter} onChange={setStatusFilter} />
              <DueTagFilter value={dueTagFilter} onChange={setDueTagFilter} />
              <StaffFilter value={staffFilter} onChange={setStaffFilter} staff={staff} />
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
            ) : groupedByDate.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No jobs yet. Click <strong>Add Job</strong> to add one.
              </Card>
            ) : (
              groupedByDate.map(([date, list]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Service Due:{" "}
                      {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "long", month: "short", day: "numeric", year: "numeric",
                      })}
                    </h2>
                    <Badge variant="secondary">{list.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {list.map((job) => (
                      <Card key={job.id} className="p-3 flex items-start justify-between gap-3 hover:shadow-sm transition-shadow">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{job.name}</span>
                            <Badge variant="outline" className={statusBadgeClass(job.status)}>{job.status}</Badge>
                            {job.is_recurring && job.frequency && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {FREQUENCY_LABELS[job.frequency as RecurrenceFrequency]}
                              </Badge>
                            )}
                            {(() => {
                              const t = getDueTag(job);
                              return t ? <Badge variant="outline" className={dueTagBadgeClass(t)}>{DUE_TAG_LABELS[t]}</Badge> : null;
                            })()}
                            <span className="text-xs text-muted-foreground">
                              {job.service_time.slice(0, 5)} · ${Number(job.service_value).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{job.email}</div>
                          {job.phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              <button type="button" className="hover:underline inline-flex items-center gap-1"
                                onClick={(e) => { e.stopPropagation(); void copyPhone(job.phone!); }} title="Copy phone number"
                              >
                                {job.phone}<Copy className="h-3 w-3 opacity-60" />
                              </button>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {job.address}
                          </div>
                          {(() => {
                            const ids = jobStaffMap[job.id] ?? [];
                            if (ids.length === 0) {
                              return (
                                <div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                                  <Users className="h-3 w-3 shrink-0" />Unassigned
                                </div>
                              );
                            }
                            const names = ids.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean) as string[];
                            return (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3 shrink-0" />
                                <span>{names.join(", ") || `${ids.length} staff`}</span>
                              </div>
                            );
                          })()}
                          {(() => {
                            const days = daysUntil(job.service_date);
                            const dateLabel = new Date(job.service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                            let countdown: string;
                            let tone: string;
                            if (job.status === "completed" || job.status === "skip") { countdown = "Completed"; tone = "text-emerald-700"; }
                            else if (job.status === "not_interested") { countdown = "Not interested"; tone = "text-rose-700"; }
                            else if (days < 0) { countdown = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`; tone = "text-red-700 font-medium"; }
                            else if (days === 0) { countdown = "Due today"; tone = "text-orange-700 font-medium"; }
                            else if (days === 1) { countdown = "Due tomorrow"; tone = "text-orange-700"; }
                            else { countdown = `in ${days} days`; tone = days <= 7 ? "text-orange-700" : days <= 30 ? "text-amber-700" : "text-muted-foreground"; }
                            return (
                              <div className="text-xs flex items-center gap-1 mt-1">
                                <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="text-muted-foreground">Next service due:</span>
                                <span className="font-medium">{dateLabel}</span>
                                <span className={tone}>· {countdown}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {job.ghl_contact_id && (
                            <Button size="icon" variant="ghost" title="Open contact in System"
                              onClick={() => window.open(buildGhlContactUrl(job.ghl_contact_id!), "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(job); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(job.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* MAP VIEW */}
          <TabsContent value="map">
            <MapViewPanel
              jobs={mapFiltered}
              allJobs={jobs}
              dateFrom={mapDateFrom}
              setDateFrom={setMapDateFrom}
              dateTo={mapDateTo}
              setDateTo={setMapDateTo}
              statusFilter={mapStatusFilter}
              setStatusFilter={setMapStatusFilter}
              dueTagFilter={dueTagFilter}
              setDueTagFilter={setDueTagFilter}
              staffFilter={staffFilter}
              setStaffFilter={setStaffFilter}
              callStatusFilter={mapCallStatusFilter}
              setCallStatusFilter={setMapCallStatusFilter}
              callsMin={mapCallsMin}
              setCallsMin={setMapCallsMin}
              callsMax={mapCallsMax}
              setCallsMax={setMapCallsMax}
              staff={staff}
              jobStaffMap={jobStaffMap}
              mapSearch={mapSearch}
              setMapSearch={setMapSearch}
              focusedJobId={focusedJobId}
              setFocusedJobId={setFocusedJobId}
              onEditJob={(j) => { setEditing(j); setDialogOpen(true); }}
            />
          </TabsContent>

          {/* DAILY PLANNER */}
          <TabsContent value="planner">
            <DailyPlanner jobs={jobs} staff={staff} jobStaffMap={jobStaffMap} />
          </TabsContent>
        </Tabs>
      </main>

      <JobFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        job={editing}
        defaultServiceType="servicing"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
