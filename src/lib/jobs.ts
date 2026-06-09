export type RecurrenceFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannually"
  | "annually";

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannually: "Semi-Annually",
  annually: "Annually",
};

export function addFrequency(dateStr: string, freq: RecurrenceFrequency): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  switch (freq) {
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "quarterly":
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
    case "semiannually":
      date.setUTCMonth(date.getUTCMonth() + 6);
      break;
    case "annually":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }
  return date.toISOString().slice(0, 10);
}

export function nextDueDate(dateStr: string, freq: RecurrenceFrequency): string {
  const today = new Date().toISOString().slice(0, 10);
  let next = dateStr;
  for (let i = 0; i < 1000 && next < today; i++) {
    next = addFrequency(next, freq);
  }
  return next;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function optimizeRoute<T extends { lat: number; lng: number }>(
  jobs: T[],
  start?: { lat: number; lng: number },
): { ordered: T[]; totalKm: number } {
  if (jobs.length === 0) return { ordered: [], totalKm: 0 };
  const remaining = [...jobs];
  const ordered: T[] = [];
  let current = start ?? remaining[0];
  if (!start) {
    ordered.push(remaining.shift()!);
    current = ordered[0];
  }
  let total = 0;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    total += bestDist;
    current = remaining[bestIdx];
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return { ordered, totalKm: total };
}

export function estimateMinutes(km: number) {
  return Math.round((km / 40) * 60);
}

export function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "#000000";
    case "scheduled":
      return "#16a34a";
    case "pending":
      return "#2563eb";
    default:
      return "#2563eb";
  }
}

export type DueTag = "overdue" | "due_7" | "due_15" | "due_30" | "due_60";

export const DUE_TAG_LABELS: Record<DueTag, string> = {
  overdue: "Service Overdue",
  due_7: "Service Due in 07 Days",
  due_15: "Service Due in 15 Days",
  due_30: "Service Due in 30 Days",
  due_60: "Service Due in 60 Days",
};

export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const due = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

export function getDueTag(job: { service_date: string; status: string }): DueTag | null {
  if (job.status === "completed") return null;
  const days = daysUntil(job.service_date);
  if (days < 0) return "overdue";
  if (days <= 7) return "due_7";
  if (days <= 15) return "due_15";
  if (days <= 30) return "due_30";
  if (days <= 60) return "due_60";
  return null;
}
