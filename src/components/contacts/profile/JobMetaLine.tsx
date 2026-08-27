import { cn } from "@/lib/utils";
import { STATUS_LABELS, SERVICE_TYPE_LABELS, statusDotClass } from "@/components/contacts/profile/jobMeta";

/**
 * One compact line replacing the old status + service-type badges: a coloured
 * status dot, a plain-language status word, then the service type.
 */
export function JobMetaLine({
  status,
  serviceType,
  paymentStatus,
  className,
}: {
  status: string;
  serviceType: string;
  paymentStatus?: string | null;
  className?: string;
}) {
  const unpaid = paymentStatus === "unpaid";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotClass(status))} />
      <span className="text-foreground font-medium">{STATUS_LABELS[status] ?? status}</span>
      <span aria-hidden>·</span>
      <span>{SERVICE_TYPE_LABELS[serviceType] ?? serviceType}</span>
      {paymentStatus && (
        <>
          <span aria-hidden>·</span>
          <span className={cn("font-medium", unpaid ? "text-rose-600" : "text-emerald-600")}>
            {unpaid ? "Unpaid" : "Paid"}
          </span>
        </>
      )}
    </span>
  );
}
