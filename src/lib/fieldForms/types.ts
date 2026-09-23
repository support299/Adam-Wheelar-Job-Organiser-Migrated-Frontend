/**
 * Records for the offline field-forms feature (Service Sheet / Install Checklist).
 *
 * Two rules the shapes here exist to enforce:
 *
 * 1. Binaries are stored as ArrayBuffer + mime, never as Blob. iOS Safari has a
 *    long history of Blobs held in IndexedDB becoming unreadable after a reload;
 *    rebuilding with `new Blob([bytes], { type: mime })` on read costs nothing.
 * 2. Photo binaries live in their own table, not inside the draft. A Dexie put
 *    rewrites the whole record, so keeping drafts small is what makes a debounced
 *    autosave on every keystroke free.
 */

export type FieldFormType = "service" | "install";

/**
 * The job fields the form needs, frozen at launch so the form never depends on a
 * network fetch. The tech may open this in a basement with no signal.
 */
export type JobSnapshot = {
  jobId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  serviceDate: string;
  serviceTime: string;
  serviceType: string;
  staffIds: string[];
};

/** Checklist state, keyed by ChecklistItem.id — never positional. */
export type ChecklistAnswers = Record<string, boolean>;
export type ChecklistNotes = Record<string, string>;

/** Fields common to both forms. */
type CommonValues = {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  date: string;
  time: string;
  answers: ChecklistAnswers;
  itemNotes: ChecklistNotes;
  customerSignature: string | null;
  technicianSignature: string | null;
  customerSignatureName: string;
  technicianSignatureName: string;
};

export type ServiceSheetValues = CommonValues & {
  technician: string;
  cellPhone: string;
  email: string;
  /** Equipment on site — free text per unit (model, serial or condition). */
  equipment: {
    ro: string;
    conditioner: string;
    eac: string;
    uv: string;
    aio: string;
    hours: string;
    peroxide: string;
  };
  equipmentNotes: string;
  /** Site details toggles. */
  basement: boolean;
  underSink: boolean;
  fridgeHookup: boolean;
  iceMaker: boolean;
  counterType: string;
  /** Plumbing chips — independently selectable in the original. */
  plumbingHalf: boolean;
  plumbingThreeQuarter: boolean;
  plumbingPlastic: boolean;
  /** Messages for the office. */
  officeMessage: string;
};

/** One row of the install form's "Products & soap" section. */
export type InstallProductLine = {
  id: string;
  name: string;
  quantity: string;
};

export type InstallChecklistValues = CommonValues & {
  installer: string;
  confirmedBy: string;
  counterAndFaucet: string;
  basementType: string;
  /**
   * Selected product ids from the real catalog (Product.id), not a fixed
   * system code — drives which per-product install checklists render.
   * Defaults to the job's already-assigned products; see
   * useInstallChecklistForm's hydrate effect.
   */
  productIds: string[];
  productLines: InstallProductLine[];
  soap: string;
  tds: string;
  hardness: string;
  pexUsed: string;
  connectionsUsed: string;
  /** Wrap-up notes (section 08's "Notes" field — i_notes in the original). */
  notes: string;
};

export type FieldFormValues = ServiceSheetValues | InstallChecklistValues;

export type FieldFormDraft = {
  /** `${formType}:${jobId}` — one draft per form type per job per device. */
  id: string;
  jobId: string;
  formType: FieldFormType;
  job: JobSnapshot;
  values: FieldFormValues;
  createdAt: string;
  updatedAt: string;
};

export type FieldFormPhoto = {
  id: string;
  draftId: string;
  /** Checklist item id when the photo is bound to a line; null for a general photo. */
  slotId: string | null;
  mime: string;
  bytes: ArrayBuffer;
  width: number;
  height: number;
  caption: string;
  capturedAt: string;
};

/**
 * queued   — waiting for a flush
 * uploading — claimed by a runner (reclaimed after 2 min in case the tab died)
 * failed   — retryable error; nextAttemptAt holds the backoff deadline
 * blocked  — terminal. Keeps its bytes so the user can download the PDF and
 *            attach it by hand rather than losing the visit's work.
 */
export type OutboxStatus = "queued" | "uploading" | "failed" | "blocked";

export type FieldFormOutboxItem = {
  id: string;
  jobId: string;
  formType: FieldFormType;
  /** Deterministic across retries — the client-side dedupe key. */
  fileName: string;
  /** Customer name + date, for the pending-uploads UI. */
  jobLabel: string;
  mime: "application/pdf";
  bytes: ArrayBuffer;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  /** Epoch ms. */
  nextAttemptAt: number;
  createdAt: string;
  updatedAt: string;
};
