/** Short, plain-language labels for the raw job enums. */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  completed: "Completed",
  skip: "Skipped",
  not_interested: "Not interested",
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Install",
  servicing: "Service",
  ad_hoc: "Ad-hoc",
  workshop: "Workshop",
};

export function statusDotClass(s: string) {
  switch (s) {
    case "completed": return "bg-emerald-500";
    case "scheduled": return "bg-blue-500";
    case "rescheduled": return "bg-orange-500";
    case "not_interested": return "bg-rose-500";
    case "skip": return "bg-slate-400";
    default: return "bg-amber-500";
  }
}

export function fmtJobDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
