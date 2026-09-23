import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { getFieldFormPhotos } from "@/db/dexie";
import { draftIdFor, loadDraft, saveDraft } from "@/lib/fieldForms/draftStore";
import type { JobSnapshot, ServiceSheetValues } from "@/lib/fieldForms/types";
import { SERVICE_ITEMS, missingRequired } from "./checklistContent";

/**
 * Service Sheet form state. Follows the house pattern from useJobForm: one flat
 * useState object, imperative validation with toast.error, an injected onSubmit
 * that the page owns. Adds draft persistence, because this form is filled out
 * somewhere with no signal and losing it means redoing the visit's paperwork.
 */

const AUTOSAVE_MS = 400;

export const emptyServiceSheetForm: ServiceSheetValues = {
  technician: "",
  customerName: "",
  phone: "",
  cellPhone: "",
  email: "",
  address: "",
  city: "",
  date: "",
  time: "",
  equipment: { ro: "", conditioner: "", eac: "", uv: "", aio: "", hours: "", peroxide: "" },
  equipmentNotes: "",
  basement: false,
  underSink: false,
  fridgeHookup: false,
  iceMaker: false,
  counterType: "",
  plumbingHalf: false,
  plumbingThreeQuarter: false,
  plumbingPlastic: false,
  answers: {},
  itemNotes: {},
  officeMessage: "",
  customerSignature: null,
  technicianSignature: null,
  customerSignatureName: "",
  technicianSignatureName: "",
};

export type UseServiceSheetFormParams = {
  job: JobSnapshot;
  technicianName: string;
  onSubmit: (values: ServiceSheetValues) => Promise<void>;
  onSaved?: () => void;
};

export function useServiceSheetForm({
  job,
  technicianName,
  onSubmit,
  onSaved,
}: UseServiceSheetFormParams) {
  const draftId = draftIdFor("service", job.jobId);
  const [form, setForm] = useState<ServiceSheetValues>(emptyServiceSheetForm);
  const [hydrated, setHydrated] = useState(false);
  const [resumedAt, setResumedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Mirrored for the visibilitychange flush, which must read the latest values
  // without re-subscribing the listener on every keystroke.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const photos = useLiveQuery(() => getFieldFormPhotos(draftId), [draftId], []);

  /** Prefill from the job; a saved draft wins over it. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await loadDraft("service", job.jobId);
      if (cancelled) return;
      if (draft) {
        // Merge over the defaults, never trust the draft's shape wholesale —
        // a draft saved under an older version of this form (before a field
        // was renamed or added) is missing keys, and `as` would let those
        // come through as `undefined` and crash the first thing that reads
        // e.g. `.length` off them.
        setForm({ ...emptyServiceSheetForm, ...(draft.values as Partial<ServiceSheetValues>) });
        setResumedAt(draft.updatedAt);
      } else {
        setForm({
          ...emptyServiceSheetForm,
          technician: technicianName,
          technicianSignatureName: technicianName,
          customerName: job.name,
          customerSignatureName: job.name,
          phone: job.phone,
          email: job.email,
          address: job.address,
          date: job.serviceDate || new Date().toISOString().slice(0, 10),
          time: (job.serviceTime || "").slice(0, 5),
        });
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [job, technicianName]);

  // Debounced autosave. The `hydrated` guard is essential: without it the
  // initial empty state writes straight over the draft just loaded.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => void saveDraft("service", job, form), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [form, hydrated, job]);

  // Backgrounding the app shouldn't wait for the debounce.
  useEffect(() => {
    const flush = () => {
      if (hydrated && document.visibilityState === "hidden") {
        void saveDraft("service", job, formRef.current);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [hydrated, job]);

  const setAnswer = useCallback((itemId: string, checked: boolean) => {
    setForm((f) => ({ ...f, answers: { ...f.answers, [itemId]: checked } }));
  }, []);

  const setItemNote = useCallback((itemId: string, note: string) => {
    setForm((f) => ({ ...f, itemNotes: { ...f.itemNotes, [itemId]: note } }));
  }, []);

  const setEquipment = useCallback(
    (key: keyof ServiceSheetValues["equipment"], value: string) => {
      setForm((f) => ({ ...f, equipment: { ...f.equipment, [key]: value } }));
    },
    [],
  );

  const markAll = useCallback((itemIds: string[]) => {
    setForm((f) => {
      const answers = { ...f.answers };
      for (const id of itemIds) answers[id] = true;
      return { ...f, answers };
    });
  }, []);

  async function handleSave() {
    if (!form.technician.trim()) {
      toast.error("Service technician is required");
      return;
    }
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    const missing = missingRequired(SERVICE_ITEMS, form.answers);
    if (missing.length > 0) {
      toast.error(
        missing.length === 1
          ? `Still required: ${missing[0].label}`
          : `${missing.length} required checklist items are unticked`,
      );
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      await onSubmit(form);
      onSaved?.();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const serviceDone = SERVICE_ITEMS.filter((i) => form.answers[i.id]).length;

  return {
    draftId,
    job,
    form,
    setForm,
    hydrated,
    resumedAt,
    photos,
    saving,
    saveError,
    setAnswer,
    setItemNote,
    setEquipment,
    markAll,
    handleSave,
    serviceDone,
    serviceTotal: SERVICE_ITEMS.length,
  };
}

export type ServiceSheetFormState = ReturnType<typeof useServiceSheetForm>;
