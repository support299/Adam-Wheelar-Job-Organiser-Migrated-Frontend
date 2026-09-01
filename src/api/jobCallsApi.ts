import { baseApi } from "./baseApi";
import type { CallLogEntry, CallLogDraft } from "@/lib/callLog";

type CreateArgs = CallLogDraft & { job: string };
type UpdateArgs = { id: number; job: string; patch: Partial<CallLogDraft> };
type DeleteArgs = { id: number; job: string };

const listTag = (jobId: string) => ({ type: "JobCall" as const, id: `LIST-${jobId}` });
// Broad tag the contact notes feed subscribes to.
const feedTag = { type: "JobCall" as const, id: "LIST" };

export const jobCallsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listJobCalls: build.query<CallLogEntry[], string>({
      query: (jobId) => `/jobs/calls/?job=${encodeURIComponent(jobId)}`,
      providesTags: (result, _e, jobId) =>
        result
          ? [...result.map((c) => ({ type: "JobCall" as const, id: c.id })), listTag(jobId)]
          : [listTag(jobId)],
    }),
    createJobCall: build.mutation<CallLogEntry, CreateArgs>({
      query: (body) => ({ url: "/jobs/calls/", method: "POST", body }),
      invalidatesTags: (_r, _e, { job }) => [listTag(job), feedTag],
    }),
    updateJobCall: build.mutation<CallLogEntry, UpdateArgs>({
      query: ({ id, patch }) => ({ url: `/jobs/calls/${id}/`, method: "PATCH", body: patch }),
      invalidatesTags: (_r, _e, { id, job }) => [{ type: "JobCall", id }, listTag(job), feedTag],
    }),
    deleteJobCall: build.mutation<void, DeleteArgs>({
      query: ({ id }) => ({ url: `/jobs/calls/${id}/`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { id, job }) => [{ type: "JobCall", id }, listTag(job), feedTag],
    }),
  }),
});

export const {
  useListJobCallsQuery,
  useCreateJobCallMutation,
  useUpdateJobCallMutation,
  useDeleteJobCallMutation,
} = jobCallsApi;
