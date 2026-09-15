import { baseApi } from "./baseApi";
import { db } from "@/db/dexie";
import type { Job, JobInsert, JobUpdate, JobProduct, JobProductLine, PurchaseHistoryRow } from "./types";

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
    listJobs: build.query<Job[], { ghl_contact_id?: string; email?: string; search?: string; dateFrom?: string; dateTo?: string; fields?: string } | void>({
      query: (args) => {
        const params = new URLSearchParams({ ordering: "service_date,service_time" });
        if (args?.ghl_contact_id) params.set("ghl_contact_id", args.ghl_contact_id);
        if (args?.email) params.set("email", args.email);
        if (args?.search) params.set("search", args.search);
        if (args?.dateFrom) params.set("service_date_from", args.dateFrom);
        if (args?.dateTo) params.set("service_date_to", args.dateTo);
        // Sparse fieldset — callers that only need a few columns (Daily Planner,
        // Map View) pass this to keep the payload small.
        if (args?.fields) params.set("fields", args.fields);
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
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Only cache the unfiltered fetch (PlansPage's call) — a filtered
          // one (e.g. by ghl_contact_id) is a subset and would leave stale
          // rows in place for jobs outside that filter, which is fine since
          // bulkPut never deletes, but skip it to avoid confusing partial writes.
          if (!arg && data.length) await db.jobProducts.bulkPut(data);
        } catch { /* offline or request failed — keep whatever is already cached */ }
      },
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
    listPurchaseHistory: build.query<PurchaseHistoryRow[], { email?: string; ghl_contact_id?: string }>({
      query: (params) => ({ url: '/jobs/purchase-history/', params }),
      providesTags: [{ type: 'Job', id: 'PURCHASE-HISTORY' }],
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
  useListPurchaseHistoryQuery,
  useLazyListPurchaseHistoryQuery,
} = jobsApi;
