import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Mail, Phone, Package, CalendarClock, Calendar as CalendarIcon, Users, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { PurchasesAddresses } from "@/components/contacts/PurchasesAddresses";
import { ContactActivity } from "@/components/contacts/ContactActivity";
import { groupJobsByContact, contactIdFromKey } from "./ContactsListPage";
import { daysUntil, getDueTag, DUE_TAG_LABELS, type DueTag, FREQUENCY_LABELS, type RecurrenceFrequency } from "@/lib/jobs";
import type { Job, JobInsert, JobCompletion, JobProductLine } from "@/api/types";
import { useListJobsQuery, useUpdateJobMutation, useDeleteJobMutation, useSetJobProductsMutation, useSetJobStaffMutation, useListAllJobProductsQuery, useListJobCompletionsQuery, useUpdateJobCompletionMutation, useDeleteJobCompletionMutation } from "@/api/jobsApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useListStaffQuery, useListJobStaffQuery } from "@/api/staffApi";

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
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

export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const decodedId = contactId ? decodeURIComponent(contactId) : "";

  const { data: allJobs = [], isLoading } = useListJobsQuery();
  const { data: products = [] } = useListProductsQuery();
  const { data: staff = [] } = useListStaffQuery();
  const { data: allJobStaff = [] } = useListJobStaffQuery();
  const { data: allJobProducts = [] } = useListAllJobProductsQuery();
  const { data: completions = [] } = useListJobCompletionsQuery();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [setJobProducts] = useSetJobProductsMutation();
  const [setJobStaff] = useSetJobStaffMutation();
  const [updateCompletion] = useUpdateJobCompletionMutation();
  const [deleteCompletion] = useDeleteJobCompletionMutation();

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editingCompletion, setEditingCompletion] = useState<JobCompletion | null>(null);
  const [completionForm, setCompletionForm] = useState({ service_date: "", service_value: "0", notes: "" });

  const jobStaffMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of allJobStaff) (m[r.job_id] ??= []).push(r.staff_id);
    return m;
  }, [allJobStaff]);

  const jobProducts = useMemo(() => {
    const m: Record<string, JobProductRow[]> = {};
    for (const p of allJobProducts) (m[p.job_id] ??= []).push(p as JobProductRow);
    return m;
  }, [allJobProducts]);

  const contact = useMemo(() => {
    const groups = groupJobsByContact(allJobs);
    return groups.find((g) => contactIdFromKey(g.key) === contactId) ?? null;
  }, [allJobs, contactId]);

  const contactCompletions = useMemo(() => {
    if (!contact) return [];
    const emails = new Set(contact.emails.map((e) => e.toLowerCase()));
    const phones = new Set(contact.phones.map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 4));
    return completions.filter((c) => {
      if (c.email && emails.has(c.email.toLowerCase())) return true;
      const digits = (c.phone ?? "").replace(/\D/g, "");
      if (digits.length >= 4 && phones.has(digits)) return true;
      return false;
    });
  }, [contact, completions]);

  type HistoryEntry = | { kind: "job"; date: string; job: Job } | { kind: "completion"; date: string; completion: JobCompletion };

  const byLocation = useMemo(() => {
    if (!contact) return [] as { address: string; entries: HistoryEntry[] }[];
    const map = new Map<string, HistoryEntry[]>();
    for (const j of contact.jobs) {
      const key = j.address.trim();
      const arr = map.get(key) ?? [];
      arr.push({ kind: "job", date: j.service_date, job: j });
      map.set(key, arr);
    }
    for (const c of contactCompletions) {
      const key = c.address.trim();
      const arr = map.get(key) ?? [];
      arr.push({ kind: "completion", date: c.completed_at, completion: c });
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([address, list]) => ({
      address,
      entries: list.sort((a, b) => b.date.localeCompare(a.date)),
    }));
  }, [contact, contactCompletions]);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "Unknown";

  async function handleDeleteAddress(address: string) {
    if (!confirm(`Delete all jobs and completion records at "${address}" for this contact?`)) return;
    try {
      const jobsToDelete = (contact?.jobs ?? []).filter((j) => j.address.trim() === address.trim());
      const compsToDelete = contactCompletions.filter((c) => c.address.trim() === address.trim());
      await Promise.all([
        ...jobsToDelete.map((j) => deleteJob(j.id).unwrap()),
        ...compsToDelete.map((c) => deleteCompletion(c.id).unwrap()),
      ]);
      toast.success("Address removed");
    } catch { toast.error("Failed to delete address"); }
  }

  async function handleJobSubmit(data: JobInsert, extras: { staffIds: string[]; lineItems: JobProductLine[] }) {
    if (!editingJob) return;
    try {
      await updateJob({ id: editingJob.id, body: data }).unwrap();
      await setJobStaff({ jobId: editingJob.id, staffIds: extras.staffIds }).unwrap();
      await setJobProducts({ jobId: editingJob.id, lines: extras.lineItems }).unwrap();
      toast.success("Job updated");
      setEditingJob(null);
    } catch { toast.error("Failed to update job"); }
  }

  async function handleDeleteJob(id: string) {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    try { await deleteJob(id).unwrap(); toast.success("Job deleted"); }
    catch { toast.error("Failed to delete job"); }
  }

  function openEditCompletion(c: JobCompletion) {
    setEditingCompletion(c);
    setCompletionForm({ service_date: c.service_date, service_value: String(c.service_value ?? 0), notes: c.notes ?? "" });
  }

  async function saveCompletion() {
    if (!editingCompletion) return;
    try {
      await updateCompletion({ id: editingCompletion.id, body: {
        service_date: completionForm.service_date,
        service_value: Number(completionForm.service_value) || 0,
        notes: completionForm.notes || null,
      }}).unwrap();
      toast.success("Completion updated");
      setEditingCompletion(null);
    } catch { toast.error("Failed to update"); }
  }

  async function handleDeleteCompletion(id: string) {
    if (!confirm("Delete this completion record?")) return;
    try { await deleteCompletion(id).unwrap(); toast.success("Completion deleted"); }
    catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/contacts"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {isLoading ? "Loading…" : contact?.name ?? "Contact not found"}
            </h1>
            {contact && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                {contact.emails.map((e) => (
                  <span key={e} className="flex items-center gap-1"><Mail className="h-3 w-3" /> {e}</span>
                ))}
                {contact.phones.map((p) => (
                  <span key={p} className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!isLoading && !contact && (
          <Card className="p-12 text-center text-muted-foreground">
            Contact not found. <Link to="/contacts" className="underline">Back to job history</Link>
          </Card>
        )}

        {contact && (
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="purchases">Purchases & Addresses</TabsTrigger>
              <TabsTrigger value="activity">Record Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-6">
              {byLocation.map(({ address, entries }) => (
                <section key={address} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">{address}</h2>
                    <Badge variant="secondary">{entries.length} record{entries.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {entries.map((entry, idx) => {
                      if (entry.kind === "completion") {
                        const c = entry.completion;
                        const lines = (c.product_lines as unknown as JobProductRow[]) ?? [];
                        const linesTotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0);
                        const completedLabel = new Date(c.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
                        const serviceLabel = new Date(c.service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                        const sids = c.staff_ids ?? [];
                        return (
                          <Card key={`c-${c.id}`} className="p-3 border-emerald-500/30 bg-emerald-500/5">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    Job completed — {completedLabel}
                                  </span>
                                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">completed</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <CalendarClock className="h-3 w-3" />
                                  Service date: <strong className="text-foreground">{serviceLabel}</strong>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                                  <Users className="h-3 w-3" />
                                  <span className="font-medium text-foreground">Done by:</span>
                                  {sids.length === 0 ? <span>Unassigned</span> : sids.map((sid, i, arr) => (
                                    <span key={sid}>{staffName(sid)}{i < arr.length - 1 ? "," : ""}</span>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Sale value: ${Number(c.service_value).toFixed(2)}
                                  {lines.length > 0 && <> · Line items: ${linesTotal.toFixed(2)}</>}
                                </div>
                                {lines.length > 0 && (
                                  <div className="mt-2 border-t pt-2">
                                    <div className="text-xs font-medium mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Products sold</div>
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
                                {c.notes && (
                                  <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                                    <span className="font-medium text-foreground">Notes: </span>{c.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => openEditCompletion(c)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteCompletion(c.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                              </div>
                            </div>
                          </Card>
                        );
                      }
                      const job = entry.job;
                      const lines = jobProducts[job.id] ?? [];
                      const linesTotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0);
                      const tag = getDueTag(job);
                      const days = daysUntil(job.service_date);
                      const dateLabel = new Date(job.service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                      let countdown: string;
                      if (job.status === "completed") countdown = "Completed";
                      else if (days < 0) countdown = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
                      else if (days === 0) countdown = "Due today";
                      else if (days === 1) countdown = "Due tomorrow";
                      else countdown = `in ${days} days`;
                      return (
                        <Card key={`j-${job.id}-${idx}`} className="p-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium flex items-center gap-1">
                                  {job.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <CalendarIcon className="h-3.5 w-3.5" />}
                                  {job.status === "completed" ? `Job completed — ${dateLabel}` : `Sale recorded — service ${dateLabel}`}
                                </span>
                                <Badge variant="outline" className={statusBadgeClass(job.status)}>{job.status === "completed" ? "job completed" : job.status}</Badge>
                                {job.is_recurring && job.frequency && (
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                    {FREQUENCY_LABELS[job.frequency as RecurrenceFrequency]}
                                  </Badge>
                                )}
                                {tag && <Badge variant="outline" className={dueTagBadgeClass(tag)}>{DUE_TAG_LABELS[tag]}</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <CalendarClock className="h-3 w-3" />
                                Next service due: <strong className="text-foreground">{dateLabel}</strong>
                                <span>· {countdown}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                                <Users className="h-3 w-3" />
                                <span className="font-medium text-foreground">Done by:</span>
                                {(jobStaffMap[job.id] ?? []).length === 0 ? <span>Unassigned</span> : (jobStaffMap[job.id] ?? []).map((sid, i, arr) => (
                                  <span key={sid}>{staffName(sid)}{i < arr.length - 1 ? "," : ""}</span>
                                ))}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Sale value: ${Number(job.service_value).toFixed(2)}
                                {lines.length > 0 && <> · Line items: ${linesTotal.toFixed(2)}</>}
                              </div>
                              {lines.length > 0 && (
                                <div className="mt-2 border-t pt-2">
                                  <div className="text-xs font-medium mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Products sold</div>
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
                                  <span className="font-medium text-foreground">Outcome / notes: </span>{job.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => setEditingJob(job)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </TabsContent>

            <TabsContent value="purchases">
              <PurchasesAddresses
                jobs={contact.jobs}
                completions={contactCompletions}
                jobProducts={jobProducts}
                products={products}
                onDeleteAddress={handleDeleteAddress}
              />
            </TabsContent>

            <TabsContent value="activity">
              <ContactActivity
                contactKey={decodedId}
                jobs={contact.jobs}
                onOpenJob={(j) => setEditingJob(j)}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {editingJob && (
        <JobFormDialog open={!!editingJob} onOpenChange={(v) => !v && setEditingJob(null)} job={editingJob} onSubmit={handleJobSubmit} />
      )}

      <Dialog open={!!editingCompletion} onOpenChange={(v) => !v && setEditingCompletion(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit completed job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="comp-date">Service date</Label>
              <Input id="comp-date" type="date" value={completionForm.service_date} onChange={(e) => setCompletionForm({ ...completionForm, service_date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="comp-value">Sale value</Label>
              <Input id="comp-value" type="number" step="0.01" value={completionForm.service_value} onChange={(e) => setCompletionForm({ ...completionForm, service_value: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="comp-notes">Notes</Label>
              <Textarea id="comp-notes" rows={3} value={completionForm.notes} onChange={(e) => setCompletionForm({ ...completionForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompletion(null)}>Cancel</Button>
            <Button onClick={saveCompletion}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
