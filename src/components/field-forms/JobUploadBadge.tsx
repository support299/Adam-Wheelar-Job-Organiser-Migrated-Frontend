import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, Loader2 } from "lucide-react";
import { db } from "@/db/dexie";
import { Badge } from "@/components/ui/badge";

/**
 * Shows, on a job row, that a completed field form for THIS job is still
 * waiting to reach the server — so a technician looking at the job sees it in
 * context, not only in the summary card at the top of the Plans page.
 *
 * Renders nothing when the job has nothing queued, which is the normal case.
 */
export function JobUploadBadge({ jobId }: { jobId: string }) {
  const items = useLiveQuery(
    () => db.fieldFormOutbox.where("jobId").equals(jobId).toArray(),
    [jobId],
    [],
  );
  if (items.length === 0) return null;

  const blocked = items.find((i) => i.status === "blocked");
  const uploading = items.some((i) => i.status === "uploading");

  if (blocked) {
    return (
      <Badge variant="destructive" className="gap-1">
        <CloudOff className="h-3 w-3" />
        Upload failed
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      {uploading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      {uploading
        ? "Uploading form…"
        : `${items.length} form${items.length === 1 ? "" : "s"} pending`}
    </Badge>
  );
}
