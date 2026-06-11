export const GOOGLE_MAPS_API_KEY_STORAGE_KEY = "google_maps_api_key_override";
export const DEFAULT_GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "AIzaSyCOdbXoS4xDGr930CG7oXmnCBQ-BcXk2hM";

function readOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GOOGLE_MAPS_API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const GOOGLE_MAPS_API_KEY: string = readOverride() || DEFAULT_GOOGLE_MAPS_API_KEY;
