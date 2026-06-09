import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, Plus, CalendarClock, Users, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { PurchasesAddresses } from "@/components/contacts/PurchasesAddresses";
import { daysUntil, getDueTag, DUE_TAG_LABELS, type DueTag, FREQUENCY_LABELS, type RecurrenceFrequency, addFrequency } from "@/lib/jobs";
import type { Job, JobInsert, JobProductLine, JobCompletionInsert } from "@/api/types";
import { useListJobsQuery, useCreateJobMutation, useUpdateJobMutation, useDeleteJobMutation, useSetJobProductsMutation, useSetJobStaffMutation, useListAllJobProductsQuery, useListJobCompletionsQuery, useDeleteJobCompletionMutation, useCreateJobCompletionMutation } from "@/api/jobsApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListStaffQuery, useListJobStaffQuery } from "@/api/staffApi";
import { useListGhlContactsQuery } from "@/api/contactsApi";

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "skip") return "bg-purple-500/15 text-purple-700 border-purple-500/30";
  if (s === "not_interested") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

function dueTagBadgeClass(t: DueTag) {
  switch (t) {
    case "overdue": return "bg-red-500/15 text-red-700 border-red-500/30";
    case "due_7": return "bg-orange-500/15 text-orange-700 border-orange-500/30";
    case "due_15": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "due_30": return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "due_60": return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  }
}

type JobProductRow = { job_id: string; product_id: string; quantity: number; unit_price: number };

export function ContactJobsPage() {
  const { ghlContactId } = useParams<{ ghlContactId: string }>();

  const { data: allContacts = [] } = useListGhlContactsQuery();
  const { data: allJobs = [], isLoading } = useListJobsQuery();
  const { data: products = [] } = useListProductsQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: allJobStaff = [] } = useListJobStaffQuery();
  const { data: allJobProducts = [] } = useListAllJobProductsQuery();
  const { data: allCompletions = [] } = useListJobCompletionsQuery();
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [setJobStaff] = useSetJobStaffMutation();
  const [createCompletion] = useCreateJobCompletionMutation();
  const [deleteCompletion] = useDeleteJobCompletionMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [dueTagFilter, setDueTagFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const contact = useMemo(() => allContacts.find((c) => c.id === ghlContactId) ?? null, [allContacts, ghlContactId]);

  const jobs = useMemo(() => allJobs.filter((j) => j.ghl_contact_id === ghlContactId), [allJobs, ghlContactId]);

  const jobStaffMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of allJobStaff) (m[r.job_id] ??= []).push(r.staff_id);
    return m;
  }, [allJobStaff]);

  const jobProductsMap = useMemo(() => {
    const m: Record<string, JobProductRow[]> = {};
    for (const p of allJobProducts) (m[p.job_id] ??= []).push(p as JobProductRow);
    return m;
  }, [allJobProducts]);

  const completions = useMemo(() => {
    const emailLc = contact?.email?.toLowerCase() ?? null;
    const phoneDigits = (contact?.phone ?? "").replace(/\D/g, "");
    return allCompletions.filter((c) => {
      if (emailLc && c.email && c.email.toLowerCase() === emailLc) return true;
      const cd = (c.phone ?? "").replace(/\D/g, "");
      if (phoneDigits.length >= 4 && cd.length >= 4 && cd === phoneDigits) return true;
      return false;
    });
  }, [allCompletions, contact]);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "Unknown";
  const assignableStaff = staff.filter((s) => s.role === "user" && s.active);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (staffFilter !== "all" && !(jobStaffMap[j.id] ?? []).includes(staffFilter)) return false;
      if (dueTagFilter !== "all" && getDueTag(j) !== dueTagFilter) return false;
      if (dateFrom && j.service_date < dateFrom) return false;
      if (dateTo && j.service_date > dateTo) return false;
      return true;
    });
  }, [jobs, statusFilter, staffFilter, dueTagFilter, dateFrom, dateTo, jobStaffMap]);

  const sortedJobs = useMemo(() => [...filteredJobs].sort((a, b) => b.service_date.localeCompare(a.service_date)), [filteredJobs]);

  async function handleSubmit(data: JobInsert, extras: { staffIds: string[]; lineItems: JobProductLine[] }) {
    try {
      const isDone = (s: string | undefined) => s === "completed" || s === "skip";
      const wasCompleted = isDone(editing?.status);
      const nowCompleted = isDone(data.status);
      let savedId: string | null = null;
      if (editing) {
        if (!wasCompleted && nowCompleted) {
          try {
            const completionBody: JobCompletionInsert = {
              job_id: editing.id,
              service_date: data.service_date,
              service_time: data.service_time ?? null,
              service_value: Number(data.service_value) || 0,
              name: data.name,
              email: data.email,
              phone: data.phone ?? null,
              address: data.address,
              lat: data.lat ?? 0,
              lng: data.lng ?? 0,
              notes: data.notes ?? null,
              staff_ids: extras.staffIds,
              product_lines: extras.lineItems,
              service_type: data.service_type ?? "installation",
              sale_date: data.sale_date ?? null,
            };
            await createCompletion(completionBody).unwrap();
          } catch (e: unknown) {
            toast.error(e instanceof Error ? `Completion not recorded: ${e.message}` : "Completion not recorded");
          }
        }
        if (!wasCompleted && nowCompleted && data.is_recurring && data.frequency) {
          const nextDate = addFrequency(data.service_date, data.frequency as RecurrenceFrequency);
          await updateJob({ id: editing.id, body: { ...data, service_date: nextDate, status: "pending", service_type: "servicing", sale_date: null } }).unwrap();
          toast.success(`Recurring job rolled to ${nextDate}`);
        } else {
          await updateJob({ id: editing.id, body: data }).unwrap();
          toast.success("Job updated");
        }
        savedId = editing.id;
      } else {
        const created = await createJob({ ...data, ghl_contact_id: ghlContactId ?? null }).unwrap();
        savedId = created.id;
        toast.success("Sale recorded");
      }
      if (savedId) {
        await setJobStaff({ jobId: savedId, staffIds: extras.staffIds }).unwrap();
        await setJobProducts({ jobId: savedId, lines: extras.lineItems }).unwrap();
      }
      setEditing(null);
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job?")) return;
    try { await deleteJob(id).unwrap(); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); }
  }

  async function handleDeleteAddress(address: string) {
    if (!confirm(`Delete all jobs and completion records at "${address}"?`)) return;
    try {
      const target = address.trim();
      await Promise.all([
        ...jobs.filter((j) => j.address.trim() === target).map((j) => deleteJob(j.id).unwrap()),
        ...completions.filter((c) => c.address.trim() === target).map((c) => deleteCompletion(c.id).unwrap()),
      ]);
      toast.success("Address removed");
    } catch { toast.error("Failed to delete address"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
                {isLoading ? "Loading…" : contact?.name ?? "Contact"}
              </h1>
              {contact && (
                <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                  {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</span>}
                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone}</span>}
                </div>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /><span className="hidden sm:inline ml-1">Add New</span>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="purchases">Purchases & Addresses</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            <Card className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="grid gap-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="skip">Skip This Time</SelectItem>
                    <SelectItem value="not_interested">Not Interested Anymore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {assignableStaff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Due tag</Label>
                <Select value={dueTagFilter} onValueChange={setDueTagFilter}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All due tags</SelectItem>
                    {Object.entries(DUE_TAG_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </Card>

            {isLoading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
            ) : sortedJobs.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No jobs match the current filters.</Card>
            ) : (
              <div className="grid gap-2">
                {sortedJobs.map((job) => {
                  const lines = jobProductsMap[job.id] ?? [];
                  const linesTotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0);
                  const tag = getDueTag(job);
                  const days = daysUntil(job.service_date);
                  const dateLabel = new Date(job.service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                  let countdown: string;
                  if (job.status === "completed" || job.status === "skip") countdown = "Completed";
                  else if (job.status === "not_interested") countdown = "Not interested";
                  else if (days < 0) countdown = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
                  else if (days === 0) countdown = "Due today";
                  else if (days === 1) countdown = "Due tomorrow";
                  else countdown = `in ${days} days`;
                  const sids = jobStaffMap[job.id] ?? [];
                  return (
                    <Card key={job.id} className="p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={statusBadgeClass(job.status)}>{job.status}</Badge>
                            {job.is_recurring && job.frequency && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {FREQUENCY_LABELS[job.frequency as RecurrenceFrequency]}
                              </Badge>
                            )}
                            {tag && <Badge variant="outline" className={dueTagBadgeClass(tag)}>{DUE_TAG_LABELS[tag]}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                            <CalendarClock className="h-3 w-3" />
                            Service: <strong className="text-foreground">{dateLabel}</strong>
                            <span>· {countdown}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                            <MapPin className="h-3 w-3" /> {job.address}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                            <Users className="h-3 w-3" />
                            <span className="font-medium text-foreground">Staff:</span>
                            {sids.length === 0 ? <span>Unassigned</span> : sids.map((sid, i, arr) => (
                              <span key={sid}>{staffName(sid)}{i < arr.length - 1 ? "," : ""}</span>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Sale value: ${Number(job.service_value).toFixed(2)}
                            {lines.length > 0 && <> · Line items: ${linesTotal.toFixed(2)}</>}
                          </div>
                          {lines.length > 0 && (
                            <div className="mt-2 border-t pt-2">
                              <div className="text-xs font-medium mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Products</div>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {lines.map((l, i) => (
                                  <li key={i} className="flex justify-between gap-3">
                                    <span className="truncate">{productName(l.product_id)} × {Number(l.quantity)}</span>
                                    <span>${(Number(l.quantity) * Number(l.unit_price)).toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {job.notes && (
                            <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                              <span className="font-medium text-foreground">Notes: </span>{job.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(job); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases">
            <PurchasesAddresses
              jobs={jobs}
              completions={completions}
              jobProducts={jobProductsMap}
              products={products}
              onDeleteAddress={handleDeleteAddress}
            />
          </TabsContent>
        </Tabs>
      </main>

      <JobFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        job={editing}
        defaultGhlContactId={ghlContactId}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
