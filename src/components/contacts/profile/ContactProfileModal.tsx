import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetJobQuery, useListJobsQuery } from "@/api/jobsApi";
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
  // The job passed in may be a trimmed row (Daily Planner / Map View request a
  // sparse fieldset). Fetch the complete record before editing so JobEditorPane
  // — which snapshots every field from props on mount — seeds correctly.
  const { data: fetchedFull, isError: fullJobError } = useGetJobQuery(job?.id ?? "", {
    skip: !open || !job?.id,
  });
  // Fall back to the passed-in row if the per-id fetch fails, so the modal is
  // never permanently stuck loading.
  const fullJob = fetchedFull ?? (fullJobError ? job ?? undefined : undefined);
  const clickedJob = fullJob ?? job;
  const loadingClickedJob = !!job && !fullJob;

  const filter = clickedJob?.ghl_contact_id
    ? { ghl_contact_id: clickedJob.ghl_contact_id }
    : clickedJob?.email
    ? { email: clickedJob.email }
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

  // Only surface fully-loaded jobs. Include the clicked job from its own fetch
  // in case the contact list hasn't landed yet or keys by a field it missed.
  const jobs = useMemo(() => {
    if (!fullJob) return fetchedJobs;
    return fetchedJobs.some((j) => j.id === fullJob.id) ? fetchedJobs : [fullJob, ...fetchedJobs];
  }, [fetchedJobs, fullJob]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

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
              <ContactNotesList contactFilter={filter} />
            ) : !selectedJob ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
                {isLoading || loadingClickedJob ? "Loading…" : "Select a job"}
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
