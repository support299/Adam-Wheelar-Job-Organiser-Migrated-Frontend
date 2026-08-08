import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useJobForm } from "@/components/jobs/useJobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";
import type { Job, JobInsert, JobProductLine } from "@/api/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job?: Job | null;
  defaultGhlContactId?: string | null;
  defaultServiceType?: "installation" | "servicing";
  initialTab?: "details" | "activity";
  /** Overrides applied on top of the blank form when creating a new job (e.g. prefilled from URL params). */
  initialValues?: Partial<JobInsert>;
  initialStaffIds?: string[];
  initialLineItems?: JobProductLine[];
  initialContactSearchTerm?: string;
  /** Migration-only field, hidden unless explicitly requested. */
  showCompletedAtField?: boolean;
  onSubmit: (
    data: JobInsert,
    extras: { staffIds: string[]; lineItems: JobProductLine[] },
  ) => Promise<void>;
};

export function JobFormDialog({
  open,
  onOpenChange,
  job,
  defaultGhlContactId,
  defaultServiceType,
  initialTab,
  initialValues,
  initialStaffIds,
  initialLineItems,
  initialContactSearchTerm,
  showCompletedAtField,
  onSubmit,
}: Props) {
  const jobForm = useJobForm({
    open,
    job,
    defaultGhlContactId,
    defaultServiceType,
    initialTab,
    initialValues,
    initialStaffIds,
    initialLineItems,
    initialContactSearchTerm,
    onSubmit,
    onSaved: () => onOpenChange(false),
  });

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
        <JobFormFields
          {...jobForm}
          job={job}
          initialContactSearchTerm={initialContactSearchTerm}
          showCompletedAtField={showCompletedAtField}
        />
        {jobForm.saveError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {jobForm.saveError}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={jobForm.handleSave} disabled={jobForm.saving}>
            {jobForm.saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
