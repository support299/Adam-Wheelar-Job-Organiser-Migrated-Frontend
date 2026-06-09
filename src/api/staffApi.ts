import { baseApi } from "./baseApi";
import type { Staff, StaffInsert, StaffUpdate } from "./types";

export const staffApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listStaff: build.query<Staff[], void>({
      query: () => "/staff/",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Staff" as const, id })), { type: "Staff", id: "LIST" }]
          : [{ type: "Staff", id: "LIST" }],
    }),
    createStaff: build.mutation<Staff, StaffInsert>({
      query: (body) => ({ url: "/staff/", method: "POST", body }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),
    updateStaff: build.mutation<Staff, { id: string; body: StaffUpdate }>({
      query: ({ id, body }) => ({ url: `/staff/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Staff", id }, { type: "Staff", id: "LIST" }],
    }),
    deleteStaff: build.mutation<void, string>({
      query: (id) => ({ url: `/staff/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),
    createStaffAuth: build.mutation<
      { ok: boolean; updated: boolean; skipped: boolean; message?: string },
      { email: string; password: string }
    >({
      query: (body) => ({ url: "/staff/create-auth/", method: "POST", body }),
    }),
    listJobStaff: build.query<{ job_id: string; staff_id: string }[], void>({
      query: () => "/staff/all-assignments/",
    }),
  }),
});

export const {
  useListStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useCreateStaffAuthMutation,
  useListJobStaffQuery,
} = staffApi;
