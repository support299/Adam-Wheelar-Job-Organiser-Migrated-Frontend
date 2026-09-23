import logoPng from "@/assets/ecw-logo.png?inline";

/**
 * The East Coast Water Solutions logo for the PDF header.
 *
 * Extracted from the original ECW Field Forms HTML, where it lived as a ~222KB
 * base64 string on a single source line. Keeping it as a real .png here means
 * the file can be opened and replaced like any other asset, and it stays out of
 * source diffs.
 *
 * `?inline` is load-bearing, not a convenience. Vite turns the asset into a
 * data URI inside the JS bundle. A plain import would emit a URL instead, and
 * the service worker's globPatterns in vite.config.ts cover only js/css/html/svg
 * — not png — so the logo would 404 exactly when a technician generates a PDF
 * with no signal, which is the normal case.
 */
export const ECW_LOGO: string | null = logoPng;

/** Intrinsic width ÷ height (640 × 411), so the PDF never stretches it. */
export const ECW_LOGO_ASPECT = 640 / 411;
