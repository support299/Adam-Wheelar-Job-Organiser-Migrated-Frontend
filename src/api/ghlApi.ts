import { baseApi } from "./baseApi";
import type { GhlTokenStatus, GhlInstallConfig } from "./types";

export const ghlApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGhlStatus: build.query<GhlTokenStatus, void>({
      query: () => "/ghl/status/",
      providesTags: [{ type: "GhlToken", id: "STATUS" }],
    }),
    getGhlConfig: build.query<GhlInstallConfig, void>({
      query: () => "/ghl/config/",
    }),
    refreshGhlToken: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: "/ghl/refresh/", method: "POST" }),
      invalidatesTags: [{ type: "GhlToken", id: "STATUS" }],
    }),
  }),
});

export const {
  useGetGhlStatusQuery,
  useGetGhlConfigQuery,
  useRefreshGhlTokenMutation,
} = ghlApi;
