/**
 * Shared types + display helpers for the per-job call log.
 * The data lives on the backend — see src/api/jobCallsApi.ts.
 *   GET    /api/jobs/calls/?job=<jobId>
 *   POST   /api/jobs/calls/
 *   PATCH  /api/jobs/calls/<id>/
 *   DELETE /api/jobs/calls/<id>/
 */

export type CallOutcome = "connected" | "not_connected" | "call_back" | "no_answer";

export type CallLogEntry = {
  id: number;
  job: string;
  /** ISO date (YYYY-MM-DD) the call is planned for / was made on. */
  date: string;
  notes: string;
  /** Set once the call has happened; null while it's still just planned. */
  outcome: CallOutcome | null;
  created_at: string;
  updated_at: string;
};

/** Editable fields of a call entry. */
export type CallLogDraft = {
  date: string;
  notes: string;
  outcome: CallOutcome | null;
};

export const CALL_OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "not_connected", label: "Not connected" },
  { value: "call_back", label: "Call back" },
  { value: "no_answer", label: "No answer" },
];

export function callOutcomeLabel(outcome: CallOutcome | null): string {
  return CALL_OUTCOME_OPTIONS.find((o) => o.value === outcome)?.label ?? "Not logged";
}
