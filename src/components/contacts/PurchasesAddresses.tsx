import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Trash2 } from "lucide-react";
import {
  getDueTag,
  DUE_TAG_LABELS,
  type DueTag,
  FREQUENCY_LABELS,
  type RecurrenceFrequency,
} from "@/lib/jobs";
import type { Job, JobCompletion, Product } from "@/api/types";

type JobProductRow = {
  job_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

function statusBadgeClass(s: string) {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "skip") return "bg-purple-500/15 text-purple-700 border-purple-500/30";
  if (s === "not_interested") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

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
  completions: JobCompletion[];
  jobProducts: Record<string, JobProductRow[]>;
  products: Product[];
  onDeleteAddress: (address: string) => void;
};

export function PurchasesAddresses({ jobs, completions, jobProducts, products, onDeleteAddress }: Props) {
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";

  const allAddresses = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of jobs) {
      const a = j.address.trim();
      if (a) map.set(a, (map.get(a) ?? 0) + 1);
    }
    for (const c of completions) {
      const a = c.address.trim();
      if (a) map.set(a, (map.get(a) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count);
  }, [jobs, completions]);

  const mostRecentJobByAddress = useMemo(() => {
    const map = new Map<string, Job>();
    for (const j of jobs) {
      const key = j.address.trim();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || j.service_date.localeCompare(prev.service_date) > 0) map.set(key, j);
    }
    return map;
  }, [jobs]);

  const statusByAddress = useMemo(() => {
    const map = new Map<string, { date: string; status: string }>();
    const consider = (address: string, date: string, status: string) => {
      const key = address.trim();
      if (!key) return;
      const prev = map.get(key);
      if (!prev || date.localeCompare(prev.date) > 0) map.set(key, { date, status });
    };
    for (const j of jobs) consider(j.address, j.service_date, j.status);
    for (const c of completions) consider(c.address, c.completed_at.slice(0, 10), "completed");
    return map;
  }, [jobs, completions]);

  type PurchaseRow = {
    key: string;
    date: string;
    source: "completion" | "job";
    address: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  };

  const purchaseHistory = useMemo<PurchaseRow[]>(() => {
    const rows: PurchaseRow[] = [];
    for (const c of completions) {
      const lines = (c.product_lines as unknown as JobProductRow[]) ?? [];
      lines.forEach((l, i) => {
        const qty = Number(l.quantity);
        const price = Number(l.unit_price);
        rows.push({ key: `c-${c.id}-${i}`, date: c.completed_at, source: "completion", address: c.address, productId: l.product_id, quantity: qty, unitPrice: price, total: qty * price });
      });
    }
    for (const j of jobs) {
      const lines = jobProducts[j.id] ?? [];
      lines.forEach((l, i) => {
        const qty = Number(l.quantity);
        const price = Number(l.unit_price);
        rows.push({ key: `j-${j.id}-${i}`, date: j.service_date, source: "job", address: j.address, productId: l.product_id, quantity: qty, unitPrice: price, total: qty * price });
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [jobs, completions, jobProducts]);

  const purchaseTotal = purchaseHistory.reduce((s, r) => s + r.total, 0);

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
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-left font-medium px-3 py-2">Next service</th>
                    <th className="text-left font-medium px-3 py-2">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseHistory.map((r) => {
                    const dateLabel = new Date(
                      r.source === "completion" ? r.date : r.date + "T00:00:00",
                    ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                    const addrKey = r.address.trim();
                    const status = statusByAddress.get(addrKey)?.status ?? (r.source === "completion" ? "completed" : "scheduled");
                    const recentJob = mostRecentJobByAddress.get(addrKey);
                    const nextDateLabel = recentJob
                      ? new Date(recentJob.service_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : null;
                    const dueTag = recentJob ? getDueTag(recentJob) : null;
                    return (
                      <tr key={r.key} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{dateLabel}</td>
                        <td className="px-3 py-2">{productName(r.productId)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.address}</td>
                        <td className="px-3 py-2 text-right">{r.quantity}</td>
                        <td className="px-3 py-2 text-right">${r.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">${r.total.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={statusBadgeClass(status)}>{status}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{nextDateLabel ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {recentJob?.is_recurring && recentJob.frequency && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {FREQUENCY_LABELS[recentJob.frequency as RecurrenceFrequency]}
                              </Badge>
                            )}
                            {dueTag && (
                              <Badge variant="outline" className={dueTagBadgeClass(dueTag)}>
                                {DUE_TAG_LABELS[dueTag]}
                              </Badge>
                            )}
                            {!recentJob?.is_recurring && !dueTag && <span className="text-xs text-muted-foreground">—</span>}
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
