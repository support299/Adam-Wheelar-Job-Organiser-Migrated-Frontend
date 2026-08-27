import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useListJobsQuery } from "@/api/jobsApi";
import { ContactProfileSidebar } from "@/components/contacts/profile/ContactProfileSidebar";
import { JobEditorPane } from "@/components/contacts/profile/JobEditorPane";
import { ContactNotesList } from "@/components/contacts/profile/ContactNotesList";
import type { Job } from "@/api/types";

type PanelMode = "jobs" | "notes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The job whose pencil was clicked. Null while closed. */
  job: Job | null;
  /** Fired after a successful save, in addition to the modal closing. */
  onSaved?: () => void;
};

export function ContactProfileModal({ open, onOpenChange, job, onSaved }: Props) {
  const filter = job?.ghl_contact_id
    ? { ghl_contact_id: job.ghl_contact_id }
    : job?.email
    ? { email: job.email }
    : undefined;

  const { data: fetchedJobs = [], isLoading } = useListJobsQuery(filter, {
    skip: !open || !filter,
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(job?.id ?? null);
  const [mode, setMode] = useState<PanelMode>("jobs");

  // Re-seed the selection whenever a different pencil opens the modal.
  useEffect(() => {
    if (job) setSelectedJobId(job.id);
  }, [job]);

  // Always include the clicked job even if the contact fetch hasn't landed yet
  // or keys by a field the list filter missed.
  const jobs = useMemo(() => {
    if (!job) return fetchedJobs;
    return fetchedJobs.some((j) => j.id === job.id) ? fetchedJobs : [job, ...fetchedJobs];
  }, [fetchedJobs, job]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? job ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[64rem] w-[calc(100vw-1rem)] h-[95vh] max-h-[95vh] p-0 flex flex-col gap-0 overflow-hidden"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
      >
        <DialogHeader className="px-4 pt-4 sm:px-6 shrink-0">
          <DialogTitle>Contact profile</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-4 px-4 pb-4 pt-3 sm:px-6 overflow-y-auto md:overflow-hidden">
          <div className="min-h-0 max-h-[28vh] md:max-h-none overflow-hidden flex flex-col">
            <ContactProfileSidebar
              jobs={jobs}
              fallbackName={job?.name ?? "Contact"}
              selectedId={selectedJobId}
              onSelect={setSelectedJobId}
              mode={mode}
              onModeChange={setMode}
            />
          </div>

          <div className="min-h-0 overflow-hidden flex flex-col">
            {mode === "notes" ? (
              <ContactNotesList jobs={jobs} />
            ) : !selectedJob ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
                {isLoading ? "Loading…" : "Select a job"}
              </div>
            ) : (
              <JobEditorPane
                key={selectedJob.id}
                job={selectedJob}
                onSaved={() => {
                  onSaved?.();
                  onOpenChange(false);
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
