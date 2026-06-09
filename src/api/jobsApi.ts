import { baseApi } from "./baseApi";
import type { Job, JobInsert, JobUpdate, JobProduct, JobProductLine, JobCompletion, JobCompletionInsert } from "./types";

export const jobsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listJobs: build.query<Job[], void>({
      query: () => "/jobs/?ordering=service_date,service_time",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Job" as const, id })), { type: "Job", id: "LIST" }]
          : [{ type: "Job", id: "LIST" }],
    }),
    getJob: build.query<Job, string>({
      query: (id) => `/jobs/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Job", id }],
    }),
    createJob: build.mutation<Job, JobInsert>({
      query: (body) => ({ url: "/jobs/", method: "POST", body }),
      invalidatesTags: [{ type: "Job", id: "LIST" }],
    }),
    updateJob: build.mutation<Job, { id: string; body: JobUpdate }>({
      query: ({ id, body }) => ({ url: `/jobs/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Job", id }, { type: "Job", id: "LIST" }],
    }),
    deleteJob: build.mutation<void, string>({
      query: (id) => ({ url: `/jobs/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Job", id: "LIST" }],
    }),
    getJobProducts: build.query<JobProduct[], string>({
      query: (jobId) => `/jobs/${jobId}/products/`,
    }),
    listAllJobProducts: build.query<JobProduct[], void>({
      query: () => "/jobs/products/",
    }),
    setJobProducts: build.mutation<void, { jobId: string; lines: JobProductLine[] }>({
      query: ({ jobId, lines }) => ({
        url: `/jobs/${jobId}/products/`,
        method: "PUT",
        body: { lines },
      }),
    }),
    getJobStaff: build.query<{ staff_ids: string[] }, string>({
      query: (jobId) => `/jobs/${jobId}/staff/`,
    }),
    setJobStaff: build.mutation<void, { jobId: string; staffIds: string[] }>({
      query: ({ jobId, staffIds }) => ({
        url: `/jobs/${jobId}/staff/`,
        method: "PUT",
        body: { staff_ids: staffIds },
      }),
    }),
    listJobCompletions: build.query<JobCompletion[], void>({
      query: () => "/completions/?ordering=-completed_at",
      providesTags: [{ type: "Job", id: "COMPLETIONS" }],
    }),
    createJobCompletion: build.mutation<JobCompletion, JobCompletionInsert>({
      query: (body) => ({ url: "/completions/", method: "POST", body }),
      invalidatesTags: [{ type: "Job", id: "COMPLETIONS" }],
    }),
    updateJobCompletion: build.mutation<
      JobCompletion,
      { id: string; body: Partial<JobCompletion> }
    >({
      query: ({ id, body }) => ({ url: `/completions/${id}/`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Job", id: "COMPLETIONS" }],
    }),
    deleteJobCompletion: build.mutation<void, string>({
      query: (id) => ({ url: `/completions/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Job", id: "COMPLETIONS" }],
    }),
  }),
});

export const {
  useListJobsQuery,
  useGetJobQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useGetJobProductsQuery,
  useListAllJobProductsQuery,
  useSetJobProductsMutation,
  useGetJobStaffQuery,
  useSetJobStaffMutation,
  useListJobCompletionsQuery,
  useCreateJobCompletionMutation,
  useUpdateJobCompletionMutation,
  useDeleteJobCompletionMutation,
} = jobsApi;
