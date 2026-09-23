/**
 * Upload queue for completed field forms.
 *
 * A plain module, not a hook and not an RTK Query endpoint, so a flush survives
 * the form unmounting and can run from a window event.
 *
 * It dispatches the EXISTING uploadJobAttachment mutation rather than calling
 * fetch directly. That inherits the 401 -> refresh -> retry flow in
 * baseQueryWithReauth and the JobAttachment cache invalidation. It matters:
 * queued items upload hours after they were created, by which point the access
 * token has very likely expired.
 */

import { store } from "@/store/store";
import { jobAttachmentsApi } from "@/api/jobAttachmentsApi";
import { db } from "@/db/dexie";
import { discardDraft } from "./draftStore";
import type { FieldFormOutboxItem, FieldFormType } from "./types";

const STALE_UPLOAD_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;

const nowIso = () => new Date().toISOString();

function backoffMs(attempts: number): number {
  const raw = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  // Jitter so several queued forms don't all retry on the same tick.
  return Math.round(raw * (0.8 + Math.random() * 0.4));
}

export type EnqueueInput = {
  jobId: string;
  formType: FieldFormType;
  fileName: string;
  jobLabel: string;
  bytes: ArrayBuffer;
};

/** Queue a rendered PDF and, if we're online, start pushing immediately. */
export async function enqueueUpload(input: EnqueueInput): Promise<FieldFormOutboxItem> {
  const item: FieldFormOutboxItem = {
    id: crypto.randomUUID(),
    jobId: input.jobId,
    formType: input.formType,
    fileName: input.fileName,
    jobLabel: input.jobLabel,
    mime: "application/pdf",
    bytes: input.bytes,
    status: "queued",
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.fieldFormOutbox.add(item);
  if (navigator.onLine) void flushOutbox();
  return item;
}

/** Anything left "uploading" by a tab that died goes back in the queue. */
async function reclaimStale(): Promise<void> {
  const cutoff = Date.now() - STALE_UPLOAD_MS;
  const stuck = await db.fieldFormOutbox.where("status").equals("uploading").toArray();
  for (const item of stuck) {
    if (new Date(item.updatedAt).getTime() < cutoff) {
      await db.fieldFormOutbox.update(item.id, { status: "queued", updatedAt: nowIso() });
    }
  }
}

/**
 * Claim an item transactionally, so two tabs flushing at once can't both grab
 * the same row and upload it twice.
 */
async function claim(id: string): Promise<FieldFormOutboxItem | null> {
  return db.transaction("rw", db.fieldFormOutbox, async () => {
    const fresh = await db.fieldFormOutbox.get(id);
    if (!fresh) return null;
    if (fresh.status !== "queued" && fresh.status !== "failed") return null;
    if (fresh.nextAttemptAt > Date.now()) return null;
    await db.fieldFormOutbox.update(id, { status: "uploading", updatedAt: nowIso() });
    return { ...fresh, status: "uploading" as const };
  });
}

/**
 * The server has no idempotency key, so a POST that succeeded but whose response
 * was lost would be re-sent as a duplicate. Before retrying anything that has
 * already been attempted, check whether the file is in fact already on the job.
 * First attempts skip this so the happy path stays one round-trip.
 */
async function alreadyUploaded(item: FieldFormOutboxItem): Promise<boolean> {
  if (item.attempts === 0) return false;
  const thunk = store.dispatch(
    jobAttachmentsApi.endpoints.listJobAttachments.initiate(item.jobId, { forceRefetch: true }),
  );
  try {
    const list = await thunk.unwrap();
    return list.some((a) => a.name === item.fileName);
  } catch {
    return false; // can't tell — fall through and try the upload
  } finally {
    thunk.unsubscribe();
  }
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") return true;
  if (typeof status === "number") return status >= 500;
  return false;
}

function describe(error: unknown): string {
  const data = (error as { data?: { detail?: string } })?.data;
  if (data?.detail) return data.detail;
  const status = (error as { status?: unknown })?.status;
  if (status === "FETCH_ERROR") return "No connection";
  if (status === "TIMEOUT_ERROR") return "The request timed out";
  if (typeof status === "number") return `Server returned ${status}`;
  return "Upload failed";
}

async function complete(item: FieldFormOutboxItem): Promise<void> {
  await db.fieldFormOutbox.delete(item.id);
  await discardDraft(item.formType, item.jobId);
}

async function uploadOne(item: FieldFormOutboxItem): Promise<void> {
  if (await alreadyUploaded(item)) {
    await complete(item);
    return;
  }

  const file = new File([item.bytes], item.fileName, { type: item.mime });
  const thunk = store.dispatch(
    jobAttachmentsApi.endpoints.uploadJobAttachment.initiate({ job: item.jobId, file }),
  );

  try {
    await thunk.unwrap();
    await complete(item);
    onUploaded?.(item);
  } catch (error) {
    const attempts = item.attempts + 1;
    const retryable = isRetryable(error) && attempts < MAX_ATTEMPTS;
    await db.fieldFormOutbox.update(item.id, {
      status: retryable ? "failed" : "blocked",
      attempts,
      lastError: describe(error),
      nextAttemptAt: retryable ? Date.now() + backoffMs(attempts) : 0,
      updatedAt: nowIso(),
    });
  } finally {
    thunk.reset();
  }
}

/** Set by OutboxRunner so a successful background upload can toast. */
let onUploaded: ((item: FieldFormOutboxItem) => void) | null = null;
export function setUploadListener(fn: ((item: FieldFormOutboxItem) => void) | null): void {
  onUploaded = fn;
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function scheduleNext(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const pending = await db.fieldFormOutbox
    .where("status")
    .anyOf("queued", "failed")
    .toArray();
  if (pending.length === 0) return;
  const soonest = Math.min(...pending.map((i) => i.nextAttemptAt));
  const delay = Math.max(1000, soonest - Date.now());
  timer = setTimeout(() => void flushOutbox(), delay);
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (!navigator.onLine) return;
  flushing = true;
  try {
    await reclaimStale();
    const candidates = await db.fieldFormOutbox
      .where("status")
      .anyOf("queued", "failed")
      .toArray();
    for (const candidate of candidates) {
      const claimed = await claim(candidate.id);
      if (!claimed) continue;
      try {
        await uploadOne(claimed);
      } catch (error) {
        // uploadOne handles its own upload failures; reaching here means
        // something unexpected threw (a Dexie error, a File constructor that
        // ran out of memory). Never leave a claimed row sitting in "uploading"
        // — claim() refuses that status, so the item would be invisible to
        // Retry until reclaimStale() times it out two minutes later.
        const attempts = claimed.attempts + 1;
        await db.fieldFormOutbox.update(claimed.id, {
          status: attempts < MAX_ATTEMPTS ? "failed" : "blocked",
          attempts,
          lastError: describe(error),
          nextAttemptAt: attempts < MAX_ATTEMPTS ? Date.now() + backoffMs(attempts) : 0,
          updatedAt: nowIso(),
        });
      }
    }
  } finally {
    flushing = false;
    await scheduleNext();
  }
}

/**
 * Manual retry of one item: clears the backoff so the next flush picks it up
 * immediately, and un-blocks a terminal failure for one more try.
 *
 * Deliberately does NOT reset `attempts`. uploadOne uses `attempts > 0` to
 * decide whether to run the "is this file already on the job?" check, so
 * zeroing it here would skip the duplicate guard on exactly the retry that
 * needs it — the one after a POST that succeeded but whose response was lost.
 * Leaving attempts alone also means a blocked item gets one try per tap rather
 * than a fresh run of ten automatic ones, which is what a manual retry should do.
 */
export async function retryItem(id: string): Promise<void> {
  await db.fieldFormOutbox.update(id, {
    status: "queued",
    lastError: null,
    nextAttemptAt: 0,
    updatedAt: nowIso(),
  });
  await flushOutbox();
}

/**
 * Manual "Retry now" for everything still waiting.
 *
 * This cannot just call flushOutbox(): claim() refuses any item whose backoff
 * deadline hasn't passed, so a plain flush right after a failure is a silent
 * no-op — which is precisely when the user reaches for the button. Clear the
 * deadlines first, then flush.
 */
export async function retryAll(): Promise<void> {
  const pending = await db.fieldFormOutbox
    .where("status")
    .anyOf("queued", "failed")
    .toArray();
  await Promise.all(
    pending.map((item) =>
      db.fieldFormOutbox.update(item.id, {
        status: "queued",
        lastError: null,
        nextAttemptAt: 0,
        updatedAt: nowIso(),
      }),
    ),
  );
  await flushOutbox();
}

export async function discardItem(id: string): Promise<void> {
  await db.fieldFormOutbox.delete(id);
}

/** Escape hatch for a blocked item: hand the tech the PDF to attach by hand. */
export async function downloadItem(id: string): Promise<void> {
  const item = await db.fieldFormOutbox.get(id);
  if (!item) return;
  const url = URL.createObjectURL(new Blob([item.bytes], { type: item.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = item.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
