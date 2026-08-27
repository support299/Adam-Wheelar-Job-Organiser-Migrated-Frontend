import { baseApi } from "./baseApi";
import type { Activity, ActivityInsert, ActivityUpdate } from "./types";

export const activitiesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listActivities: build.query<Activity[], void>({
      query: () => "/activities",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Activity" as const, id })), { type: "Activity", id: "LIST" }]
          : [{ type: "Activity", id: "LIST" }],
    }),
    createActivity: build.mutation<Activity, ActivityInsert>({
      query: (body) => ({ url: "/activities", method: "POST", body }),
      invalidatesTags: [{ type: "Activity", id: "LIST" }],
    }),
    updateActivity: build.mutation<Activity, { id: number; body: ActivityUpdate }>({
      query: ({ id, body }) => ({ url: `/activities/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Activity", id }, { type: "Activity", id: "LIST" }],
    }),
    deleteActivity: build.mutation<void, number>({
      query: (id) => ({ url: `/activities/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Activity", id: "LIST" }],
    }),
  }),
});

export const {
  useListActivitiesQuery,
  useCreateActivityMutation,
  useUpdateActivityMutation,
  useDeleteActivityMutation,
} = activitiesApi;
