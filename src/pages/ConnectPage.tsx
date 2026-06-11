import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useGetGhlStatusQuery, useRefreshGhlTokenMutation, useSyncGhlContactsMutation } from "@/api/ghlApi";
import type { GhlTokenStatus } from "@/api/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const AUTHORIZE_URL = `${API_BASE.replace(/\/api$/, "")}/api/oauth/authorize/`;
const REDIRECT_URI_DISPLAY = `${API_BASE.replace(/\/api$/, "")}/api/oauth/callback/`;

export function ConnectPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useGetGhlStatusQuery();
  const [refreshToken, { isLoading: refreshing }] = useRefreshGhlTokenMutation();
  const [syncContacts, { isLoading: syncing }] = useSyncGhlContactsMutation();
  const toastedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke
    if (toastedRef.current) return;
    const ghl = searchParams.get("ghl");
    if (!ghl) return;
    toastedRef.current = true;
    if (ghl === "success") {
      toast.success("GoHighLevel connected successfully.");
      void refetchStatus();
    } else {
      const msg = searchParams.get("msg") ?? "OAuth exchange failed.";
      toast.error(`Connection failed: ${msg}`);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, refetchStatus]);

  async function handleRefresh() {
    try {
      await refreshToken().unwrap();
      toast.success("Tokens refreshed.");
      void refetchStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
  }

  async function handleSyncContacts() {
    try {
      const { synced } = await syncContacts().unwrap();
      toast.success(`Synced ${synced} contacts from GoHighLevel.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Contact sync failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GoHighLevel Connection</h1>
            <p className="text-xs text-muted-foreground">Hidden admin page for managing the System OAuth connection.</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Install</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Redirect URI — register this in your GHL Marketplace app
              </label>
              <Input value={REDIRECT_URI_DISPLAY} readOnly className="font-mono text-xs" />
            </div>
            <Button asChild>
              <a href={AUTHORIZE_URL}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Install / Reauthorize
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Clicking the button redirects your browser to GoHighLevel to authorize access, then
              returns here automatically.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {statusLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <TokenRow label="Company token" row={status?.company ?? null} />
                <TokenRow label="Location token" row={status?.location ?? null} />
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={refreshing || !status?.company}
                  >
                    {refreshing ? "Refreshing…" : "Refresh tokens"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSyncContacts}
                    disabled={syncing || !status?.location}
                  >
                    {syncing ? "Syncing…" : "Sync contacts"}
                  </Button>
                  <Button variant="ghost" onClick={() => void refetchStatus()} disabled={refreshing}>
                    Reload
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

type TokenRowType = NonNullable<GhlTokenStatus["company"]>;

function TokenRow({ label, row }: { label: string; row: TokenRowType | null }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        {row
          ? <Badge variant="secondary">{row.user_type ?? "—"}</Badge>
          : <Badge variant="outline">Not connected</Badge>
        }
      </div>
      {row && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>Expires</dt><dd className="font-mono">{new Date(row.expires_at).toLocaleString()}</dd>
          <dt>Updated</dt><dd className="font-mono">{new Date(row.updated_at).toLocaleString()}</dd>
          <dt>Company ID</dt><dd className="font-mono break-all">{row.company_id ?? "—"}</dd>
          <dt>Location ID</dt><dd className="font-mono break-all">{row.location_id ?? "—"}</dd>
          <dt className="col-span-2">Scopes</dt>
          <dd className="col-span-2 break-all">{row.scope ?? "—"}</dd>
        </dl>
      )}
    </div>
  );
}
