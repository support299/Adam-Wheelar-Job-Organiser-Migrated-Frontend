import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../store/store";
import { setCredentials, clearCredentials, REFRESH_KEY } from "../store/authSlice";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: "include",
  prepareHeaders(headers, { getState }) {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        { url: "/auth/token/refresh/", method: "POST", body: { refresh: refreshToken } },
        api,
        extraOptions,
      );
      if (refreshResult.data) {
        const data = refreshResult.data as { access: string; refresh?: string };
        api.dispatch(setCredentials({ accessToken: data.access, refreshToken: data.refresh }));
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(clearCredentials());
      }
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Job",
    "Staff",
    "Product",
    "Plan",
    "JobProgress",
    "Location",
    "Contact",
    "GhlUser",
    "ContactNote",
    "GhlToken",
  ],
  endpoints: () => ({}),
});
