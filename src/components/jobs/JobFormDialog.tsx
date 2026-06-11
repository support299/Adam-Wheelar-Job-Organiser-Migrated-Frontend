import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { JobActivity } from "@/components/jobs/JobActivity";
import { contactKeyForJob } from "@/pages/ContactsListPage";
import { FREQUENCY_LABELS, type RecurrenceFrequency } from "@/lib/jobs";
import { toast } from "sonner";
import { useListStaffQuery } from "@/api/staffApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListGhlContactsQuery } from "@/api/contactsApi";
import { useGetJobStaffQuery, useGetJobProductsQuery } from "@/api/jobsApi";
import type { Job, JobInsert, JobProductLine, GhlContact } from "@/api/types";

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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job?: Job | null;
  defaultGhlContactId?: string | null;
  defaultServiceType?: "installation" | "servicing";
  onSubmit: (
    data: JobInsert,
    extras: { staffIds: string[]; lineItems: JobProductLine[] },
  ) => Promise<void>;
};

const empty: JobInsert = {
  name: "",
  email: "",
  phone: "",
  ghl_contact_id: null,
  service_value: 0,
  address: "",
  lat: 0,
  lng: 0,
  service_date: new Date().toISOString().slice(0, 10),
  service_time: "09:00",
  status: "pending",
  notes: "",
  is_recurring: true,
  frequency: "annually",
  service_type: "installation",
  sale_date: new Date().toISOString().slice(0, 10),
  call_status: "not_called",
  calls_made: 0,
};

export function JobFormDialog({
  open,
  onOpenChange,
  job,
  defaultGhlContactId,
  defaultServiceType,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<JobInsert>(empty);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [addressMode, setAddressMode] = useState<"automatic" | "manual">("automatic");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<JobProductLine[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);

  const { data: allStaff = [] } = useListStaffQuery(undefined, { skip: !open });
  const { data: allProducts = [] } = useListProductsQuery(undefined, { skip: !open });
  const { data: contacts = [] } = useListGhlContactsQuery(undefined, { skip: !open });
  const { data: existingStaff } = useGetJobStaffQuery(job?.id ?? "", { skip: !open || !job });
  const { data: existingProducts } = useGetJobProductsQuery(job?.id ?? "", { skip: !open || !job });

  useEffect(() => {
    if (!open) return;
    if (existingStaff) setStaffIds(existingStaff.staff_ids);
  }, [open, existingStaff]);

  useEffect(() => {
    if (!open) return;
    if (existingProducts) {
      setLineItems(
        existingProducts.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
      );
    } else if (!job) {
      setLineItems([]);
    }
  }, [open, existingProducts, job]);

  useEffect(() => {
    if (open) setActiveTab("details");
  }, [open]);

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
              call_status: job.call_status ?? "not_called",
              calls_made: job.calls_made ?? 0,
            }
          : {
              ...empty,
              ghl_contact_id: defaultGhlContactId ?? null,
              service_type: defaultServiceType ?? empty.service_type,
              sale_date:
                (defaultServiceType ?? empty.service_type) === "installation"
                  ? empty.sale_date
                  : null,
            },
      );
      if (!job) {
        setStaffIds([]);
        setLineItems([]);
      }
    }
  }, [open, job, defaultGhlContactId, defaultServiceType]);

  useEffect(() => {
    if (!open || job) return;
    if (!defaultGhlContactId) return;
    const c = contacts.find((x) => x.id === defaultGhlContactId);
    if (c) {
      setForm((f) =>
        f.ghl_contact_id === c.id && f.name
          ? f
          : { ...f, ghl_contact_id: c.id, name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "" },
      );
    }
  }, [contacts, defaultGhlContactId, open, job]);

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
    if (lineItems.length === 0) {
      toast.error("Please add at least one product before saving");
      return;
    }
    if (form.status !== "pending" && staffIds.length === 0) {
      toast.error("Assign at least one staff member to the job");
      return;
    }
    try {
      setSaving(true);
      const prevCallStatus = job?.call_status ?? "not_called";
      const newCallStatus = (form.call_status as string | null) ?? "not_called";
      const baseCalls = Number(form.calls_made ?? 0);
      const callsMade =
        (newCallStatus === "connected" || newCallStatus === "not_connected") &&
        newCallStatus !== prevCallStatus
          ? baseCalls + 1
          : baseCalls;
      await onSubmit(
        { ...form, frequency: form.is_recurring ? form.frequency : null, call_status: newCallStatus, calls_made: callsMade },
        { staffIds, lineItems },
      );
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const assignableStaff = allStaff.filter((s) => s.role === "user" && s.active);

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

  const selectedContact = contacts.find((c: GhlContact) => c.id === form.ghl_contact_id) ?? null;

  function selectContact(c: GhlContact) {
    setForm((f) => ({
      ...f,
      ghl_contact_id: c.id,
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    }));
    setContactPickerOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-[calc(100vw-1rem)] max-h-[92vh] overflow-y-auto p-4 sm:p-6"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{job ? "Edit Job" : "Enter New Job"}</DialogTitle>
        </DialogHeader>
        {job && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="grid gap-4">
          {/* Contact picker */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>Contact</Label>
            <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn("justify-between font-normal", !selectedContact && "text-muted-foreground")}
                >
                  {selectedContact
                    ? selectedContact.name || selectedContact.email || selectedContact.phone || selectedContact.id
                    : "Select a contact from System…"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Search by name, email, or phone…" />
                  <CommandList>
                    <CommandEmpty>
                      {contacts.length === 0 ? "No contacts synced from System yet." : "No matching contacts."}
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
          </div>

          {/* Address */}
          <div className="grid gap-2" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>Address</Label>
            <Tabs value={addressMode} onValueChange={(v) => setAddressMode(v as "automatic" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="automatic">Automatic</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
              <TabsContent value="automatic" className="space-y-2 mt-3">
                <AddressAutocomplete
                  value={form.address}
                  onChange={(val) => setForm((f) => ({ ...f, address: val }))}
                  onSelect={({ address, lat, lng }) => {
                    setForm((f) => ({ ...f, address, lat, lng }));
                    toast.success("Address & coordinates set");
                  }}
                  placeholder="Start typing an address…"
                />
                {form.lat && form.lng ? (
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pick a suggestion to capture coordinates.</p>
                )}
              </TabsContent>
              <TabsContent value="manual" className="space-y-3 mt-3">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St, City, State"
                />
                <div className="grid gap-1.5">
                  <Label className="text-xs">Paste a Google Maps link (auto-fills coordinates)</Label>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.lat || ""}
                      onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
                      placeholder="37.7749"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.lng || ""}
                      onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
                      placeholder="-122.4194"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Service type + sale date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <div className="grid gap-1.5">
              <Label>Service Type</Label>
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
            </div>
            {form.service_type === "installation" && (
              <div className="grid gap-1.5">
                <Label>Sale Date</Label>
                <Input
                  type="date"
                  value={(form.sale_date as string) ?? ""}
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <div className="grid gap-1.5">
              <Label>Service/Installation Date</Label>
              <Input
                type="date"
                value={form.service_date}
                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Time</Label>
              <Input
                type="time"
                value={form.service_time as string}
                onChange={(e) => setForm({ ...form, service_time: e.target.value })}
              />
            </div>
          </div>

          {/* Service value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <div className="grid gap-1.5">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.service_value ?? 0}
                onChange={(e) => setForm({ ...form, service_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>Job Type</Label>
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="onetime">One-Time</TabsTrigger>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
              </TabsList>
            </Tabs>
            {form.is_recurring && (
              <div className="grid gap-1.5 mt-2">
                <Label>Repeat Frequency</Label>
                <Select
                  value={(form.frequency as RecurrenceFrequency | null) ?? undefined}
                  onValueChange={(v) => setForm({ ...form, frequency: v as RecurrenceFrequency })}
                >
                  <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>Status</Label>
            <Select
              value={form.status ?? "pending"}
              onValueChange={(v) => {
                setForm({ ...form, status: v });
                if (v === "pending") setStaffIds([]);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="skip">Skip This Time</SelectItem>
                <SelectItem value="not_interested">Not Interested Anymore</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Call status */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3" style={job && activeTab !== "activity" ? { display: "none" } : undefined}>
            <div className="grid gap-1.5">
              <Label>Call Status</Label>
              <Select
                value={(form.call_status as string | null) ?? "not_called"}
                onValueChange={(v) => setForm({ ...form, call_status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_called">Not Called</SelectItem>
                  <SelectItem value="connected">Call Connected</SelectItem>
                  <SelectItem value="not_connected">Call Not Connected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Calls Made</Label>
              <Input
                type="number"
                min={0}
                step="1"
                className="w-24"
                value={Number(form.calls_made ?? 0)}
                onChange={(e) => setForm({ ...form, calls_made: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          {/* Staff */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>
              Assigned Staff
              {form.status === "pending" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(assign when scheduling)</span>
              )}
            </Label>
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
                    className={cn("justify-between font-normal", staffIds.length === 0 && "text-muted-foreground")}
                  >
                    {staffIds.length === 0
                      ? form.status === "pending"
                        ? "Will be assigned at scheduling"
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
                        {assignableStaff.map((s) => {
                          const checked = staffIds.includes(s.id);
                          return (
                            <CommandItem
                              key={s.id}
                              value={`${s.name} ${s.email ?? ""}`}
                              onSelect={() => toggleStaff(s.id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{s.name}</span>
                                {s.email && <span className="text-xs text-muted-foreground">{s.email}</span>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {staffIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
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
          </div>

          {/* Products */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <div className="flex items-center justify-between">
              <Label>Products / Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-3 w-3 mr-1" /> Add line
              </Button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No products added.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-2 items-center">
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
                      placeholder="Qty"
                      className="h-9"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.unit_price}
                      onChange={(e) => updateLineItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                      placeholder="Price"
                      className="h-9"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeLineItem(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground text-right">
                  Line items total: <strong>${lineItemsTotal.toFixed(2)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid gap-1.5" style={job && activeTab !== "details" ? { display: "none" } : undefined}>
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Activity (job notes) — only visible when editing an existing job */}
          {job && (
            <div className="border-t pt-4" style={activeTab !== "activity" ? { display: "none" } : undefined}>
              <JobActivity jobId={job.id} contactKey={contactKeyForJob(job)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
