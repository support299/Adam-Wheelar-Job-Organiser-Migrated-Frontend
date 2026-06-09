import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Briefcase, Clock, StickyNote } from "lucide-react";
import { toast } from "sonner";
import type { Job, ContactNote } from "@/api/types";
import {
  useListContactNotesQuery,
  useCreateContactNoteMutation,
  useUpdateContactNoteMutation,
  useDeleteContactNoteMutation,
} from "@/api/contactsApi";

const NO_JOB = "__none__";

function jobLabel(j: Job): string {
  const date = j.service_date
    ? new Date(j.service_date + "T00:00:00").toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";
  const base = j.address?.trim() || "Job";
  return date ? `${base} — ${date}` : base;
}

export function ContactActivity({
  contactKey,
  jobs,
  onOpenJob,
}: {
  contactKey: string;
  jobs: Job[];
  onOpenJob?: (job: Job) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContactNote | null>(null);
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState<string>(NO_JOB);

  const { data: notes = [], isLoading } = useListContactNotesQuery(contactKey);
  const [createNote, { isLoading: creating }] = useCreateContactNoteMutation();
  const [updateNote, { isLoading: updating }] = useUpdateContactNoteMutation();
  const [deleteNote] = useDeleteContactNoteMutation();

  const saving = creating || updating;

  const jobsById = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  type JobNoteEntry = { kind: "job-note"; id: string; job: Job; body: string; at: string };
  type UserNoteEntry = { kind: "note"; note: ContactNote };
  type Entry = JobNoteEntry | UserNoteEntry;

  const entries: Entry[] = useMemo(() => {
    const jobNotes: JobNoteEntry[] = jobs
      .filter((j) => (j.notes ?? "").trim().length > 0)
      .map((j) => ({
        kind: "job-note" as const,
        id: `job-${j.id}`,
        job: j,
        body: (j.notes ?? "").trim(),
        at: j.updated_at ?? j.created_at ?? new Date().toISOString(),
      }));
    const userNotes: UserNoteEntry[] = notes.map((n) => ({ kind: "note" as const, note: n }));
    const all: Entry[] = [...jobNotes, ...userNotes];
    all.sort((a, b) => {
      const ad = a.kind === "note" ? a.note.created_at : a.at;
      const bd = b.kind === "note" ? b.note.created_at : b.at;
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
    return all;
  }, [notes, jobs]);

  function openNew() {
    setEditing(null);
    setBody("");
    setJobId(NO_JOB);
    setOpen(true);
  }

  function openEdit(n: ContactNote) {
    setEditing(n);
    setBody(n.note);
    setJobId(n.job_id ?? NO_JOB);
    setOpen(true);
  }

  async function save() {
    const text = body.trim();
    if (!text) {
      toast.error("Note can't be empty");
      return;
    }
    try {
      if (editing) {
        await updateNote({ id: editing.id, body: { note: text } }).unwrap();
        toast.success("Note updated");
      } else {
        await createNote({
          contact_key: contactKey,
          note: text,
          job_id: jobId === NO_JOB ? undefined : jobId,
        }).unwrap();
        toast.success("Note added");
      }
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save note");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote(id).unwrap();
      toast.success("Note deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete note");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Record Activity</h2>
          <p className="text-xs text-muted-foreground">Notes about interactions with this contact.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add note
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">Loading…</Card>
      ) : entries.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          No notes yet. Click "Add note" to record your first activity.
        </Card>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => {
            if (entry.kind === "job-note") {
              const j = entry.job;
              const when = new Date(entry.at).toLocaleString(undefined, {
                month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              });
              return (
                <Card
                  key={entry.id}
                  className={`p-3 border-dashed ${onOpenJob ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                  role={onOpenJob ? "button" : undefined}
                  tabIndex={onOpenJob ? 0 : undefined}
                  onClick={() => onOpenJob?.(j)}
                  onKeyDown={(e) => {
                    if (onOpenJob && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onOpenJob(j);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {when}</span>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <StickyNote className="h-3 w-3" /> Job note
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {jobLabel(j)}
                      </Badge>
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">{entry.body}</div>
                  </div>
                </Card>
              );
            }
            const n = entry.note;
            const job = n.job_id ? jobsById.get(n.job_id) : null;
            const when = new Date(n.created_at).toLocaleString(undefined, {
              month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
            });
            return (
              <Card key={n.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {when}</span>
                      {job ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {jobLabel(job)}
                        </Badge>
                      ) : n.job_id ? (
                        <Badge variant="outline">Job removed</Badge>
                      ) : null}
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">{n.note}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(n)} aria-label="Edit note">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(n.id)} aria-label="Delete note">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit note" : "Add note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="note-job">Attach to job (optional)</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger id="note-job"><SelectValue placeholder="No job" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_JOB}>No job</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{jobLabel(j)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="note-body">Note</Label>
              <Textarea
                id="note-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
