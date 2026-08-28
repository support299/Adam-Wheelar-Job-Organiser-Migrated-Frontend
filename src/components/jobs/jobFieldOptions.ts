/** Shared option sets for the job forms (new-job dialog + profile editor). */

export const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

export function durationLabel(mins: number) {
  return mins < 60 ? `${mins} min` : `${mins / 60} hour${mins === 60 ? "" : "s"}`;
}

export const CALL_STATUS_OPTIONS = [
  { value: "not_called", label: "Not called" },
  { value: "connected", label: "Call connected" },
  { value: "not_connected", label: "Call not connected" },
  { value: "call_back", label: "Call back" },
];

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "completed", label: "Completed" },
  { value: "skip", label: "Skip this time" },
  { value: "not_interested", label: "Not interested anymore" },
];
