import type { Staff, Product, JobInsert, JobProductLine } from "@/api/types";

/**
 * Parses "YYYYMMDDHHMMSS" (14 digits) or a date-only "YYYYMMDD" (8 digits).
 * For the date-only form, `time` is null so callers can leave the form's own
 * default time in place rather than overwriting it with a fake midnight.
 * Returns null on malformed input.
 */
export function parseCompactDateTime(
  raw: string | null,
): { date: string; time: string | null; iso: string } | null {
  if (!raw) return null;
  const isDateOnly = /^\d{8}$/.test(raw);
  const isFull = /^\d{14}$/.test(raw);
  if (!isDateOnly && !isFull) return null;
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  if (isDateOnly) {
    return { date: `${y}-${mo}-${d}`, time: null, iso: `${y}-${mo}-${d}T00:00:00Z` };
  }
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const s = raw.slice(12, 14);
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, iso: `${y}-${mo}-${d}T${h}:${mi}:${s}Z` };
}

export type ParsedMigrationPrefill = {
  values: Partial<JobInsert>;
  staffIds: string[];
  lineItems: JobProductLine[];
  contactSearchTerm: string;
  warnings: string[];
};

/**
 * Reads the migrate-job URL params into job-form prefill data. Staff and
 * products are matched by name (case-insensitive) against already-fetched
 * lists rather than by ID, since the source CSV has names, not IDs.
 * Unmatched names are surfaced as warnings, never a hard failure — the
 * operator can always fix a miss manually via the normal pickers.
 */
export function parseMigrationPrefill(
  params: URLSearchParams,
  staff: Staff[],
  products: Product[],
): ParsedMigrationPrefill {
  const warnings: string[] = [];
  const values: Partial<JobInsert> = {};

  const address = params.get("address");
  if (address) values.address = address;
  const lat = params.get("lat");
  const lng = params.get("lng");
  if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    values.lat = Number(lat);
    values.lng = Number(lng);
  }

  const serviceDatetimeRaw = params.get("service_datetime");
  const serviceDatetime = parseCompactDateTime(serviceDatetimeRaw);
  if (serviceDatetime) {
    values.service_date = serviceDatetime.date;
    const serviceTime = serviceDatetime.time;
    if (serviceTime) values.service_time = serviceTime;
  } else if (serviceDatetimeRaw) {
    warnings.push(`Invalid service_datetime: "${serviceDatetimeRaw}"`);
  }

  const completedAtRaw = params.get("completed_at");
  const completedAt = parseCompactDateTime(completedAtRaw);
  if (completedAt) {
    values.completed_at = completedAt.iso;
  } else if (completedAtRaw) {
    warnings.push(`Invalid completed_at: "${completedAtRaw}"`);
  }

  const duration = params.get("duration");
  if (duration) values.duration = parseInt(duration, 10);
  const serviceValue = params.get("service_value");
  if (serviceValue) values.service_value = parseFloat(serviceValue);
  const serviceType = params.get("service_type");
  if (serviceType === "installation" || serviceType === "servicing") values.service_type = serviceType;
  const saleDate = params.get("sale_date");
  if (saleDate) values.sale_date = saleDate;
  const status = params.get("status");
  if (status) values.status = status;
  const callStatus = params.get("call_status");
  if (callStatus) values.call_status = callStatus;
  const notes = params.get("notes");
  if (notes) values.notes = notes;
  const isRecurring = params.get("is_recurring");
  if (isRecurring !== null) values.is_recurring = isRecurring === "1" || isRecurring === "true";
  const frequency = params.get("frequency");
  if (frequency) values.frequency = frequency;
  const occurrences = params.get("occurrences");
  if (occurrences) values.occurrences = parseInt(occurrences, 10);

  // Substring match (not exact) — "new us" should find "New User" — against
  // active user-role staff, falling back to admin-role staff when there's no
  // user-role staff at all (mirrors the assignable-staff fallback used
  // elsewhere on the migrate-job page for small setups with only an admin
  // account). Ambiguous matches are surfaced as a warning rather than guessed.
  const staffIds: string[] = [];
  const staffNamesParam = params.get("staff_names");
  if (staffNamesParam) {
    const userStaff = staff.filter((s) => s.role === "user" && s.active);
    const staffPool = userStaff.length > 0 ? userStaff : staff.filter((s) => s.role === "admin" && s.active);
    for (const rawName of staffNamesParam.split(",").map((s) => s.trim()).filter(Boolean)) {
      const target = rawName.toLowerCase();
      const matches = staffPool.filter((s) => s.name.trim().toLowerCase().includes(target));
      if (matches.length === 1) {
        staffIds.push(matches[0].id);
      } else if (matches.length === 0) {
        warnings.push(`Staff not found: "${rawName}"`);
      } else {
        warnings.push(`Multiple staff match "${rawName}": ${matches.map((m) => m.name).join(", ")}`);
      }
    }
  }

  // Matched by name only — quantity/unit_price always come from the catalog
  // default (qty 1, current product price), never overridden by the URL.
  const lineItems: JobProductLine[] = [];
  const productsParam = params.get("products");
  if (productsParam) {
    try {
      const raw = JSON.parse(productsParam) as string[];
      for (const name of raw) {
        const target = name.trim().toLowerCase();
        const match = products.find((p) => p.name.trim().toLowerCase() === target);
        if (match) {
          lineItems.push({ product_id: match.id, quantity: 1, unit_price: Number(match.price) });
        } else {
          warnings.push(`Product not found: "${name}"`);
        }
      }
    } catch {
      warnings.push(`Could not parse "products" param — invalid JSON`);
    }
  }

  return {
    values,
    staffIds,
    lineItems,
    contactSearchTerm: params.get("contact_search") ?? "",
    warnings,
  };
}
