import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const ACCESS_KEY = "rdp_access";
const REFRESH_KEY = "rdp_refresh";

interface AuthState {
  accessToken: string | null;
}

const initialState: AuthState = {
  accessToken: localStorage.getItem(ACCESS_KEY),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; refreshToken?: string }>) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem(ACCESS_KEY, action.payload.accessToken);
      if (action.payload.refreshToken) {
        localStorage.setItem(REFRESH_KEY, action.payload.refreshToken);
      }
    },
    clearCredentials(state) {
      state.accessToken = null;
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },
  },
});

export { REFRESH_KEY };
export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
