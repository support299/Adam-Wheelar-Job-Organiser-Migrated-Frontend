const FALLBACK_HOST = "app.performglobe.com";
const FALLBACK_LOCATION_ID = "hrSVfYXa621UUa4fO72r";
const LS_KEY = "ghl_ctx_v1";

function parseFromUrl(url: string): { host: string; locationId: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/v2\/location\/([^/]+)/);
    if (!m) return null;
    return { host: u.host, locationId: m[1] };
  } catch {
    return null;
  }
}

export function getGhlContext(): { host: string; locationId: string | null } {
  if (typeof window === "undefined") return { host: FALLBACK_HOST, locationId: null };
  const fromRef = document.referrer ? parseFromUrl(document.referrer) : null;
  if (fromRef) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(fromRef)); } catch { /* ignore */ }
    return fromRef;
  }
  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { host?: string; locationId?: string };
      if (parsed.host && parsed.locationId) return { host: parsed.host, locationId: parsed.locationId };
    }
  } catch { /* ignore */ }
  const ancestors = (location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    try { return { host: new URL(ancestors[0]).host, locationId: FALLBACK_LOCATION_ID }; } catch { /* ignore */ }
  }
  return { host: FALLBACK_HOST, locationId: FALLBACK_LOCATION_ID };
}

export function buildGhlContactUrl(contactId: string): string {
  const { host, locationId } = getGhlContext();
  const loc = locationId ?? FALLBACK_LOCATION_ID;
  return `https://${host}/v2/location/${loc}/contacts/detail/${contactId}`;
}
