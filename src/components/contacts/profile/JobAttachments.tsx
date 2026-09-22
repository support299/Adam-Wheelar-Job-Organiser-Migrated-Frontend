import { ExternalLink, Paperclip } from "lucide-react";
import { Section } from "@/components/jobs/formLayout";
import { useListJobAttachmentsQuery } from "@/api/jobAttachmentsApi";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Per-job list of uploaded files, rendered inline in the contact-profile job editor. */
export function JobAttachments({ jobId }: { jobId: string }) {
  const { data: attachments = [], isLoading, isError } = useListJobAttachmentsQuery(jobId);

  return (
    <Section title="Attachments">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load attachments.</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm italic text-muted-foreground/70">No attachments</p>
      ) : (
        <ul className="space-y-2">
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
