import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, MapPin, Mail, Phone, ChevronRight } from "lucide-react";
import type { Job } from "@/api/types";
import { useListJobsQuery } from "@/api/jobsApi";

export type ContactGroup = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  emails: string[];
  phones: string[];
  jobs: Job[];
  locationCount: number;
  lastServiceDate: string;
};

// eslint-disable-next-line react-refresh/only-export-components
export function groupJobsByContact(jobs: Job[]): ContactGroup[] {
  const norm = (s: string | null | undefined) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, "");

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) { parent.set(x, x); return x; }
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const jobKeys = new Map<string, string>();
  for (const j of jobs) {
    const e = norm(j.email);
    const p = norm(j.phone);
    const tokens: string[] = [];
    if (e) tokens.push("e:" + e);
    if (p) tokens.push("p:" + p);
    if (tokens.length === 0) tokens.push("j:" + j.id);
    tokens.forEach((t) => find(t));
    for (let i = 1; i < tokens.length; i++) union(tokens[0], tokens[i]);
    jobKeys.set(j.id, tokens[0]);
  }

  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const root = find(jobKeys.get(j.id)!);
    const arr = groups.get(root) ?? [];
    arr.push(j);
    groups.set(root, arr);
  }

  const result: ContactGroup[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => b.service_date.localeCompare(a.service_date));
    const emails = Array.from(new Set(list.map((j) => j.email).filter((x): x is string => !!x && x.trim() !== "")));
    const phones = Array.from(new Set(list.map((j) => j.phone).filter((x): x is string => !!x && x.trim() !== "")));
    const locationCount = new Set(list.map((j) => j.address.trim().toLowerCase())).size;
    result.push({
      key,
      name: list[0].name,
      email: emails[0] ?? null,
      phone: phones[0] ?? null,
      emails,
      phones,
      jobs: list,
      locationCount,
      lastServiceDate: list[0].service_date,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

// eslint-disable-next-line react-refresh/only-export-components
export function contactIdFromKey(key: string): string {
  return encodeURIComponent(key);
}

// Derive the canonical contact_key for a single job, matching the
// union-find rooting used in groupJobsByContact.
// eslint-disable-next-line react-refresh/only-export-components
export function contactKeyForJob(j: {
  id: string;
  email: string | null;
  phone: string | null;
}): string {
  const norm = (s: string | null | undefined) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const p = norm(j.phone);
  if (p) return "p:" + p;
  const e = norm(j.email);
  if (e) return "e:" + e;
  return "j:" + j.id;
}

export function ContactsListPage() {
  const { data: jobs = [], isLoading } = useListJobsQuery();
  const [search, setSearch] = useState("");

  const contacts = useMemo(() => groupJobsByContact(jobs), [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.emails.some((e) => e.toLowerCase().includes(q)) ||
        c.phones.some((p) => p.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Job History</h1>
            <p className="text-xs text-muted-foreground">Browse contacts and their past sales & services</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">No contacts yet.</Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((c) => (
              <Link key={c.key} to={`/contacts/${contactIdFromKey(c.key)}`}>
                <Card className="p-3 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.name}</span>
                      <Badge variant="secondary">{c.jobs.length} sale{c.jobs.length === 1 ? "" : "s"}</Badge>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" /> {c.locationCount} location{c.locationCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                      {c.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
