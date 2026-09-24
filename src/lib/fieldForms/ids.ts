/**
 * Local id generation for the field-forms feature.
 *
 * `crypto.randomUUID()` is restricted to secure contexts — HTTPS, localhost or
 * 127.0.0.1. Reaching the dev server from a real phone means a LAN origin like
 * http://192.168.1.20:5173, where `crypto` exists but `randomUUID` does not, so
 * calling it throws "crypto.randomUUID is not a function". Safari before 15.4
 * lacks it on any origin, which matters for an app running on whatever handset
 * the technician happens to carry.
 *
 * `crypto.getRandomValues()` is NOT secure-context-gated, so it stays available
 * on plain HTTP and covers the realistic case.
 *
 * These ids are opaque local keys — Dexie primary keys and an outbox row id.
 * Nothing parses them or depends on RFC 4122 layout (the upload filename is
 * built by the caller, not from the id), so this returns plain random hex
 * rather than performing the version/variant bit-twiddling a real UUID needs.
 */
export function randomId(): string {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === "function") return c.randomUUID();

  if (typeof c?.getRandomValues === "function") {
    return Array.from(c.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }

  // Last resort, for an engine with no Web Crypto at all. Weaker, but these are
  // per-device keys that never leave the phone, and a failed id would cost the
  // technician the whole visit's paperwork.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
