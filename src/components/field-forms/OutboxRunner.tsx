import { useEffect } from "react";
import { toast } from "sonner";
import { flushOutbox, setUploadListener } from "@/lib/fieldForms/outbox";

/**
 * Owns every trigger that drains the field-form upload queue. Mounted once in
 * App.tsx; renders nothing.
 *
 * The `online` listener is not optional: RTK Query's refetchOnReconnect only
 * re-runs queries, never mutations, so nothing else would ever push a queued
 * form. `visibilitychange` covers the phone waking with the connection already
 * restored, which fires no `online` event at all.
 */
export function OutboxRunner() {
  useEffect(() => {
    setUploadListener((item) => {
      toast.success(
        item.formType === "service" ? "Service Sheet uploaded" : "Install Checklist uploaded",
        { description: item.jobLabel },
      );
    });

    // An install-to-home-screen PWA gets storage that Safari won't evict after
    // a week of disuse. Worth asking for when the drafts are the only copy.
    void navigator.storage?.persist?.().catch(() => undefined);

    void flushOutbox();

    const onOnline = () => void flushOutbox();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flushOutbox();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      setUploadListener(null);
    };
  }, []);

  return null;
}
