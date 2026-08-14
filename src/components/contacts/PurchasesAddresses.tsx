import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Trash2 } from "lucide-react";
import {
  getDueTag,
  getDueTagLabel,
  daysUntil,
  type DueTag,
  FREQUENCY_LABELS,
  type RecurrenceFrequency,
} from "@/lib/jobs";
import type { Job, PurchaseHistoryRow } from "@/api/types";

function dueTagBadgeClass(t: DueTag) {
  switch (t) {
    case "overdue": return "bg-red-500/15 text-red-700 border-red-500/30";
    case "due_7": return "bg-orange-500/15 text-orange-700 border-orange-500/30";
    case "due_15": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "due_30": return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "due_60": return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  }
}

type Props = {
  jobs: Job[];
  purchaseHistory: PurchaseHistoryRow[];
  onDeleteAddress: (address: string) => void;
};

export function PurchasesAddresses({ jobs, purchaseHistory, onDeleteAddress }: Props) {
  const allAddresses = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of jobs) {
      const a = j.address.trim();
      if (a) map.set(a, (map.get(a) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count);
  }, [jobs]);

  const purchaseTotal = purchaseHistory.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">All addresses</h2>
          <Badge variant="secondary">{allAddresses.length}</Badge>
        </div>
        {allAddresses.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No addresses on record.</Card>
        ) : (
          <div className="grid gap-2">
            {allAddresses.map((a) => (
              <Card key={a.address} className="p-3 flex items-start justify-between gap-3">
                <div className="text-sm">{a.address}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{a.count} record{a.count === 1 ? "" : "s"}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteAddress(a.address)} aria-label="Delete address">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Purchase history</h2>
          <Badge variant="secondary">{purchaseHistory.length}</Badge>
          {purchaseHistory.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              Total: <strong className="text-foreground">${purchaseTotal.toFixed(2)}</strong>
            </span>
          )}
        </div>
        {purchaseHistory.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No purchases recorded yet.</Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-left font-medium px-3 py-2">Product</th>
                    <th className="text-left font-medium px-3 py-2">Address</th>
                    <th className="text-right font-medium px-3 py-2">Qty</th>
                    <th className="text-right font-medium px-3 py-2">Unit</th>
                    <th className="text-right font-medium px-3 py-2">Total</th>
                    <th className="text-left font-medium px-3 py-2">Next service</th>
                    <th className="text-left font-medium px-3 py-2">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseHistory.map((r) => {
                    const dateLabel = new Date(
                      r.install_date + "T00:00:00",
                    ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

                    const nextDateLabel = r.next_service_date
                      ? new Date(r.next_service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : null;

                    const installDays = daysUntil(r.install_date);
                    const s = r.install_status;

                    // Pending/scheduled/rescheduled install → show install due tag
                    const showInstallTag = s === "pending" || s === "scheduled" || s === "rescheduled";
                    const installTag: DueTag | null = showInstallTag
                      ? getDueTag({ service_date: r.install_date, status: s })
                      : null;

                    // Next service tag — shown when install is done or skipped
                    const showServiceTag = s === "completed" || s === "skip";
                    const dueTag: DueTag | null = showServiceTag && r.next_service_date && r.next_service_status
                      ? getDueTag({ service_date: r.next_service_date, status: r.next_service_status })
                      : null;
                    const daysLeft = r.next_service_date ? daysUntil(r.next_service_date) : undefined;

                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{dateLabel}</td>
                        <td className="px-3 py-2">{r.product_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.address}</td>
                        <td className="px-3 py-2 text-right">{r.quantity}</td>
                        <td className="px-3 py-2 text-right">${Number(r.unit_price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">${Number(r.total).toFixed(2)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{nextDateLabel ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {s === "not_interested" ? (
                              <Badge variant="outline" className="bg-rose-500/15 text-rose-700 border-rose-500/30">
                                Not Interested Anymore
                              </Badge>
                            ) : showInstallTag ? (
                              installTag ? (
                                <Badge variant="outline" className={dueTagBadgeClass(installTag)}>
                                  {getDueTagLabel(installTag, "installation", installDays)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Install: {dateLabel}</span>
                              )
                            ) : r.service_complete ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                Service complete
                              </Badge>
                            ) : (
                              <>
                                {r.is_recurring && r.frequency && (
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                    {FREQUENCY_LABELS[r.frequency as RecurrenceFrequency]}
                                  </Badge>
                                )}
                                {dueTag ? (
                                  <Badge variant="outline" className={dueTagBadgeClass(dueTag)}>
                                    {getDueTagLabel(dueTag, "servicing", daysLeft)}
                                  </Badge>
                                ) : nextDateLabel ? (
                                  <span className="text-xs text-muted-foreground">{nextDateLabel}</span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
