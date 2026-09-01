import { baseApi } from "./baseApi";
import type { CallOutcome } from "@/lib/callLog";

export type NoteSource = "job" | "call";

/** One row of the unified contact notes feed (GET /jobs/notes/). */
export type ContactNoteFeedItem = {
  id: string;
  source: NoteSource;
  body: string;
  /** call date for calls, service date for job notes */
  date: string;
  outcome: CallOutcome | null;
  created_at: string;
  updated_at: string;
  job_id: string;
  job_service_date: string;
  job_status: string;
  job_service_type: string;
  job_payment_status: string;
  job_address: string;
};

export type ContactNotesFeedArgs = {
  ghl_contact_id?: string;
  email?: string;
  job_id?: string;
  /** omit for both sources */
  source?: NoteSource;
};

export const notesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    contactNotesFeed: build.query<ContactNoteFeedItem[], ContactNotesFeedArgs>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.ghl_contact_id) params.set("ghl_contact_id", args.ghl_contact_id);
        if (args.email) params.set("email", args.email);
        if (args.job_id) params.set("job_id", args.job_id);
        if (args.source) params.set("source", args.source);
        return `/jobs/notes/?${params.toString()}`;
      },
      // Feed is derived from Job.notes and JobCall rows — refresh when either changes.
      providesTags: [
        { type: "Job", id: "LIST" },
        { type: "JobCall", id: "LIST" },
      ],
    }),
  }),
});

export const { useContactNotesFeedQuery } = notesApi;
