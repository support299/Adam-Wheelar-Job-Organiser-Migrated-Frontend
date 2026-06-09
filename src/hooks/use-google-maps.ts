import { useEffect, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<void> | null = null;

export function useGoogleMaps() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
    if (!apiKey) return;

    if (!loaderPromise) {
      setOptions({ key: apiKey, v: "weekly", libraries: ["places"] });
      loaderPromise = importLibrary("maps")
        .then(() => importLibrary("places"))
        .then(() => undefined);
    }

    const p = loaderPromise;
    p.then(() => setReady(true)).catch(() => setReady(false));
  }, []);

  return { ready };
}
