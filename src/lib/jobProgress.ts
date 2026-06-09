export type JobProgressStatus = "pending" | "in_progress" | "done" | "skipped" | "cancelled" | "not_completed";

export const JOB_PROGRESS_LABELS: Record<JobProgressStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  skipped: "Skipped",
  cancelled: "Cancelled",
  not_completed: "Not Completed",
};

export const JOB_PROGRESS_REQUIRES_NOTES: JobProgressStatus[] = ["cancelled", "not_completed"];
