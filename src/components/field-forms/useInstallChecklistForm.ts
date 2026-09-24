import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { getFieldFormPhotos, getCachedJobProducts, getCachedProducts } from "@/db/dexie";
import { useGetJobProductsQuery } from "@/api/jobsApi";
import { useListProductsQuery } from "@/api/productsApi";
import type { Product } from "@/api/types";
import { draftIdFor, loadDraft, saveDraft } from "@/lib/fieldForms/draftStore";
import { randomId } from "@/lib/fieldForms/ids";
import type { InstallChecklistValues, JobSnapshot } from "@/lib/fieldForms/types";
import { INSTALL_SYSTEM_STEPS, WRAP_UP_ITEMS, missingRequired, productStepId } from "./checklistContent";

/**
 * Install Checklist form state. Deliberately a sibling of useServiceSheetForm
 * rather than a shared generic hook — the codebase forks useJobForm into
 * useMigrateJobForm the same way, and two concrete files read better than one
 * configurable engine.
 *
 * "Systems to install" is the real product catalog, not a fixed list — a
 * selected product gets the same generic install checklist the original app
 * applied uniformly to its own fixed system codes (INSTALL_SYSTEM_STEPS).
 * Defaults to whatever products are already on the job.
 *
 * Both signatures are required here and the photo section demands a before
 * and an after, matching the original markup's ✱.
 */

const AUTOSAVE_MS = 400;

export const emptyInstallChecklistForm: InstallChecklistValues = {
  installer: "",
  confirmedBy: "",
  customerName: "",
  phone: "",
  address: "",
  city: "",
  date: "",
  time: "",
  counterAndFaucet: "",
  basementType: "",
  productIds: [],
  productLines: [],
  soap: "",
  tds: "",
  hardness: "",
  pexUsed: "",
  connectionsUsed: "",
  answers: {},
  itemNotes: {},
  notes: "",
  customerSignature: null,
  technicianSignature: null,
  customerSignatureName: "",
  technicianSignatureName: "",
};

export type UseInstallChecklistFormParams = {
  job: JobSnapshot;
  technicianName: string;
  onSubmit: (values: InstallChecklistValues, selectedProducts: Product[]) => Promise<void>;
  onSaved?: () => void;
};

export function useInstallChecklistForm({
  job,
  technicianName,
  onSubmit,
  onSaved,
}: UseInstallChecklistFormParams) {
  const draftId = draftIdFor("install", job.jobId);
  const [form, setForm] = useState<InstallChecklistValues>(emptyInstallChecklistForm);
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

  // Product catalog, offline-first: RTK Query when online, the Dexie mirror
  // otherwise. listProducts writes db.products on every successful fetch (see
  // productsApi.ts), so this is populated as soon as the tech has opened
  // Settings or Plans once with a connection.
  const { data: catalogFromApi } = useListProductsQuery();
  const [catalogCached, setCatalogCached] = useState<Product[]>([]);
  useEffect(() => {
    void getCachedProducts().then(setCatalogCached);
  }, []);
  const catalog = catalogFromApi ?? catalogCached;

  // This job's already-assigned products, for the default selection. The
  // single-job endpoint isn't itself mirrored to Dexie, but PlansPage's
  // unfiltered listAllJobProducts call is (see jobsApi.ts) — and PlansPage is
  // the only way to reach this form, so by the time a tech taps in, this
  // job's rows are normally already cached.
  const { data: jobProductsFromApi } = useGetJobProductsQuery(job.jobId);
  const [jobProductsCached, setJobProductsCached] = useState<{ product_id: string }[]>([]);
  useEffect(() => {
    void getCachedJobProducts().then((rows) =>
      setJobProductsCached(rows.filter((r) => r.job_id === job.jobId)),
    );
  }, [job.jobId]);
  const jobProducts = jobProductsFromApi ?? jobProductsCached;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await loadDraft("install", job.jobId);
      if (cancelled) return;
      if (draft) {
        // Merge over the defaults, never trust the draft's shape wholesale —
        // a draft saved under an older version of this form (before a field
        // was renamed or added) is missing keys, and `as` would let those
        // come through as `undefined` and crash the first thing that reads
        // e.g. `.length` off them.
        setForm({ ...emptyInstallChecklistForm, ...(draft.values as Partial<InstallChecklistValues>) });
        setResumedAt(draft.updatedAt);
      } else {
        setForm({
          ...emptyInstallChecklistForm,
          installer: technicianName,
          technicianSignatureName: technicianName,
          customerName: job.name,
          customerSignatureName: job.name,
          phone: job.phone,
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

  // Default-select the job's products once, only for a fresh form (a loaded
  // draft's own productIds must win) and only once jobProducts has actually
  // arrived — it resolves after the draft-load effect above.
  const defaultedProducts = useRef(false);
  useEffect(() => {
    if (!hydrated || defaultedProducts.current) return;
    if (form.productIds.length > 0) {
      defaultedProducts.current = true;
      return;
    }
    if (jobProducts.length === 0) return;
    setForm((f) => ({ ...f, productIds: jobProducts.map((jp) => jp.product_id) }));
    defaultedProducts.current = true;
  }, [hydrated, jobProducts, form.productIds.length]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => void saveDraft("install", job, form), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [form, hydrated, job]);

  useEffect(() => {
    const flush = () => {
      if (hydrated && document.visibilityState === "hidden") {
        void saveDraft("install", job, formRef.current);
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

  const toggleProduct = useCallback((productId: string) => {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(productId)
        ? f.productIds.filter((id) => id !== productId)
        : [...f.productIds, productId],
    }));
  }, []);

  const markAll = useCallback((itemIds: string[]) => {
    setForm((f) => {
      const answers = { ...f.answers };
      for (const id of itemIds) answers[id] = true;
      return { ...f, answers };
    });
  }, []);

  const addProductLine = useCallback(() => {
    setForm((f) => ({
      ...f,
      productLines: [...f.productLines, { id: randomId(), name: "", quantity: "" }],
    }));
  }, []);

  const updateProductLine = useCallback(
    (id: string, patch: Partial<{ name: string; quantity: string }>) => {
      setForm((f) => ({
        ...f,
        productLines: f.productLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [],
  );

  const removeProductLine = useCallback((id: string) => {
    setForm((f) => ({ ...f, productLines: f.productLines.filter((l) => l.id !== id) }));
  }, []);

  // Chip options: the active catalog, plus anything already selected even if
  // since deactivated — dropping a chip out from under a ticked-off checklist
  // would be a confusing way to lose data mid-form.
  const productOptions = catalog
    .filter((p) => p.active || form.productIds.includes(p.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  /** Only the checklists of selected products are in scope for validation. */
  const selectedProducts = catalog.filter((p) => form.productIds.includes(p.id));

  async function handleSave() {
    if (!form.installer.trim()) {
      toast.error("Installer is required");
      return;
    }
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (form.productIds.length === 0) {
      toast.error("Select at least one system to install");
      return;
    }

    const missing = [
      ...selectedProducts.flatMap((p) =>
        INSTALL_SYSTEM_STEPS.filter(
          (step) => step.required && !form.answers[productStepId(p.id, step.id)],
        ),
      ),
      ...missingRequired(WRAP_UP_ITEMS, form.answers),
    ];
    if (missing.length > 0) {
      toast.error(
        missing.length === 1
          ? `Still required: ${missing[0].label}`
          : `${missing.length} required checklist items are unticked`,
      );
      return;
    }

    // Section 09 of the original marks before & after as required.
    if (photos.length < 2) {
      toast.error("Before and after photos of the whole area are required");
      return;
    }
    if (!form.customerSignature) {
      toast.error("Customer signature is required");
      return;
    }
    if (!form.technicianSignature) {
      toast.error("Installer signature is required");
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      await onSubmit(form, selectedProducts);
      onSaved?.();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const wrapDone = WRAP_UP_ITEMS.filter((i) => form.answers[i.id]).length;

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
    productOptions,
    selectedProducts,
    setAnswer,
    setItemNote,
    toggleProduct,
    markAll,
    addProductLine,
    updateProductLine,
    removeProductLine,
    handleSave,
    wrapDone,
    wrapTotal: WRAP_UP_ITEMS.length,
  };
}

export type InstallChecklistFormState = ReturnType<typeof useInstallChecklistForm>;
