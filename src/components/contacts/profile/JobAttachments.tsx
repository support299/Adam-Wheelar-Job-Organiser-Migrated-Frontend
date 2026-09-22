import { useRef, useState } from "react";
import { ExternalLink, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/jobs/formLayout";
import { useListJobAttachmentsQuery, useUploadJobAttachmentMutation } from "@/api/jobAttachmentsApi";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Per-job list of uploaded files, with an upload control, rendered inline in
 * the contact-profile job editor. */
export function JobAttachments({ jobId }: { jobId: string }) {
  const { data: attachments = [], isLoading, isError } = useListJobAttachmentsQuery(jobId);
  const [uploadAttachment, { isLoading: isUploading }] = useUploadJobAttachmentMutation();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setPendingName(file.name);
    try {
      await uploadAttachment({ job: jobId, file }).unwrap();
      toast.success("Attachment uploaded");
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { detail?: string } }).data?.detail
          : undefined;
      toast.error(detail || "Failed to upload attachment");
    } finally {
      setPendingName(null);
    }
  }

  return (
    <Section
      title="Attachments"
      action={
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChosen}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load attachments.</p>
      ) : attachments.length === 0 && !pendingName ? (
        <p className="text-sm italic text-muted-foreground/70">No attachments</p>
      ) : (
        <ul className="space-y-2">
          {pendingName && (
            <li className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="min-w-0 flex-1 truncate">Uploading {pendingName}…</span>
            </li>
          )}
          {attachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{a.name || a.url}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
