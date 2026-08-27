import { useMemo } from "react";
import { CalendarClock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobMetaLine } from "@/components/contacts/profile/JobMetaLine";
import { fmtJobDate } from "@/components/contacts/profile/jobMeta";
import type { Job } from "@/api/types";

type Props = {
  jobs: Job[];
};

/** Read-only: every job for this contact and its note, in one scrollable place. */
export function ContactNotesList({ jobs }: Props) {
  const sorted = useMemo(
    () => [...jobs].sort((a, b) => b.service_date.localeCompare(a.service_date)),
    [jobs],
  );
  const withNotes = sorted.filter((j) => j.notes?.trim());

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between border-b pb-3">
        <span className="text-sm font-medium">Job notes</span>
        <span className="text-xs text-muted-foreground">
          {withNotes.length} of {sorted.length} job{sorted.length === 1 ? "" : "s"} have notes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs for this contact.</p>
        ) : (
          sorted.map((j) => {
            const note = j.notes?.trim();
            return (
              <div key={j.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {fmtJobDate(j.service_date)}
                  </span>
                  <JobMetaLine status={j.status} serviceType={j.service_type} paymentStatus={j.payment_status} />
                  <span className="text-[11px] text-muted-foreground truncate">· {j.address}</span>
                </div>
                <div
                  className={cn(
                    "mt-2 text-sm whitespace-pre-wrap break-words",
                    note ? "text-foreground" : "text-muted-foreground/60 italic",
                  )}
                >
                  {note ?? (
                    <span className="inline-flex items-center gap-1">
                      <StickyNote className="h-3.5 w-3.5" /> No note
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
