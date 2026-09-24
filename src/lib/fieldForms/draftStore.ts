/**
 * Dexie CRUD for field-form drafts and their photos.
 *
 * Drafts are deliberately small (a few KB) so the 400ms debounced autosave can
 * rewrite the whole record on every keystroke without cost. Photo binaries live
 * in a sibling table keyed by draftId for exactly that reason.
 */

import { db } from "@/db/dexie";
import { randomId } from "./ids";
import type { Job } from "@/api/types";
import type {
  FieldFormDraft,
  FieldFormPhoto,
  FieldFormType,
  FieldFormValues,
  JobSnapshot,
} from "./types";

export const draftIdFor = (formType: FieldFormType, jobId: string) => `${formType}:${jobId}`;

const nowIso = () => new Date().toISOString();

/** Freeze the job fields the form needs, so it never depends on a fetch again. */
export function toJobSnapshot(job: Job): JobSnapshot {
  return {
    jobId: job.id,
    name: job.name ?? "",
    email: job.email ?? "",
    phone: job.phone ?? "",
    address: job.address ?? "",
    serviceDate: job.service_date ?? "",
    serviceTime: job.service_time ?? "",
    serviceType: job.service_type ?? "",
    staffIds: job.staff_ids ?? [],
  };
}

export async function saveDraft(
  formType: FieldFormType,
  job: JobSnapshot,
  values: FieldFormValues,
): Promise<void> {
  const id = draftIdFor(formType, job.jobId);
  const existing = await db.fieldFormDrafts.get(id);
  const draft: FieldFormDraft = {
    id,
    jobId: job.jobId,
    formType,
    job,
    values,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await db.fieldFormDrafts.put(draft);
}

export const loadDraft = (formType: FieldFormType, jobId: string) =>
  db.fieldFormDrafts.get(draftIdFor(formType, jobId));

/** Drops the draft and every photo attached to it, atomically. */
export async function discardDraft(formType: FieldFormType, jobId: string): Promise<void> {
  const id = draftIdFor(formType, jobId);
  await db.transaction("rw", db.fieldFormDrafts, db.fieldFormPhotos, async () => {
    await db.fieldFormPhotos.where("draftId").equals(id).delete();
    await db.fieldFormDrafts.delete(id);
  });
}

export const listPhotos = (draftId: string) =>
  db.fieldFormPhotos.where("draftId").equals(draftId).sortBy("capturedAt");

export async function addPhoto(
  photo: Omit<FieldFormPhoto, "id" | "capturedAt">,
): Promise<FieldFormPhoto> {
  const row: FieldFormPhoto = { ...photo, id: randomId(), capturedAt: nowIso() };
  await db.fieldFormPhotos.add(row);
  return row;
}

export const removePhoto = (id: string) => db.fieldFormPhotos.delete(id);

export const setPhotoCaption = (id: string, caption: string) =>
  db.fieldFormPhotos.update(id, { caption });

/**
 * Rebuild a Blob from stored bytes. Always go through this rather than storing
 * Blobs directly — see the note in types.ts about iOS Safari.
 */
export const photoBlob = (photo: Pick<FieldFormPhoto, "bytes" | "mime">) =>
  new Blob([photo.bytes], { type: photo.mime });

export function photoDataUrl(photo: Pick<FieldFormPhoto, "bytes" | "mime">): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"));
    reader.readAsDataURL(photoBlob(photo));
  });
}
