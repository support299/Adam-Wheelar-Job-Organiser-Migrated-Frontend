import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getOutboxItems } from "@/db/dexie";
import { discardItem, downloadItem, retryAll, retryItem } from "@/lib/fieldForms/outbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Field forms still waiting to reach the server. Hidden when the queue is empty,
 * which is almost always — it only appears when a tech submitted with no signal.
 *
 * Deliberately a spinner, not a progress bar: fetch exposes no upload progress,
 * and a bar that isn't tracking anything is a lie the user will catch on a slow
 * connection.
 */
export function PendingUploadsCard() {
  const items = useLiveQuery(getOutboxItems, [], []);
  if (items.length === 0) return null;

  const waiting = items.filter((i) => i.status !== "blocked");
  const blocked = items.filter((i) => i.status === "blocked");

  /**
   * A retry with no connection would fail at flushOutbox's navigator.onLine
   * guard and look like the button did nothing. Say so instead.
   */
  const guardedRetry = async (run: () => Promise<void>) => {
    if (!navigator.onLine) {
      toast.error("Still offline — these will send themselves once you have signal");
      return;
    }
    await run();
  };

  return (
    <Card className="mb-4 border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="space-y-3 p-4">
        {waiting.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">
              {waiting.length} form{waiting.length === 1 ? "" : "s"} waiting to upload — they'll
              send automatically when you're back online.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => void guardedRetry(retryAll)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry now
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs"
            >
              {item.status === "uploading" && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className="font-medium">
                {item.formType === "service" ? "Service Sheet" : "Install Checklist"}
              </span>
              <span className="truncate text-muted-foreground">{item.jobLabel}</span>

              {item.status === "blocked" ? (
                <Badge variant="destructive" className="ml-auto">
                  {item.lastError ?? "Failed"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto capitalize">
                  {item.status}
                </Badge>
              )}

              {item.status === "blocked" && (
                <div className="flex w-full gap-1.5 sm:w-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void guardedRetry(() => retryItem(item.id))}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void downloadItem(item.id)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Download PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (confirm("Discard this form? The PDF will be lost.")) {
                        void discardItem(item.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {blocked.length > 0 && (
          <p className="text-xs text-muted-foreground">
            A blocked form won't retry on its own. Download the PDF and attach it to the job by
            hand if it keeps failing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
