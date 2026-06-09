import { baseApi } from "./baseApi";
import type { StaffPayout } from "./types";

type StaffPayoutInsert = {
  staff_id: string;
  period_from: string;
  period_to: string;
  amount: number;
  notes: string | null;
};

export const staffPayoutsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listStaffPayouts: build.query<StaffPayout[], void>({
      query: () => "/staff/payouts/",
      providesTags: [{ type: "Staff", id: "PAYOUTS" }],
    }),
    createStaffPayout: build.mutation<StaffPayout, StaffPayoutInsert>({
      query: (body) => ({ url: "/staff/payouts/", method: "POST", body }),
      invalidatesTags: [{ type: "Staff", id: "PAYOUTS" }],
    }),
    deleteStaffPayout: build.mutation<void, string>({
      query: (id) => ({ url: `/staff/payouts/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Staff", id: "PAYOUTS" }],
    }),
  }),
});

export const {
  useListStaffPayoutsQuery,
  useCreateStaffPayoutMutation,
  useDeleteStaffPayoutMutation,
} = staffPayoutsApi;
