import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CALL_OUTCOME_OPTIONS,
  callOutcomeLabel,
  type CallLogEntry,
  type CallLogDraft,
  type CallOutcome,
} from "@/lib/callLog";
import {
  useListJobCallsQuery,
  useCreateJobCallMutation,
  useUpdateJobCallMutation,
  useDeleteJobCallMutation,
} from "@/api/jobCallsApi";

const NO_OUTCOME = "__none__";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeLabel(iso: string): string {
  if (!iso) return "";
  const day = new Date(iso + "T00:00:00").getTime();
  const diff = Math.round((day - startOfToday()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

type FormState = { id: number | null; date: string; notes: string; outcome: CallOutcome | null };

/**
 * Per-job call log, rendered inline in the contact-profile job editor. One
 * chronological timeline split into Upcoming / History by each entry's date.
 */
export function JobCallLog({ jobId }: { jobId: string }) {
  const { data: entries = [], isLoading } = useListJobCallsQuery(jobId);
  const [createCall] = useCreateJobCallMutation();
  const [updateCall] = useUpdateJobCallMutation();
  const [deleteCall] = useDeleteJobCallMutation();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const today = startOfToday();
    const up: CallLogEntry[] = [];
    const pa: CallLogEntry[] = [];
    for (const e of entries) {
      (new Date(e.date + "T00:00:00").getTime() >= today ? up : pa).push(e);
    }
    up.reverse(); // entries arrive newest-first; upcoming reads better soonest-first
    return { upcoming: up, past: pa };
  }, [entries]);

  function openNew() {
    setForm({ id: null, date: todayIso(), notes: "", outcome: null });
  }

  function openEdit(entry: CallLogEntry) {
    setForm({ id: entry.id, date: entry.date, notes: entry.notes, outcome: entry.outcome });
  }

  async function saveForm() {
    if (!form) return;
    if (!form.date) {
      toast.error("Pick a date for the call");
      return;
    }
    const draft: CallLogDraft = { date: form.date, notes: form.notes.trim(), outcome: form.outcome };
    setSaving(true);
    try {
      if (form.id) {
        await updateCall({ id: form.id, job: jobId, patch: draft }).unwrap();
        toast.success("Call updated");
      } else {
        await createCall({ job: jobId, ...draft }).unwrap();
        toast.success("Call added");
      }
      setForm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save call");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(entry: CallLogEntry) {
    if (!confirm("Delete this call entry?")) return;
    try {
      await deleteCall({ id: entry.id, job: jobId }).unwrap();
      if (form?.id === entry.id) setForm(null);
      toast.success("Call entry deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete call");
    }
  }

  const renderRow = (entry: CallLogEntry, tone: "upcoming" | "past") => (
    <li
      key={entry.id}
      className={cn(
        "relative pl-6",
        "before:absolute before:left-[-4.5px] before:top-3 before:h-2 before:w-2 before:rounded-full",
        tone === "upcoming" ? "before:bg-primary" : "before:bg-muted-foreground/40",
      )}
    >
      <div className={cn("rounded-md border p-3", form?.id === entry.id && "ring-1 ring-primary/40")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-medium">{fmtDate(entry.date)}</span>
              <span className="text-muted-foreground">· {relativeLabel(entry.date)}</span>
              {entry.outcome ? (
                <Badge variant="secondary">{callOutcomeLabel(entry.outcome)}</Badge>
              ) : tone === "past" ? (
                <Badge variant="outline" className="text-muted-foreground">Not logged</Badge>
              ) : (
                <Badge variant="outline" className="border-primary/40 text-primary">Planned</Badge>
              )}
            </div>
            {entry.notes.trim() ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{entry.notes}</p>
            ) : (
              <p className="mt-1 text-sm italic text-muted-foreground/70">No notes</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openEdit(entry)}
              aria-label="Edit call entry"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleRemove(entry)}
              aria-label="Delete call entry"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Call log
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add call
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No calls logged for this job yet.</p>
      ) : null}

      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit call" : "Add call"}</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="call-date">Date</Label>
                  <Input
                    id="call-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="call-outcome">Outcome</Label>
                  <Select
                    value={form.outcome ?? NO_OUTCOME}
                    onValueChange={(v) =>
                      setForm({ ...form, outcome: v === NO_OUTCOME ? null : (v as CallOutcome) })
                    }
                  >
                    <SelectTrigger id="call-outcome">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OUTCOME}>Not logged / planned</SelectItem>
                      {CALL_OUTCOME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="call-notes">Notes (optional)</Label>
                <Textarea
                  id="call-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What was discussed, or what to cover…"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={saveForm} disabled={saving}>
              {saving ? "Saving…" : form?.id ? "Save changes" : "Add call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {entries.length > 0 && (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming
              </p>
              <ul className="space-y-2 border-l border-border/70">
                {upcoming.map((e) => renderRow(e, "upcoming"))}
              </ul>
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </p>
              <ul className="space-y-2 border-l border-border/70">
                {past.map((e) => renderRow(e, "past"))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
