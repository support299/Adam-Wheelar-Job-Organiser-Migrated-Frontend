import { baseApi } from "./baseApi";
import { db } from "@/db/dexie";
import type { BaseLocation, BaseLocationInsert, BaseLocationUpdate } from "./types";

export const locationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listBaseLocations: build.query<BaseLocation[], void>({
      query: () => "/locations/",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Location" as const, id })), { type: "Location", id: "LIST" }]
          : [{ type: "Location", id: "LIST" }],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.length) await db.baseLocations.bulkPut(data);
        } catch { /* offline or request failed — keep whatever is already cached */ }
      },
    }),
    createBaseLocation: build.mutation<BaseLocation, BaseLocationInsert>({
      query: (body) => ({ url: "/locations/", method: "POST", body }),
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
    updateBaseLocation: build.mutation<BaseLocation, { id: string; body: BaseLocationUpdate }>({
      query: ({ id, body }) => ({ url: `/locations/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Location", id }, { type: "Location", id: "LIST" }],
    }),
    deleteBaseLocation: build.mutation<void, string>({
      query: (id) => ({ url: `/locations/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
  }),
});

export const {
  useListBaseLocationsQuery,
  useCreateBaseLocationMutation,
  useUpdateBaseLocationMutation,
  useDeleteBaseLocationMutation,
} = locationsApi;
