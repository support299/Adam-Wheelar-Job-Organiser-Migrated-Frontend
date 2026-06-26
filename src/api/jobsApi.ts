import { baseApi } from "./baseApi";
import type { Job, JobInsert, JobUpdate, JobProduct, JobProductLine, JobCompletion, JobCompletionInsert } from "./types";

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ListJobsPagedArgs = {
  page: number;
  pageSize?: number;
  search?: string;
  status?: string;
  dueTag?: string;
  serviceDate?: string;
  staffId?: string;
};

export const jobsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listJobs: build.query<Job[], { ghl_contact_id?: string; dateFrom?: string; dateTo?: string } | void>({
      query: (args) => {
        const params = new URLSearchParams({ ordering: "service_date,service_time" });
        if (args?.ghl_contact_id) params.set("ghl_contact_id", args.ghl_contact_id);
        if (args?.dateFrom) params.set("service_date_from", args.dateFrom);
        if (args?.dateTo) params.set("service_date_to", args.dateTo);
        return `/jobs/?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Job" as const, id })), { type: "Job", id: "LIST" }]
          : [{ type: "Job", id: "LIST" }],
    }),
    listJobsPaged: build.query<Paginated<Job>, ListJobsPagedArgs>({
      query: ({ page, pageSize = 50, search, status, dueTag, serviceDate, staffId }) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        params.set("ordering", "service_date,service_time");
        if (search) params.set("search", search);
        if (status && status !== "all") params.set("status", status);
        if (dueTag && dueTag !== "all") params.set("due_tag", dueTag);
        if (serviceDate) params.set("service_date", serviceDate);
        if (staffId === "unassigned") params.set("unassigned", "true");
        else if (staffId && staffId !== "all") params.set("staff_id", staffId);
        return `/jobs/?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [...result.results.map(({ id }) => ({ type: "Job" as const, id })), { type: "Job", id: "LIST" }]
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
      providesTags: (_r, _e, jobId) => [{ type: "Job", id: `PRODUCTS-${jobId}` }],
    }),
    listAllJobProducts: build.query<JobProduct[], { ghl_contact_id?: string; service_type?: string } | void>({
      query: (params) => ({
        url: "/jobs/products/",
        params: params ?? {},
      }),
      providesTags: [{ type: "Job", id: "ALL-PRODUCTS" }],
    }),
    setJobProducts: build.mutation<void, { jobId: string; lines: JobProductLine[] }>({
      query: ({ jobId, lines }) => ({
        url: `/jobs/${jobId}/products/`,
        method: "PUT",
        body: { lines },
      }),
      invalidatesTags: (_r, _e, { jobId }) => [
        { type: "Job", id: `PRODUCTS-${jobId}` },
        { type: "Job", id: "ALL-PRODUCTS" },
      ],
    }),
    getJobStaff: build.query<{ staff_ids: string[] }, string>({
      query: (jobId) => `/jobs/${jobId}/staff/`,
      providesTags: (_r, _e, jobId) => [{ type: "Job", id: `STAFF-${jobId}` }],
    }),
    setJobStaff: build.mutation<void, { jobId: string; staffIds: string[] }>({
      query: ({ jobId, staffIds }) => ({
        url: `/jobs/${jobId}/staff/`,
        method: "PUT",
        body: { staff_ids: staffIds },
      }),
      invalidatesTags: (_r, _e, { jobId }) => [
        { type: "Job", id: `STAFF-${jobId}` },
        { type: "Job", id: jobId },
      ],
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
  useListJobsPagedQuery,
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
