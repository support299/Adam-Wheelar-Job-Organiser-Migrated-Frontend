export type JobProgressStatus = "pending" | "in_progress" | "done" | "cancelled";

export const JOB_PROGRESS_LABELS: Record<JobProgressStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const JOB_PROGRESS_REQUIRES_NOTES: JobProgressStatus[] = ["cancelled"];
