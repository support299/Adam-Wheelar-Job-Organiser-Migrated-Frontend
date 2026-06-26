import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

const ACCESS_KEY = "rdp_access";
const REFRESH_KEY = "rdp_refresh";

function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

function extractIsAdmin(token: string | null): boolean | null {
  if (!token) return null;
  const payload = decodeJwt(token);
  return typeof payload.is_admin === "boolean" ? payload.is_admin : null;
}

interface AuthState {
  accessToken: string | null;
  isAdmin: boolean | null;
}

const storedToken = localStorage.getItem(ACCESS_KEY);
const initialState: AuthState = {
  accessToken: storedToken,
  isAdmin: extractIsAdmin(storedToken),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; refreshToken?: string }>) {
      state.accessToken = action.payload.accessToken;
      state.isAdmin = extractIsAdmin(action.payload.accessToken);
      localStorage.setItem(ACCESS_KEY, action.payload.accessToken);
      if (action.payload.refreshToken) {
        localStorage.setItem(REFRESH_KEY, action.payload.refreshToken);
      }
    },
    clearCredentials(state) {
      state.accessToken = null;
      state.isAdmin = null;
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },
  },
});

export { REFRESH_KEY };
export const { setCredentials, clearCredentials } = authSlice.actions;
export const selectIsAdmin = (s: RootState) => s.auth.isAdmin;
export default authSlice.reducer;
