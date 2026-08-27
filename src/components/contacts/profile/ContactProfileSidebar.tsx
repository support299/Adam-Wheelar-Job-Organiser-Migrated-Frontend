import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, CalendarClock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobMetaLine } from "@/components/contacts/profile/JobMetaLine";
import { fmtJobDate } from "@/components/contacts/profile/jobMeta";
import type { Job } from "@/api/types";

type PanelMode = "jobs" | "notes";

type Props = {
  jobs: Job[];
  fallbackName: string;
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  mode: PanelMode;
  onModeChange: (m: PanelMode) => void;
};

export function ContactProfileSidebar({ jobs, fallbackName, selectedId, onSelect, mode, onModeChange }: Props) {
  const summary = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => b.service_date.localeCompare(a.service_date));
    const emails = Array.from(
      new Set(sorted.map((j) => j.email?.trim()).filter((x): x is string => !!x)),
    );
    const phones = Array.from(
      new Set(sorted.map((j) => j.phone?.trim()).filter((x): x is string => !!x)),
    );
    const lifetimeValue = sorted.reduce((sum, j) => sum + Number(j.service_value || 0), 0);
    return {
      name: sorted[0]?.name ?? fallbackName,
      emails,
      phones,
      lifetimeValue,
      jobs: sorted,
    };
  }, [jobs, fallbackName]);

  return (
    <div className="flex flex-col min-h-0 md:border-r md:pr-4">
      <div className="space-y-2 pb-3 border-b">
        <div className="font-semibold leading-tight">{summary.name}</div>
        <div className="space-y-1">
          {summary.emails.map((e) => (
            <div key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{e}</span>
            </div>
          ))}
          {summary.phones.map((p) => (
            <div key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">{summary.jobs.length} job{summary.jobs.length === 1 ? "" : "s"}</Badge>
          <Badge variant="secondary">${summary.lifetimeValue.toFixed(2)} lifetime</Badge>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => onModeChange(v as PanelMode)} className="pt-3 pb-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="jobs" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Jobs
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "notes" ? (
        <p className="flex-1 text-xs text-muted-foreground pt-1">
          Every job's note is listed on the right.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-1.5">
          {summary.jobs.map((j) => {
            const active = j.id === selectedId;
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => onSelect(j.id)}
                className={cn(
                  "w-full text-left rounded-md border p-2 transition-colors",
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  {fmtJobDate(j.service_date)}
                </div>
                <div className="mt-0.5">
                  <JobMetaLine status={j.status} serviceType={j.service_type} paymentStatus={j.payment_status} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {j.address} · ${Number(j.service_value).toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
