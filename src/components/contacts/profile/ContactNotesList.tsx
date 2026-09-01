import { useState } from "react";
import { CalendarClock, Phone, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobMetaLine } from "@/components/contacts/profile/JobMetaLine";
import { fmtJobDate } from "@/components/contacts/profile/jobMeta";
import { callOutcomeLabel } from "@/lib/callLog";
import {
  useContactNotesFeedQuery,
  type NoteSource,
  type ContactNotesFeedArgs,
} from "@/api/notesApi";

type Filter = "all" | NoteSource;

type Props = {
  /** Contact scope for the feed. Undefined while the modal has no job. */
  contactFilter?: { ghl_contact_id?: string; email?: string };
};

/** Read-only: job notes + call-log notes for a contact, in one scrollable feed. */
export function ContactNotesList({ contactFilter }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const args: ContactNotesFeedArgs = {
    ...contactFilter,
    source: filter === "all" ? undefined : filter,
  };
  const { data: items = [], isLoading, isFetching } = useContactNotesFeedQuery(args, {
    skip: !contactFilter,
  });

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <span className="text-sm font-medium">Notes</span>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="job" className="text-xs">Job notes</TabsTrigger>
            <TabsTrigger value="call" className="text-xs">Call notes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-3">
        {isLoading || (isFetching && items.length === 0) ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filter === "call"
              ? "No call notes for this contact."
              : filter === "job"
              ? "No job notes for this contact."
              : "No notes for this contact."}
          </p>
        ) : (
          items.map((n) => {
            const body = n.body.trim();
            return (
              <div key={n.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1",
                      n.source === "call" && "border-primary/40 text-primary",
                    )}
                  >
                    {n.source === "call" ? (
                      <>
                        <Phone className="h-3 w-3" /> Call
                      </>
                    ) : (
                      <>
                        <StickyNote className="h-3 w-3" /> Job note
                      </>
                    )}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {fmtJobDate(n.date)}
                  </span>
                  {n.source === "call" && n.outcome && (
                    <Badge variant="secondary">{callOutcomeLabel(n.outcome)}</Badge>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <JobMetaLine
                    status={n.job_status}
                    serviceType={n.job_service_type}
                    paymentStatus={n.job_payment_status}
                  />
                  <span className="text-[11px] text-muted-foreground truncate">· {n.job_address}</span>
                </div>

                <div
                  className={cn(
                    "mt-2 text-sm whitespace-pre-wrap break-words",
                    body ? "text-foreground" : "text-muted-foreground/60 italic",
                  )}
                >
                  {body || "No notes"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
