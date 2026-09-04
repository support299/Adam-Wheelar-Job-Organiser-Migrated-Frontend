import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListStaffQuery } from "@/api/staffApi";
import { useListBaseLocationsQuery } from "@/api/locationsApi";
import { useCreateJobMutation, useUpdateJobMutation, useGetJobStaffQuery, useSetJobStaffMutation } from "@/api/jobsApi";
import { emptyJobForm } from "@/components/jobs/useJobForm";
import { DURATION_OPTIONS, durationLabel, STATUS_OPTIONS } from "@/components/jobs/jobFieldOptions";
import type { Job } from "@/api/types";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Editing an existing shop-time job instead of creating one. */
  job?: Job | null;
  /** Pre-selected workshop / base location id (ignored when editing). */
  defaultBaseId?: string;
  /** Pre-filled date (yyyy-mm-dd). Defaults to today. Ignored when editing. */
  defaultDate?: string;
  /** Pre-selected staff member id (ignored when editing). */
  defaultStaffId?: string;
  /** Fired after a shop-time job is created or updated. */
  onAdded?: () => void;
};

/**
 * Logs "shop time" — a worker at the workshop (a base location) rather than on
 * a route — as a Job with service_type "workshop", so it flows through the
 * normal job → staff report → payout machinery. Self-contained: fetches its
 * own bases and staff. Pass `job` to edit an existing shop-time entry instead
 * of creating a new one — a lean form, not the full contact-details view.
 */
export function AddShopTimeDialog({
  open,
  onOpenChange,
  job,
  defaultBaseId,
  defaultDate,
  defaultStaffId,
  onAdded,
}: Props) {
  const isEditing = !!job;
  const { data: bases = [] } = useListBaseLocationsQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: existingStaff } = useGetJobStaffQuery(job?.id ?? "", { skip: !open || !job });
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [setJobStaff] = useSetJobStaffMutation();

  const [baseId, setBaseId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("08:00");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState("scheduled");
  const [staffId, setStaffId] = useState("");
  const [serviceValue, setServiceValue] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const base = useMemo(() => bases.find((b) => b.id === baseId) ?? null, [bases, baseId]);

  useEffect(() => {
    if (!open) return;
    if (job) {
      setBaseId(bases.find((b) => b.lat === job.lat && b.lng === job.lng)?.id ?? "");
      setDate(job.service_date);
      setTime(job.service_time.slice(0, 5));
      setDuration(job.duration ?? 60);
      setStatus(job.status);
      setServiceValue(String(job.service_value ?? 0));
      setNotes(job.notes ?? "");
      setStaffId("");
    } else {
      setBaseId(defaultBaseId || bases[0]?.id || "");
      setDate(defaultDate || todayIso());
      setTime("08:00");
      setDuration(60);
      setStatus("scheduled");
      setStaffId(defaultStaffId || "");
      setServiceValue("0");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job]);

  // Existing staff assignment loads separately (own query) — sync once it arrives.
  useEffect(() => {
    if (open && job && existingStaff) setStaffId(existingStaff.staff_ids[0] ?? "");
  }, [open, job, existingStaff]);

  async function handleSave() {
    if (!date) { toast.error("Pick a date"); return; }
    if (!base) { toast.error("Select the workshop (base location)"); return; }
    if (!staffId) { toast.error("Select a staff member"); return; }
    if (!time) { toast.error("Set a time"); return; }
    try {
      setSaving(true);
      if (job) {
        await updateJob({
          id: job.id,
          body: {
            address: base.address,
            lat: base.lat,
            lng: base.lng,
            service_date: date,
            service_time: time,
            status,
            duration,
            service_value: parseFloat(serviceValue) || 0,
            notes: notes.trim() || null,
          },
        }).unwrap();
        if (!existingStaff || existingStaff.staff_ids[0] !== staffId) {
          await setJobStaff({ jobId: job.id, staffIds: [staffId] }).unwrap();
        }
        toast.success("Shop time updated");
      } else {
        await createJob({
          ...emptyJobForm,
          name: "Shop time",
          service_value: parseFloat(serviceValue) || 0,
          address: base.address,
          lat: base.lat,
          lng: base.lng,
          service_date: date,
          service_time: time,
          status,
          is_recurring: false,
          frequency: null,
          service_type: "workshop",
          sale_date: null,
          duration,
          occurrences: 1,
          notes: notes.trim() || null,
          staff_ids: [staffId],
        }).unwrap();
        toast.success("Shop time added");
      }
      onOpenChange(false);
      onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${isEditing ? "update" : "add"} shop time`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEditing ? "Edit shop time" : "Add shop time"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Workshop (base location)</Label>
            <Select value={baseId} onValueChange={setBaseId}>
              <SelectTrigger><SelectValue placeholder={bases.length ? "Select workshop" : "Add bases in Settings"} /></SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {base && <div className="text-[11px] text-muted-foreground truncate">{base.address}</div>}
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.filter((s) => s.active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{durationLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Amount ($)</Label>
              <Input type="number" min={0} step="0.01" value={serviceValue} onChange={(e) => setServiceValue(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input placeholder="What they worked on…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !base || !staffId || !date}>
            {saving ? (isEditing ? "Saving…" : "Adding…") : (isEditing ? "Save changes" : "Add shop time")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
