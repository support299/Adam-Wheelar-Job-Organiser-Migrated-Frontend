import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/jobs/AddressAutocomplete";
import { ActivityCombobox } from "@/components/jobs/ActivityCombobox";
import { Section, Field } from "@/components/jobs/formLayout";
import {
  DURATION_OPTIONS,
  durationLabel,
  CALL_STATUS_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/jobs/jobFieldOptions";
import { FREQUENCY_LABELS, type RecurrenceFrequency } from "@/lib/jobs";
import { toast } from "sonner";
import type { Job, GhlContact } from "@/api/types";
import type { JobFormState } from "@/components/jobs/useJobForm";

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

type Props = JobFormState & {
  job?: Job | null;
  initialContactSearchTerm?: string;
  /** Migration-only field, hidden unless explicitly requested (e.g. by MigrateJobPage). */
  showCompletedAtField?: boolean;
  /** Migration-only UX: sticky pickers (stay open until select/close). */
  migrationMode?: boolean;
};

export function JobFormFields({
  job,
  initialContactSearchTerm,
  showCompletedAtField,
  migrationMode,
  form,
  setForm,
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
  allStaff,
  allProducts,
  contacts,
  suggestedJobProducts,
  previousAddresses,
  assignableStaff,
  selectedContact,
  lineItemsTotal,
  toggleStaff,
  addLineItem,
  updateLineItem,
  removeLineItem,
  selectContact,
}: Props) {
  const completedAtDate = form.completed_at ? form.completed_at.slice(0, 10) : "";
  const completedAtTime = form.completed_at ? form.completed_at.slice(11, 16) : "";

  // cmdk's CommandInput needs its search text synced in explicitly.
  const [contactSearchValue, setContactSearchValue] = useState(initialContactSearchTerm ?? "");
  useEffect(() => {
    if (initialContactSearchTerm) setContactSearchValue(initialContactSearchTerm);
  }, [initialContactSearchTerm]);
  const stickyContactPicker = Boolean(initialContactSearchTerm);

  const isUnpaid = form.payment_status === "unpaid";
  const dateLabel = form.service_type === "installation" ? "Installation date" : "Service date";

  function setCompletedAtDate(d: string) {
    setForm((f) => ({ ...f, completed_at: d ? `${d}T${completedAtTime || "00:00"}:00Z` : null }));
  }
  function setCompletedAtTime(t: string) {
    setForm((f) => ({ ...f, completed_at: completedAtDate ? `${completedAtDate}T${t || "00:00"}:00Z` : null }));
  }

  return (
    <div className="space-y-6">
      {/* Contact */}
      <Section title="Contact">
        <Field label="Contact">
          <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className={cn("w-full justify-between font-normal", !selectedContact && "text-muted-foreground")}
              >
                {selectedContact
                  ? selectedContact.name || selectedContact.email || selectedContact.phone || selectedContact.id
                  : "Select a contact…"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[--radix-popover-trigger-width]"
              align="start"
              onInteractOutside={(e) => { if (stickyContactPicker) e.preventDefault(); }}
              onPointerDownOutside={(e) => { if (stickyContactPicker) e.preventDefault(); }}
            >
              <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                <CommandInput
                  placeholder="Search by name, email, or phone…"
                  value={contactSearchValue}
                  onValueChange={setContactSearchValue}
                />
                <CommandList>
                  <CommandEmpty>
                    {contacts.length === 0 ? "No contacts synced yet." : "No matching contacts."}
                  </CommandEmpty>
                  <CommandGroup>
                    {contacts.map((c: GhlContact) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.id}`}
                        onSelect={() => selectContact(c)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", form.ghl_contact_id === c.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="font-medium">{c.name || "(no name)"}</span>
                          <span className="text-xs text-muted-foreground">
                            {[c.email, c.phone].filter(Boolean).join(" · ") || c.id}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
      </Section>

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
              form.lat && form.lng
                ? `Coordinates captured: ${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`
                : "Pick a suggestion to capture coordinates."
            }
          >
            <AddressAutocomplete
              value={form.address}
              onChange={(val) => setForm((f) => ({ ...f, address: val }))}
              onSelect={({ address, lat, lng }) => {
                setForm((f) => ({ ...f, address, lat, lng }));
                toast.success("Address & coordinates set");
              }}
              placeholder="Start typing an address…"
            />
            {previousAddresses.length > 0 && !form.address && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-xs text-muted-foreground">Previous addresses for this contact:</span>
                {previousAddresses.map((j) => (
                  <Button
                    key={j.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start text-left h-auto py-1.5 px-3 text-xs font-normal"
                    onClick={() => {
                      setForm((f) => ({ ...f, address: j.address, lat: j.lat, lng: j.lng }));
                      toast.success("Address filled from previous job");
                    }}
                  >
                    {j.address}
                  </Button>
                ))}
              </div>
            )}
          </Field>
        ) : (
          <div className="space-y-3">
            <Field label="Address">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </Field>
            <Field label="Google Maps link" hint="Paste a link and coordinates fill in automatically.">
              <Input
                placeholder="https://maps.google.com/?q=37.7749,-122.4194"
                onChange={(e) => {
                  const coords = parseCoordsFromUrl(e.target.value);
                  if (coords) {
                    setForm({ ...form, lat: coords.lat, lng: coords.lng });
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
                  value={form.lat || ""}
                  onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
                  placeholder="37.7749"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={form.lng || ""}
                  onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
                  placeholder="-122.4194"
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
            <Select
              value={(form.service_type as string) ?? "installation"}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  service_type: v,
                  sale_date: v === "installation" ? (f.sale_date ?? f.service_date) : null,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="installation">Installation</SelectItem>
                <SelectItem value="servicing">Servicing</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.service_type === "installation" && (
            <Field label="Sale date">
              <Input
                type="date"
                value={(form.sale_date as string) ?? ""}
                onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
              />
            </Field>
          )}
          <Field label={dateLabel}>
            <Input
              type="date"
              value={form.service_date}
              onChange={(e) => setForm({ ...form, service_date: e.target.value })}
            />
          </Field>
          <Field label="Time">
            <Input
              type="time"
              value={form.service_time as string}
              onChange={(e) => setForm({ ...form, service_time: e.target.value })}
            />
          </Field>
          <Field label="Duration">
            <Select value={String(form.duration ?? 60)} onValueChange={(v) => setForm({ ...form, duration: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{durationLabel(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Repeats"
          hint={job?.parent_job_id ? `Occurrence ${job.occurrence_index} of a recurring series.` : undefined}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs
              value={form.is_recurring ? "recurring" : "onetime"}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  is_recurring: v === "recurring",
                  frequency: v === "recurring" ? (form.frequency ?? "monthly") : null,
                })
              }
            >
              <TabsList className="grid w-full sm:w-auto grid-cols-2">
                <TabsTrigger value="onetime">One-time</TabsTrigger>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
              </TabsList>
            </Tabs>
            {form.is_recurring && (
              <Select
                value={(form.frequency as RecurrenceFrequency | null) ?? undefined}
                onValueChange={(v) => setForm({ ...form, frequency: v as RecurrenceFrequency })}
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
        <ActivityCombobox
          value={form.activity ?? null}
          onChange={(id) => setForm((f) => ({ ...f, activity: id }))}
        />
      </Section>

      {/* Status & payment */}
      <Section title="Status & payment">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Job status">
            <Select
              value={form.status ?? "pending"}
              onValueChange={(v) => {
                setForm({ ...form, status: v });
                if (v === "pending") setStaffIds([]);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Call status">
            <Select
              value={(form.call_status as string | null) ?? "not_called"}
              onValueChange={(v) => setForm({ ...form, call_status: v })}
            >
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
              disabled={isUnpaid}
              value={isUnpaid ? "" : form.service_value ?? 0}
              onChange={(e) => setForm({ ...form, service_value: parseFloat(e.target.value) || 0 })}
              placeholder={isUnpaid ? "Unpaid" : undefined}
            />
          </Field>
          <div className="flex items-center gap-2 sm:pt-7">
            <Checkbox
              id="job-form-unpaid"
              checked={isUnpaid}
              onCheckedChange={(checked) =>
                setForm({
                  ...form,
                  payment_status: checked ? "unpaid" : "paid",
                  service_value: checked ? 0 : form.service_value,
                })
              }
            />
            <Label htmlFor="job-form-unpaid" className="text-sm font-normal cursor-pointer">
              Mark as unpaid
            </Label>
          </div>
        </div>

        {showCompletedAtField && (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <div className="col-span-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              Migration-only — Completed At (UTC)
            </div>
            <Field label="Date">
              <Input type="date" value={completedAtDate} onChange={(e) => setCompletedAtDate(e.target.value)} />
            </Field>
            <Field label="Time (UTC)">
              <Input type="time" value={completedAtTime} onChange={(e) => setCompletedAtTime(e.target.value)} />
            </Field>
          </div>
        )}
      </Section>

      {/* Assignment */}
      <Section title="Assignment">
        <Field
          label="Assigned staff"
          hint={form.status === "pending" ? "Staff are assigned once the job is scheduled." : undefined}
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
                  disabled={form.status === "pending"}
                  className={cn("w-full justify-between font-normal", staffIds.length === 0 && "text-muted-foreground")}
                >
                  {staffIds.length === 0
                    ? form.status === "pending"
                      ? "Assigned at scheduling"
                      : "Select staff…"
                    : `${staffIds.length} staff selected`}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width]"
                align="start"
                onInteractOutside={(e) => { if (migrationMode) e.preventDefault(); }}
                onPointerDownOutside={(e) => { if (migrationMode) e.preventDefault(); }}
              >
                <Command>
                  <CommandInput placeholder="Search staff…" />
                  <CommandList>
                    <CommandEmpty>No matching staff.</CommandEmpty>
                    <CommandGroup>
                      {assignableStaff.map((s) => (
                        <CommandItem key={s.id} value={`${s.name} ${s.email ?? ""}`} onSelect={() => toggleStaff(s.id)}>
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
            {lineItems.length === 0
              ? "No products added."
              : `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-3 w-3 mr-1" /> Add line
          </Button>
        </div>

        {!job && form.service_type === "servicing" && suggestedJobProducts.length > 0 && (() => {
          const addedIds = new Set(lineItems.map((l) => l.product_id));
          const chips = suggestedJobProducts.filter((s) => !addedIds.has(s.product_id));
          if (chips.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground self-center">Suggested:</span>
              {chips.map((s) => {
                const p = allProducts.find((x) => x.id === s.product_id);
                if (!p) return null;
                return (
                  <button
                    key={s.product_id}
                    type="button"
                    onClick={() => setLineItems((prev) => [...prev, { product_id: p.id, quantity: 1, unit_price: Number(p.price) }])}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {p.name}{p.sku ? ` (${p.sku})` : ""}
                  </button>
                );
              })}
            </div>
          );
        })()}

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
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Outcome, follow-ups, anything worth remembering…"
        />
      </Section>
    </div>
  );
}
