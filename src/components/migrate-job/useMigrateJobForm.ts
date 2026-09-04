import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListStaffQuery } from "@/api/staffApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListGhlContactsQuery } from "@/api/contactsApi";
import { useGetJobStaffQuery, useGetJobProductsQuery, useListJobsQuery, useListAllJobProductsQuery } from "@/api/jobsApi";
import { localIsoDate } from "@/lib/jobs";
import type { Job, JobInsert, JobProductLine, GhlContact } from "@/api/types";

// Independent copy of components/jobs/useJobForm.ts, dedicated to the
// migration flow (MigrateJobPage) so it doesn't share code with the normal
// "Enter New Job" modal.

export const emptyMigrateJobForm: JobInsert = {
  name: "",
  email: "",
  phone: "",
  ghl_contact_id: null,
  service_value: 0,
  address: "",
  lat: 0,
  lng: 0,
  service_date: localIsoDate(),
  service_time: "09:00",
  status: "pending",
  notes: "",
  is_recurring: true,
  frequency: "annually",
  service_type: "servicing",
  sale_date: localIsoDate(),
  payment_status: "paid",
  call_status: "not_called",
  calls_made: 0,
  completed_at: null,
  duration: 60,
  parent_job_id: null,
  occurrence_index: null,
  series_count: null,
  occurrences: 1000,
};

export type UseMigrateJobFormParams = {
  open: boolean;
  job?: Job | null;
  defaultGhlContactId?: string | null;
  defaultServiceType?: "installation" | "servicing" | "ad_hoc" | "workshop";
  initialTab?: "details" | "activity";
  initialValues?: Partial<JobInsert>;
  initialStaffIds?: string[];
  initialLineItems?: JobProductLine[];
  initialContactSearchTerm?: string;
  /** Migration-only UX: sticky pickers (stay open until select/close), auto-select the sole staff option. */
  migrationMode?: boolean;
  onSubmit: (
    data: JobInsert,
    extras: { staffIds: string[]; lineItems: JobProductLine[] },
  ) => Promise<void>;
  /** Called after a successful save, instead of the hook touching dialog/page state directly. */
  onSaved?: () => void;
};

export function useMigrateJobForm({
  open,
  job,
  defaultGhlContactId,
  defaultServiceType,
  initialTab,
  initialValues,
  initialStaffIds,
  initialLineItems,
  initialContactSearchTerm,
  migrationMode,
  onSubmit,
  onSaved,
}: UseMigrateJobFormParams) {
  const [form, setForm] = useState<JobInsert>(emptyMigrateJobForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [addressMode, setAddressMode] = useState<"automatic" | "manual">(
    initialValues?.lat && initialValues?.lng ? "manual" : "automatic",
  );
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<JobProductLine[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState(initialContactSearchTerm ?? "");
  // Kept separate from the `contacts` search results: once a contact is
  // picked, further typing narrows/changes those results and could drop the
  // picked contact out of the list, which must not blank out the selection.
  const [selectedContactState, setSelectedContactState] = useState<GhlContact | null>(null);

  // MigrateJobPage passes initialContactSearchTerm in once parsing finishes
  // (staff/products load first), so it's still undefined on the render that
  // mounts this hook — the useState initializer above misses it. Sync it in
  // whenever it shows up.
  useEffect(() => {
    if (initialContactSearchTerm) setContactSearchTerm(initialContactSearchTerm);
  }, [initialContactSearchTerm]);

  const { data: allStaff = [] } = useListStaffQuery(undefined, { skip: !open });
  const { data: allProducts = [] } = useListProductsQuery(undefined, { skip: !open });
  const trimmedContactSearch = contactSearchTerm.trim();
  // Contacts are fetched by server-side search (not the full unbounded
  // table) — nothing is fetched until the operator types something.
  const { data: contacts = [] } = useListGhlContactsQuery(trimmedContactSearch || undefined, {
    skip: !open || !trimmedContactSearch,
  });
  const { data: existingStaff } = useGetJobStaffQuery(job?.id ?? "", { skip: !open || !job });
  const { data: existingProducts } = useGetJobProductsQuery(job?.id ?? "", { skip: !open || !job });
  const { data: suggestedJobProducts = [] } = useListAllJobProductsQuery(
    form.ghl_contact_id ? { ghl_contact_id: form.ghl_contact_id, service_type: "installation" } : undefined,
    { skip: !open || !!job || !form.ghl_contact_id || form.service_type !== "servicing" },
  );
  const { data: contactJobs = [] } = useListJobsQuery(
    form.ghl_contact_id ? { ghl_contact_id: form.ghl_contact_id } : undefined,
    { skip: !open || !!job || !form.ghl_contact_id },
  );

  const previousAddresses = useMemo(() => {
    const seen = new Set<string>();
    return [...contactJobs]
      .filter((j) => j.address && j.lat && j.lng)
      .reverse()
      .filter((j) => {
        const key = j.address.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [contactJobs]);

  useEffect(() => {
    if (!open) return;
    if (existingStaff) setStaffIds(existingStaff.staff_ids);
  }, [open, existingStaff]);

  useEffect(() => {
    if (!open) return;
    if (!job) {
      setLineItems([]);
      return;
    }
    if (existingProducts !== undefined) {
      setLineItems(
        existingProducts.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
      );
    }
  }, [open, existingProducts, job?.id]);

  useEffect(() => {
    if (open) { setActiveTab(initialTab ?? "details"); setSaveError(null); }
  }, [open, initialTab]);

  useEffect(() => {
    if (open) {
      setForm(
        job
          ? {
              name: job.name,
              email: job.email,
              phone: job.phone ?? "",
              ghl_contact_id: job.ghl_contact_id ?? null,
              service_value: job.service_value,
              address: job.address,
              lat: job.lat,
              lng: job.lng,
              service_date: job.service_date,
              service_time: job.service_time.slice(0, 5),
              status: job.status,
              notes: job.notes ?? "",
              is_recurring: job.is_recurring ?? false,
              frequency: job.frequency ?? null,
              service_type: job.service_type ?? "installation",
              sale_date: job.sale_date ?? null,
              payment_status: job.payment_status ?? "paid",
              call_status: job.call_status ?? "not_called",
              calls_made: job.calls_made ?? 0,
              completed_at: job.completed_at ?? null,
              duration: job.duration ?? 60,
              parent_job_id: job.parent_job_id ?? null,
              occurrence_index: job.occurrence_index ?? null,
              series_count: job.series_count ?? null,
              occurrences: job.series_count ?? 1,
            }
          : (() => {
              const serviceType =
                initialValues?.service_type ?? defaultServiceType ?? emptyMigrateJobForm.service_type;
              return {
                ...emptyMigrateJobForm,
                ghl_contact_id: defaultGhlContactId ?? null,
                service_type: serviceType,
                sale_date: serviceType === "installation" ? emptyMigrateJobForm.sale_date : null,
                ...initialValues,
              };
            })(),
      );
      if (!job) {
        setStaffIds(initialStaffIds ?? []);
        setLineItems(initialLineItems ?? []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job, defaultGhlContactId, defaultServiceType, initialValues, initialStaffIds, initialLineItems]);

  useEffect(() => {
    if (!open || job) return;
    const contactId = defaultGhlContactId ?? initialValues?.ghl_contact_id;
    if (!contactId) return;
    const c = contacts.find((x) => x.id === contactId);
    if (c) {
      setForm((f) =>
        f.ghl_contact_id === c.id && f.name
          ? f
          : {
              ...f,
              ghl_contact_id: c.id,
              name: f.name || c.name || "",
              email: f.email || c.email || "",
              phone: f.phone || c.phone || "",
            },
      );
      setSelectedContactState(c);
    }
  }, [contacts, defaultGhlContactId, initialValues?.ghl_contact_id, open, job]);

  useEffect(() => {
    if (open && !job && initialContactSearchTerm) setContactPickerOpen(true);
  }, [open, job, initialContactSearchTerm]);

  // Migration-only: if contact_search uniquely matches exactly one contact,
  // select it automatically instead of requiring a click. If it matches zero
  // or multiple contacts, leave the (already-open, pre-filtered) picker for a
  // manual pick — ambiguous matches still need a human to disambiguate.
  useEffect(() => {
    if (!open || job || !migrationMode || !initialContactSearchTerm) return;
    if (form.ghl_contact_id) return;
    const term = initialContactSearchTerm.trim().toLowerCase();
    const matches = contacts.filter((c) =>
      `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(term),
    );
    if (matches.length === 1) {
      const c = matches[0];
      setForm((f) => ({ ...f, ghl_contact_id: c.id, name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "" }));
      setSelectedContactState(c);
      setContactPickerOpen(false);
    }
  }, [open, job, migrationMode, initialContactSearchTerm, contacts, form.ghl_contact_id]);

  async function handleSave() {
    if (!form.ghl_contact_id) {
      toast.error("Please select a contact from the list");
      return;
    }
    if (!form.address) {
      toast.error("Address is required");
      return;
    }
    if (!form.lat || !form.lng) {
      toast.error("Please pick the address from the suggestions to capture coordinates");
      return;
    }
    if (form.is_recurring && !form.frequency) {
      toast.error("Please select a repeat frequency for recurring jobs");
      return;
    }
    if (form.is_recurring) {
      const occ = form.occurrences ?? 1;
      const minOcc = job?.series_count ?? 1;
      if (!occ || occ < minOcc) {
        toast.error(
          job?.series_count
            ? `Occurrences must be at least ${minOcc} (current series size)`
            : "Occurrences must be at least 1",
        );
        return;
      }
    }
    if (!job && lineItems.length === 0) {
      toast.error("Please add at least one product before saving");
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      const prevCallStatus = job?.call_status ?? "not_called";
      const newCallStatus = (form.call_status as string | null) ?? "not_called";
      const baseCalls = Number(form.calls_made ?? 0);
      const callsMade =
        (newCallStatus === "connected" || newCallStatus === "not_connected" || newCallStatus === "call_back") &&
        newCallStatus !== prevCallStatus
          ? baseCalls + 1
          : baseCalls;
      await onSubmit(
        { ...form, frequency: form.is_recurring ? form.frequency : null, call_status: newCallStatus, calls_made: callsMade },
        { staffIds, lineItems },
      );
      onSaved?.();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const userRoleStaff = allStaff.filter((s) => s.role === "user" && s.active);
  // Migration-only fallback: small setups sometimes have only an admin
  // account and no dedicated "user" staff. The normal modal keeps the
  // strict user-only rule; migrate-job falls back to admin staff only when
  // there's no user-role staff to choose from at all.
  const assignableStaff =
    migrationMode && userRoleStaff.length === 0
      ? allStaff.filter((s) => s.role === "admin" && s.active)
      : userRoleStaff;
  const soleAssignableStaffId = assignableStaff.length === 1 ? assignableStaff[0].id : null;

  // Migration-only: if there's exactly one assignable staff member, there's no
  // real choice to make — auto-select them instead of requiring a click.
  useEffect(() => {
    if (!open || job || !migrationMode || !soleAssignableStaffId) return;
    if (form.status === "pending") return;
    if (staffIds.length > 0) return;
    setStaffIds([soleAssignableStaffId]);
  }, [open, job, migrationMode, soleAssignableStaffId, form.status, staffIds.length]);

  function toggleStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addLineItem() {
    if (allProducts.length === 0) {
      toast.error("No products yet. Add some in Settings → Products.");
      return;
    }
    const first = allProducts[0];
    setLineItems((prev) => [
      ...prev,
      { product_id: first.id, quantity: 1, unit_price: Number(first.price) },
    ]);
  }

  function updateLineItem(idx: number, patch: Partial<JobProductLine>) {
    setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const lineItemsTotal = lineItems.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0,
  );

  const selectedContact =
    selectedContactState ?? contacts.find((c: GhlContact) => c.id === form.ghl_contact_id) ?? null;

  function selectContact(c: GhlContact) {
    setForm((f) => ({
      ...f,
      ghl_contact_id: c.id,
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    }));
    setSelectedContactState(c);
    setContactPickerOpen(false);
  }

  return {
    form,
    setForm,
    saving,
    saveError,
    activeTab,
    setActiveTab,
    addressMode,
    setAddressMode,
    staffIds,
    setStaffIds,
    lineItems,
    setLineItems,
    contactPickerOpen,
    setContactPickerOpen,
    staffPickerOpen,
    setStaffPickerOpen,
    contactSearchTerm,
    setContactSearchTerm,
    allStaff,
    allProducts,
    contacts,
    suggestedJobProducts,
    previousAddresses,
    assignableStaff,
    selectedContact,
    lineItemsTotal,
    handleSave,
    toggleStaff,
    addLineItem,
    updateLineItem,
    removeLineItem,
    selectContact,
  };
}

export type MigrateJobFormState = ReturnType<typeof useMigrateJobForm>;
