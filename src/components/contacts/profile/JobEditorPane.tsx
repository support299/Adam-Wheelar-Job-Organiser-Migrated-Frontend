import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { X, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/jobs/AddressAutocomplete";
import { addFrequency, FREQUENCY_LABELS, type RecurrenceFrequency } from "@/lib/jobs";
import {
  useUpdateJobMutation,
  useSetJobStaffMutation,
  useSetJobProductsMutation,
  useGetJobProductsQuery,
} from "@/api/jobsApi";
import { useListStaffQuery } from "@/api/staffApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListActivitiesQuery, useCreateActivityMutation } from "@/api/activitiesApi";
import type { Job, JobProductLine } from "@/api/types";

const ACTIVITY_MAX_LEN = 30;

type Props = {
  job: Job;
  onSaved?: () => void;
};

const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];
const CALL_STATUS_OPTIONS = [
  { value: "not_called", label: "Not called" },
  { value: "connected", label: "Call connected" },
  { value: "not_connected", label: "Call not connected" },
  { value: "call_back", label: "Call back" },
];
const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "completed", label: "Completed" },
  { value: "skip", label: "Skip this time" },
  { value: "not_interested", label: "Not interested anymore" },
];
const COUNTS_AS_CALL = new Set(["connected", "not_connected", "call_back"]);
const DONE_STATUSES = new Set(["completed", "skip"]);

function parseCoordsFromUrl(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return null;
}

function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Self-contained editor for a single job, rendered inside the contact profile
 * modal. Mounted with `key={job.id}` so every field seeds straight from props —
 * no prop-sync effects. Owns its own save (updateJob + staff + products).
 */
export function JobEditorPane({ job, onSaved }: Props) {
  const [address, setAddress] = useState(job.address);
  const [lat, setLat] = useState<number>(job.lat);
  const [lng, setLng] = useState<number>(job.lng);
  const [addressMode, setAddressMode] = useState<"automatic" | "manual">("automatic");

  const [serviceType, setServiceType] = useState(job.service_type ?? "installation");
  const [saleDate, setSaleDate] = useState(job.sale_date ?? "");
  const [serviceDate, setServiceDate] = useState(job.service_date);
  const [serviceTime, setServiceTime] = useState((job.service_time ?? "09:00").slice(0, 5));
  const [duration, setDuration] = useState<number>(job.duration ?? 60);

  const [paymentStatus, setPaymentStatus] = useState(job.payment_status ?? "paid");
  const [serviceValue, setServiceValue] = useState<number>(Number(job.service_value ?? 0));

  const [isRecurring, setIsRecurring] = useState<boolean>(job.is_recurring ?? false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency | null>(
    (job.frequency as RecurrenceFrequency | null) ?? null,
  );

  const [status, setStatus] = useState(job.status ?? "pending");
  const [callStatus, setCallStatus] = useState(job.call_status ?? "not_called");
  const [notes, setNotes] = useState(job.notes ?? "");
  const [staffIds, setStaffIds] = useState<string[]>(job.staff_ids ?? []);
  const [lineItems, setLineItems] = useState<JobProductLine[]>([]);
  const [activityId, setActivityId] = useState<number | null>(job.activity ?? null);

  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: allStaff = [] } = useListStaffQuery();
  const { data: allProducts = [] } = useListProductsQuery();
  const { data: activities = [] } = useListActivitiesQuery();
  const { data: jobProducts } = useGetJobProductsQuery(job.id);

  const [updateJob] = useUpdateJobMutation();
  const [setJobStaff] = useSetJobStaffMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [createActivity] = useCreateActivityMutation();

  // Line items come from their own endpoint; hydrate once they arrive.
  useEffect(() => {
    if (jobProducts === undefined) return;
    setLineItems(
      jobProducts.map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
      })),
    );
  }, [jobProducts]);

  const assignableStaff = allStaff.filter((s) => s.role === "user" && s.active);
  const lineItemsTotal = lineItems.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0,
  );
  const dateLabel = serviceType === "installation" ? "Installation date" : "Service date";

  const selectedActivity = activities.find((a) => a.id === activityId) ?? null;
  const trimmedActivitySearch = activitySearch.trim();
  const filteredActivities = trimmedActivitySearch
    ? activities.filter((a) => a.body.toLowerCase().includes(trimmedActivitySearch.toLowerCase()))
    : activities;
  const canCreateActivity =
    trimmedActivitySearch.length > 0 &&
    !activities.some((a) => a.body.toLowerCase() === trimmedActivitySearch.toLowerCase());

  function toggleStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createAndSelectActivity() {
    const body = trimmedActivitySearch.slice(0, ACTIVITY_MAX_LEN);
    if (!body) return;
    try {
      setCreatingActivity(true);
      const created = await createActivity({ body }).unwrap();
      setActivityId(created.id);
      setActivitySearch("");
      setActivityPickerOpen(false);
      toast.success(`Activity "${created.body}" created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create activity");
    } finally {
      setCreatingActivity(false);
    }
  }

  function addLineItem() {
    if (allProducts.length === 0) {
      toast.error("No products yet. Add some in Settings → Products.");
      return;
    }
    const p = allProducts[0];
    setLineItems((prev) => [...prev, { product_id: p.id, quantity: 1, unit_price: Number(p.price) }]);
  }

  function updateLineItem(idx: number, patch: Partial<JobProductLine>) {
    setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleStatusChange(next: string) {
    setStatus(next);
    if (next === "pending") setStaffIds([]);
  }

  async function handleSave() {
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (!lat || !lng) {
      toast.error("Pick the address from the suggestions to capture coordinates");
      return;
    }
    if (isRecurring && !frequency) {
      toast.error("Select a repeat frequency for recurring jobs");
      return;
    }

    const prevCallStatus = job.call_status ?? "not_called";
    const baseCalls = Number(job.calls_made ?? 0);
    const callsMade =
      COUNTS_AS_CALL.has(callStatus) && callStatus !== prevCallStatus ? baseCalls + 1 : baseCalls;

    const rolledToDate =
      !DONE_STATUSES.has(job.status) &&
      DONE_STATUSES.has(status) &&
      isRecurring &&
      frequency
        ? addFrequency(serviceDate, frequency)
        : null;

    const body = {
      name: job.name,
      email: job.email,
      phone: job.phone,
      ghl_contact_id: job.ghl_contact_id,
      address: address.trim(),
      lat,
      lng,
      service_type: serviceType,
      sale_date: serviceType === "installation" ? saleDate || null : null,
      service_date: serviceDate,
      service_time: serviceTime,
      duration,
      payment_status: paymentStatus,
      service_value: paymentStatus === "unpaid" ? 0 : serviceValue,
      is_recurring: isRecurring,
      frequency: isRecurring ? frequency : null,
      status,
      call_status: callStatus,
      calls_made: callsMade,
      notes: notes.trim() ? notes : null,
      activity: activityId,
      occurrences: job.series_count ?? 1,
    };

    try {
      setSaving(true);
      setError(null);
      await updateJob({ id: job.id, body }).unwrap();
      await setJobStaff({ jobId: job.id, staffIds }).unwrap();
      await setJobProducts({ jobId: job.id, lines: lineItems }).unwrap();
      toast.success(
        rolledToDate
          ? `Job completed — next visit scheduled ${rolledToDate}`
          : "Job updated",
      );
      onSaved?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save. Please try again.";
      setError(msg);
      toast.error("Failed to update job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
        {/* Location */}
        <Section title="Location">
          <Tabs value={addressMode} onValueChange={(v) => setAddressMode(v as "automatic" | "manual")}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="automatic">Search</TabsTrigger>
              <TabsTrigger value="manual">Enter manually</TabsTrigger>
            </TabsList>
          </Tabs>
          {addressMode === "automatic" ? (
            <Field
              label="Address"
              hint={
                lat && lng
                  ? `Coordinates captured: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Pick a suggestion to capture coordinates."
              }
            >
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={({ address: a, lat: la, lng: ln }) => {
                  setAddress(a);
                  setLat(la);
                  setLng(ln);
                  toast.success("Address & coordinates set");
                }}
                placeholder="Start typing an address…"
              />
            </Field>
          ) : (
            <div className="space-y-3">
              <Field label="Address">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State"
                />
              </Field>
              <Field
                label="Google Maps link"
                hint="Paste a link and coordinates fill in automatically."
              >
                <Input
                  placeholder="https://maps.google.com/?q=37.7749,-122.4194"
                  onChange={(e) => {
                    const coords = parseCoordsFromUrl(e.target.value);
                    if (coords) {
                      setLat(coords.lat);
                      setLng(coords.lng);
                      toast.success(`Coordinates set: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
                      e.target.value = "";
                    }
                  }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Latitude">
                  <Input
                    type="number"
                    step="any"
                    value={lat || ""}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Longitude">
                  <Input
                    type="number"
                    step="any"
                    value={lng || ""}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  />
                </Field>
              </div>
            </div>
          )}
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Service type">
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="servicing">Servicing</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {serviceType === "installation" && (
              <Field label="Sale date">
                <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
              </Field>
            )}
            <Field label={dateLabel}>
              <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={serviceTime} onChange={(e) => setServiceTime(e.target.value)} />
            </Field>
            <Field label="Duration">
              <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d < 60 ? `${d} min` : `${d / 60} hour${d === 60 ? "" : "s"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Repeats" hint={job.parent_job_id ? `Occurrence ${job.occurrence_index} of a recurring series.` : undefined}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Tabs
                value={isRecurring ? "recurring" : "onetime"}
                onValueChange={(v) => {
                  const rec = v === "recurring";
                  setIsRecurring(rec);
                  if (rec && !frequency) setFrequency("monthly");
                }}
              >
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="onetime">One-time</TabsTrigger>
                  <TabsTrigger value="recurring">Recurring</TabsTrigger>
                </TabsList>
              </Tabs>
              {isRecurring && (
                <Select
                  value={frequency ?? undefined}
                  onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
                >
                  <SelectTrigger className="sm:w-48"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Field>
        </Section>

        {/* Activity */}
        <Section title="Activity">
          <div className="grid gap-1.5">
            <Popover open={activityPickerOpen} onOpenChange={setActivityPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn("w-full justify-between font-normal", !selectedActivity && "text-muted-foreground")}
                >
                  {selectedActivity ? selectedActivity.body : "Select or create an activity…"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search or type a new activity…"
                    value={activitySearch}
                    onValueChange={setActivitySearch}
                    maxLength={ACTIVITY_MAX_LEN}
                  />
                  <CommandList>
                    {activityId != null && (
                      <CommandGroup>
                        <CommandItem
                          value="__clear__"
                          onSelect={() => {
                            setActivityId(null);
                            setActivitySearch("");
                            setActivityPickerOpen(false);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" /> Clear activity
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup>
                      {filteredActivities.length === 0 && !canCreateActivity && (
                        <CommandEmpty>No activities yet.</CommandEmpty>
                      )}
                      {filteredActivities.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={String(a.id)}
                          onSelect={() => {
                            setActivityId(a.id);
                            setActivitySearch("");
                            setActivityPickerOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", activityId === a.id ? "opacity-100" : "opacity-0")} />
                          {a.body}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {canCreateActivity && (
                      <CommandGroup>
                        <CommandItem
                          value="__create__"
                          disabled={creatingActivity}
                          onSelect={createAndSelectActivity}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create “{trimmedActivitySearch.slice(0, ACTIVITY_MAX_LEN)}”
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              One classification for this job. Type a new name and choose “Create” to add it.
            </p>
          </div>
        </Section>

        {/* Status & payment */}
        <Section title="Status & payment">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Job status">
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Call status">
              <Select value={callStatus} onValueChange={setCallStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALL_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount ($)">
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={paymentStatus === "unpaid"}
                value={paymentStatus === "unpaid" ? "" : serviceValue}
                onChange={(e) => setServiceValue(parseFloat(e.target.value) || 0)}
                placeholder={paymentStatus === "unpaid" ? "Unpaid" : undefined}
              />
            </Field>
            <div className="flex items-center gap-2 sm:pt-7">
              <Checkbox
                id={`unpaid-${job.id}`}
                checked={paymentStatus === "unpaid"}
                onCheckedChange={(checked) => {
                  setPaymentStatus(checked ? "unpaid" : "paid");
                  if (checked) setServiceValue(0);
                }}
              />
              <Label htmlFor={`unpaid-${job.id}`} className="text-sm font-normal cursor-pointer">
                Mark as unpaid
              </Label>
            </div>
          </div>
        </Section>

        {/* Assignment */}
        <Section title="Assignment">
          <Field
            label="Assigned staff"
            hint={status === "pending" ? "Staff are assigned once the job is scheduled." : undefined}
          >
            {assignableStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3">
                No staff with the <strong>User</strong> role yet. Add some in <strong>Settings → Staff</strong>.
              </p>
            ) : (
              <Popover open={staffPickerOpen} onOpenChange={setStaffPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    disabled={status === "pending"}
                    className={cn("w-full justify-between font-normal", staffIds.length === 0 && "text-muted-foreground")}
                  >
                    {staffIds.length === 0
                      ? status === "pending"
                        ? "Assigned at scheduling"
                        : "Select staff…"
                      : `${staffIds.length} staff selected`}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search staff…" />
                    <CommandList>
                      <CommandEmpty>No matching staff.</CommandEmpty>
                      <CommandGroup>
                        {assignableStaff.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.email ?? ""}`}
                            onSelect={() => toggleStaff(s.id)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", staffIds.includes(s.id) ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{s.name}</span>
                              {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {staffIds.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {staffIds.map((id) => {
                  const s = allStaff.find((x) => x.id === id);
                  if (!s) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {s.name}
                      <button type="button" onClick={() => toggleStaff(id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </Field>
        </Section>

        {/* Products */}
        <Section title="Products / line items">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {lineItems.length === 0 ? "No products added." : `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-3 w-3 mr-1" /> Add line
            </Button>
          </div>
          {lineItems.length > 0 && (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_80px_110px_36px] gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Product</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span />
              </div>
              {lineItems.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_110px_36px] gap-2 items-center">
                  <Select
                    value={l.product_id}
                    onValueChange={(v) => {
                      const p = allProducts.find((x) => x.id === v);
                      updateLineItem(i, { product_id: v, unit_price: p ? Number(p.price) : l.unit_price });
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.sku ? ` (${p.sku})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={l.quantity}
                    onChange={(e) => updateLineItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unit_price}
                    onChange={(e) => updateLineItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                    className="h-9"
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLineItem(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="text-xs text-muted-foreground text-right">
                Total: <strong className="text-foreground">${lineItemsTotal.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Outcome, follow-ups, anything worth remembering…"
          />
        </Section>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-3 mt-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
