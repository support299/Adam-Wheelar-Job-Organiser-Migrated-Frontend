import Dexie, { type Table } from "dexie";
import type { Job, SavedPlan, Staff, Product, JobProduct, BaseLocation } from "@/api/types";
import type { FieldFormDraft, FieldFormPhoto, FieldFormOutboxItem } from "@/lib/fieldForms/types";

/**
 * IndexedDB mirror of the read-only reference data PlansPage needs, so the
 * page can paint instantly from local cache (and keep working offline)
 * instead of blanking out until the network responds. RTK Query endpoints
 * write into these tables on every successful fetch (see onQueryStarted in
 * plansApi/staffApi/productsApi/jobsApi/locationsApi); PlansPage reads them
 * back via useLiveQuery as a fallback under the live network data.
 *
 * The fieldForm* tables (v3) are the exception: they are write-side, not a
 * mirror. Nothing on the server holds field-form state, so these rows are the
 * only copy of a technician's in-progress work until the PDF uploads.
 */
class AppDB extends Dexie {
  plans!: Table<SavedPlan, string>;
  staff!: Table<Staff, string>;
  products!: Table<Product, string>;
  jobProducts!: Table<JobProduct, string>;
  baseLocations!: Table<BaseLocation, string>;
  // Small key/value store for bookkeeping (e.g. "when did each endpoint last
  // sync successfully") — not one of the mirrored API tables above.
  meta!: Table<{ key: string; value: string }, string>;
  fieldFormDrafts!: Table<FieldFormDraft, string>;
  fieldFormPhotos!: Table<FieldFormPhoto, string>;
  fieldFormOutbox!: Table<FieldFormOutboxItem, string>;

  constructor() {
    super("job-organiser-cache");
    this.version(1).stores({
      plans: "id, plan_date",
      staff: "id",
      products: "id",
      jobProducts: "id, job_id",
      baseLocations: "id",
    });
    this.version(2).stores({
      meta: "key",
    });
    // Additive: existing tables are left alone, so cached plans/staff survive.
    this.version(3).stores({
      fieldFormDrafts: "id, jobId, updatedAt",
      fieldFormPhotos: "id, draftId",
      fieldFormOutbox: "id, status, createdAt, jobId",
    });
  }
}

export const db = new AppDB();

export async function getCachedPlans(
  dateFrom?: string,
  dateTo?: string,
  staffId?: string,
): Promise<SavedPlan[]> {
  const rows = dateFrom || dateTo
    ? await db.plans.where("plan_date").between(dateFrom ?? "0000-00-00", dateTo ?? "9999-99-99", true, true).toArray()
    : await db.plans.toArray();
  return staffId ? rows.filter((p) => (p.staff_ids ?? []).includes(staffId)) : rows;
}

export const getCachedStaff = () => db.staff.toArray();
export const getCachedProducts = () => db.products.toArray();
export const getCachedJobProducts = () => db.jobProducts.toArray();
export const getCachedBaseLocations = () => db.baseLocations.toArray();

export async function setLastFetchedAt(key: string, iso: string): Promise<void> {
  await db.meta.put({ key, value: iso });
}

export async function getLastFetchedAt(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

/* ---------------------------------------------------------------- field forms */

export const getFieldFormDraft = (id: string) => db.fieldFormDrafts.get(id);

export const getFieldFormPhotos = (draftId: string) =>
  db.fieldFormPhotos.where("draftId").equals(draftId).sortBy("capturedAt");

export const getOutboxItems = () => db.fieldFormOutbox.orderBy("createdAt").toArray();

/**
 * Offline job lookup for a direct load of /field-form/:type/:jobId, where the
 * job wasn't handed over via router state. Plans already cache their jobs
 * inline (SavedPlan.jobs), so this needs no network.
 */
export async function getCachedJobById(jobId: string): Promise<Job | null> {
  const plans = await db.plans.toArray();
  for (const p of plans) {
    const job = (p.jobs ?? []).find((j) => j.id === jobId);
    if (job) return job;
  }
  return null;
}
