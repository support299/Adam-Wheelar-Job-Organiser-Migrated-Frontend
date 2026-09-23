import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetJobQuery } from "@/api/jobsApi";
import { useListStaffQuery } from "@/api/staffApi";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectStaffId } from "@/store/authSlice";
import { getCachedJobById, getCachedStaff } from "@/db/dexie";
import type { Job } from "@/api/types";
import { discardDraft, loadDraft, photoDataUrl, toJobSnapshot } from "@/lib/fieldForms/draftStore";
import { enqueueUpload } from "@/lib/fieldForms/outbox";
import { buildServiceSheetPdf } from "@/lib/fieldForms/pdf/serviceSheetPdf";
import { buildInstallChecklistPdf } from "@/lib/fieldForms/pdf/installChecklistPdf";
import type { PdfPhoto } from "@/lib/fieldForms/pdf/pdfKit";
import type {
  FieldFormType,
  InstallChecklistValues,
  ServiceSheetValues,
} from "@/lib/fieldForms/types";
import { useServiceSheetForm } from "@/components/field-forms/useServiceSheetForm";
import { useInstallChecklistForm } from "@/components/field-forms/useInstallChecklistForm";
import { ServiceSheetFormFields } from "@/components/field-forms/ServiceSheetFormFields";
import { InstallChecklistFormFields } from "@/components/field-forms/InstallChecklistFormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Host page for both field forms. Route: /field-form/:formType/:jobId
 *
 * Resolving the job never blocks on the network — a technician opens this in a
 * basement. Order: router state (the normal path from PlansPage), then the saved
 * draft's own snapshot, then the Dexie plan cache, and only then the API.
 */

const isFormType = (v: string | undefined): v is FieldFormType =>
  v === "service" || v === "install";

export function FieldFormPage() {
  const { formType, jobId } = useParams<{ formType: string; jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateJob = (location.state as { job?: Job } | null)?.job;

  const [job, setJob] = useState<Job | null>(stateJob ?? null);
  const [resolving, setResolving] = useState(!stateJob);

  // Last resort only: skipped entirely once the job is in hand.
  const { data: fetchedJob } = useGetJobQuery(!job && jobId ? jobId : skipToken);

  useEffect(() => {
    if (job || !jobId) return;
    let cancelled = false;
    void (async () => {
      const draft = formType && isFormType(formType) ? await loadDraft(formType, jobId) : null;
      if (cancelled) return;
      if (draft) {
        // A draft carries its own snapshot, so a direct reload works offline.
        setJob({
          id: draft.job.jobId,
          name: draft.job.name,
          email: draft.job.email,
          phone: draft.job.phone,
          address: draft.job.address,
          service_date: draft.job.serviceDate,
          service_time: draft.job.serviceTime,
          service_type: draft.job.serviceType,
          staff_ids: draft.job.staffIds,
        } as Job);
        setResolving(false);
        return;
      }
      const cached = await getCachedJobById(jobId);
      if (cancelled) return;
      if (cached) setJob(cached);
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [job, jobId, formType]);

  useEffect(() => {
    if (!job && fetchedJob) setJob(fetchedJob);
  }, [job, fetchedJob]);

  // Staff list comes from the Dexie mirror when offline.
  const { data: staffFromApi } = useListStaffQuery();
  const [cachedStaff, setCachedStaff] = useState<Awaited<ReturnType<typeof getCachedStaff>>>([]);
  useEffect(() => {
    void getCachedStaff().then(setCachedStaff);
  }, []);
  const staff = staffFromApi ?? cachedStaff;
  const myStaffId = useAppSelector(selectStaffId);

  const technicianName = useMemo(() => {
    const mine = staff.find((s) => s.id === myStaffId);
    if (mine) return mine.name;
    const assigned = staff.find((s) => (job?.staff_ids ?? []).includes(s.id));
    return assigned?.name ?? "";
  }, [staff, myStaffId, job]);

  if (!formType || !isFormType(formType) || !jobId) {
    return <Shell><NotFound message="That form type doesn't exist." /></Shell>;
  }

  if (resolving) {
    return (
      <Shell>
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
        </div>
      </Shell>
    );
  }

  if (!job) {
    return (
      <Shell>
        <NotFound message="Couldn't find this job. Open it from a plan so it's available offline." />
      </Shell>
    );
  }

  return (
    <FormHost
      key={`${formType}:${job.id}`}
      formType={formType}
      job={job}
      technicianName={technicianName}
      onDone={() => navigate("/plans")}
    />
  );
}

function Shell({ children, title = "Field form" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plans">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-sm">
        <p>{message}</p>
        <Button asChild size="sm">
          <Link to="/plans">Back to plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type HostProps = {
  formType: FieldFormType;
  job: Job;
  technicianName: string;
  onDone: () => void;
};

function FormHost({ formType, job, technicianName, onDone }: HostProps) {
  // Frozen once: the form must not re-seed if the job refetches mid-edit.
  const snapshot = useMemo(() => toJobSnapshot(job), [job]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return formType === "service" ? (
    <ServiceSheetHost
      snapshot={snapshot}
      technicianName={technicianName}
      online={online}
      onDone={onDone}
    />
  ) : (
    <InstallChecklistHost
      snapshot={snapshot}
      technicianName={technicianName}
      online={online}
      onDone={onDone}
    />
  );
}

type HostInner = {
  snapshot: ReturnType<typeof toJobSnapshot>;
  technicianName: string;
  online: boolean;
  onDone: () => void;
};

/** Shared submit tail: render the PDF, queue it, tell the tech what happened. */
async function submit(
  formType: FieldFormType,
  snapshot: ReturnType<typeof toJobSnapshot>,
  photos: PdfPhoto[],
  values: ServiceSheetValues | InstallChecklistValues,
  online: boolean,
  selectedProducts: Array<{ id: string; name: string }> = [],
) {
  const built =
    formType === "service"
      ? await buildServiceSheetPdf({
          job: snapshot,
          values: values as ServiceSheetValues,
          photos,
        })
      : await buildInstallChecklistPdf({
          job: snapshot,
          values: values as InstallChecklistValues,
          photos,
          selectedProducts,
        });

  await enqueueUpload({
    jobId: snapshot.jobId,
    formType,
    fileName: built.fileName,
    jobLabel: `${values.customerName || snapshot.name} · ${values.date}`,
    bytes: built.bytes,
  });

  toast.success(
    online ? "Uploading to the job…" : "Saved — it'll upload when you're back online",
  );
}

function ServiceSheetHost({ snapshot, technicianName, online, onDone }: HostInner) {
  const form = useServiceSheetForm({
    job: snapshot,
    technicianName,
    onSubmit: async (values) => {
      const photos = await toPdfPhotos(form.photos);
      await submit("service", snapshot, photos, values, online);
    },
    onSaved: onDone,
  });

  return (
    <FormChrome
      title="Service Sheet"
      subtitle={snapshot.name}
      online={online}
      saving={form.saving}
      saveError={form.saveError}
      hydrated={form.hydrated}
      resumedAt={form.resumedAt}
      onSave={form.handleSave}
      onStartFresh={() => void discardDraft("service", snapshot.jobId).then(() => location.reload())}
    >
      <ServiceSheetFormFields {...form} />
    </FormChrome>
  );
}

function InstallChecklistHost({ snapshot, technicianName, online, onDone }: HostInner) {
  const form = useInstallChecklistForm({
    job: snapshot,
    technicianName,
    onSubmit: async (values, selectedProducts) => {
      const photos = await toPdfPhotos(form.photos);
      await submit("install", snapshot, photos, values, online, selectedProducts);
    },
    onSaved: onDone,
  });

  return (
    <FormChrome
      title="Install Checklist"
      subtitle={snapshot.name}
      online={online}
      saving={form.saving}
      saveError={form.saveError}
      hydrated={form.hydrated}
      resumedAt={form.resumedAt}
      onSave={form.handleSave}
      onStartFresh={() => void discardDraft("install", snapshot.jobId).then(() => location.reload())}
    >
      <InstallChecklistFormFields {...form} />
    </FormChrome>
  );
}

async function toPdfPhotos(
  photos: Array<{ bytes: ArrayBuffer; mime: string; width: number; height: number; caption: string }>,
): Promise<PdfPhoto[]> {
  const out: PdfPhoto[] = [];
  for (const p of photos) {
    out.push({
      dataUrl: await photoDataUrl(p),
      caption: p.caption,
      width: p.width,
      height: p.height,
    });
  }
  return out;
}

type ChromeProps = {
  title: string;
  subtitle: string;
  online: boolean;
  saving: boolean;
  saveError: string | null;
  hydrated: boolean;
  resumedAt: string | null;
  onSave: () => void;
  onStartFresh: () => void;
  children: React.ReactNode;
};

function FormChrome({
  title,
  subtitle,
  online,
  saving,
  saveError,
  hydrated,
  resumedAt,
  onSave,
  onStartFresh,
  children,
}: ChromeProps) {
  // Jobs here are often recurring, so a stale draft from the previous visit to
  // the same address would quietly poison a new form. Ask rather than resume.
  const [askResume, setAskResume] = useState(false);
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (hydrated && resumedAt && !asked) {
      setAskResume(true);
      setAsked(true);
    }
  }, [hydrated, resumedAt, asked]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plans">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {!online && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <CloudOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {hydrated ? (
          children
        ) : (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading draft…
          </div>
        )}

        {saveError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <p className="flex-1 text-xs text-muted-foreground">
            {online ? "Draft saves automatically" : "Saved on this device — will upload later"}
          </p>
          <Button onClick={onSave} disabled={saving || !hydrated}>
            {saving ? "Saving…" : "Complete & upload PDF"}
          </Button>
        </div>
      </div>

      <AlertDialog open={askResume} onOpenChange={setAskResume}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume your unfinished form?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unfinished {title.toLowerCase()} for this job, saved{" "}
              {resumedAt ? new Date(resumedAt).toLocaleString() : "earlier"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onStartFresh}>Start fresh</AlertDialogCancel>
            <AlertDialogAction onClick={() => setAskResume(false)}>Resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
