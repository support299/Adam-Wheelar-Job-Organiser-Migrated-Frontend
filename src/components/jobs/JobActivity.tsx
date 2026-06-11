import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useListContactNotesByJobIdQuery,
  useCreateContactNoteMutation,
  useUpdateContactNoteMutation,
  useDeleteContactNoteMutation,
} from "@/api/contactsApi";
import type { ContactNote } from "@/api/types";

export function JobActivity({
  jobId,
  contactKey,
}: {
  jobId: string;
  contactKey: string;
}) {
  const { data: notes = [], isLoading } = useListContactNotesByJobIdQuery(jobId);
  const [createNote] = useCreateContactNoteMutation();
  const [updateNote] = useUpdateContactNoteMutation();
  const [deleteNote] = useDeleteContactNoteMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContactNote | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setBody("");
    setOpen(true);
  }

  function openEdit(n: ContactNote) {
    setEditing(n);
    setBody(n.body);
    setOpen(true);
  }

  async function save() {
    const text = body.trim();
    if (!text) {
      toast.error("Note can't be empty");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateNote({ id: editing.id, body: { body: text } }).unwrap();
        toast.success("Note updated");
      } else {
        await createNote({ contact_key: contactKey, body: text, job_id: jobId }).unwrap();
        toast.success("Note added");
      }
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Record Activity</Label>
          <p className="text-xs text-muted-foreground">Notes specific to this job.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add note
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-4 text-xs text-muted-foreground text-center">Loading…</Card>
      ) : notes.length === 0 ? (
        <Card className="p-4 text-xs text-muted-foreground text-center">
          No notes for this job yet.
        </Card>
      ) : (
        <div className="grid gap-2">
          {notes.map((n) => {
            const when = new Date(n.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const edited =
              n.updated_at && n.updated_at !== n.created_at
                ? new Date(n.updated_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : null;
            return (
              <Card key={n.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {when}
                      </span>
                      {edited && <span className="italic">edited {edited}</span>}
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">{n.body}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(n)}
                      aria-label="Edit note"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(n.id)}
                      aria-label="Delete note"
                    >
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
              <Label htmlFor="job-note-body">Note</Label>
              <Textarea
                id="job-note-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
