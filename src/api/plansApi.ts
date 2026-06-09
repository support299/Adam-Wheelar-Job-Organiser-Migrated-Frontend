import { baseApi } from "./baseApi";
import type { SavedPlan, SavedPlanInsert, SavedPlanUpdate, JobProgress } from "./types";

export const plansApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listPlans: build.query<SavedPlan[], void>({
      query: () => "/plans/?ordering=-plan_date",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Plan" as const, id })), { type: "Plan", id: "LIST" }]
          : [{ type: "Plan", id: "LIST" }],
    }),
    createPlan: build.mutation<SavedPlan, SavedPlanInsert>({
      query: (body) => ({ url: "/plans/", method: "POST", body }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),
    updatePlan: build.mutation<SavedPlan, { id: string; body: SavedPlanUpdate }>({
      query: ({ id, body }) => ({ url: `/plans/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Plan", id }, { type: "Plan", id: "LIST" }],
    }),
    deletePlan: build.mutation<void, string>({
      query: (id) => ({ url: `/plans/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Plan", id: "LIST" }],
    }),
    listJobProgress: build.query<JobProgress[], string>({
      query: (planId) => `/progress/?plan_id=${planId}`,
      providesTags: [{ type: "JobProgress", id: "LIST" }],
    }),
    listAllJobProgress: build.query<JobProgress[], void>({
      query: () => "/progress/",
      providesTags: [{ type: "JobProgress", id: "LIST" }],
    }),
    upsertJobProgress: build.mutation<
      JobProgress,
      { plan_id: string; job_id: string; staff_id: string; status: string; actual_km?: number | null; notes?: string | null }
    >({
      query: (body) => ({ url: "/progress/upsert/", method: "POST", body }),
      invalidatesTags: [{ type: "JobProgress", id: "LIST" }],
    }),
  }),
});

export const {
  useListPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useListJobProgressQuery,
  useListAllJobProgressQuery,
  useUpsertJobProgressMutation,
} = plansApi;
