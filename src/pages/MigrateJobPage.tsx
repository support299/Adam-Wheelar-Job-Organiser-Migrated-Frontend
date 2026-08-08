import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useListStaffQuery } from "@/api/staffApi";
import { useListProductsQuery } from "@/api/productsApi";
import { useCreateJobMutation } from "@/api/jobsApi";
import { useJobForm } from "@/components/jobs/useJobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";
import { parseMigrationPrefill, type ParsedMigrationPrefill } from "@/lib/jobPrefill";
import type { Job, JobInsert, JobProductLine } from "@/api/types";

export function MigrateJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: staff = [], isLoading: staffLoading } = useListStaffQuery();
  const { data: products = [], isLoading: productsLoading } = useListProductsQuery();
  const [createJob] = useCreateJobMutation();

  const [parsed, setParsed] = useState<ParsedMigrationPrefill | null>(null);
  const parsedOnce = useRef(false);
  useEffect(() => {
    if (parsedOnce.current || staffLoading || productsLoading) return;
    parsedOnce.current = true;
    setParsed(parseMigrationPrefill(searchParams, staff, products));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffLoading, productsLoading]);

  const [saved, setSaved] = useState<Job | null>(null);

  async function handleSubmit(
    data: JobInsert,
    extras: { staffIds: string[]; lineItems: JobProductLine[] },
  ) {
    const created = await createJob({
      ...data,
      staff_ids: extras.staffIds,
      product_lines: extras.lineItems,
    }).unwrap();
    setSaved(created);
  }

  // Migrated CSV rows default to a one-time job, unlike the normal "Enter New
  // Job" modal (which defaults to recurring). A `is_recurring` URL param, if
  // present, still overrides this. Memoized so the object reference stays
  // stable across renders — useJobForm's effect depends on it by reference.
  const initialValues = useMemo(
    () => (parsed ? { is_recurring: false, ...parsed.values } : undefined),
    [parsed],
  );

  const jobForm = useJobForm({
    open: true,
    job: null,
    initialValues,
    initialStaffIds: parsed?.staffIds,
    initialLineItems: parsed?.lineItems,
    initialContactSearchTerm: parsed?.contactSearchTerm,
    migrationMode: true,
    onSubmit: handleSubmit,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Migrate Job</h1>
            <p className="text-xs text-muted-foreground">
              URL-driven job entry for the historical CSV migration. One page load per row.
            </p>
          </div>
          {!saved && parsed && (
            <Button onClick={jobForm.handleSave} disabled={jobForm.saving}>
              {jobForm.saving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {(staffLoading || productsLoading || !parsed) && (
          <p className="text-sm text-muted-foreground">Loading staff &amp; products…</p>
        )}

        {parsed && parsed.warnings.length > 0 && (
          <div className="rounded-md border border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-1">Some values from the URL could not be matched:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {parsed.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {saved ? (
          <Card>
            <CardContent className="pt-6 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Job created for {saved.name}</p>
                <p className="text-sm text-muted-foreground">
                  {saved.service_date} at {saved.service_time} — {saved.address}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can close this tab or open the next URL in your batch.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          parsed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enter New Job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <JobFormFields
                  {...jobForm}
                  job={null}
                  initialContactSearchTerm={parsed.contactSearchTerm}
                  showCompletedAtField
                  migrationMode
                />
                {jobForm.saveError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {jobForm.saveError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => navigate("/")}>Cancel</Button>
                  <Button onClick={jobForm.handleSave} disabled={jobForm.saving}>
                    {jobForm.saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </main>
    </div>
  );
}
