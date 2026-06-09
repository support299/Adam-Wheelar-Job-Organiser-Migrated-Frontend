import { baseApi } from "./baseApi";

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<
      { access: string; refresh: string; email: string; id: number },
      { email: string; password: string }
    >({
      query: (body) => ({ url: "/auth/login/", method: "POST", body }),
    }),
    logout: build.mutation<void, { refresh: string }>({
      query: (body) => ({ url: "/auth/logout/", method: "POST", body }),
    }),
    refreshToken: build.mutation<{ access: string; email: string; id: number }, void>({
      query: () => ({ url: "/auth/token/refresh/", method: "POST" }),
    }),
    getMe: build.query<{ id: number; email: string }, void>({
      query: () => "/auth/me/",
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetMeQuery,
} = authApi;
