import { useEffect, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials, clearCredentials, REFRESH_KEY } from "@/store/authSlice";
import type { RootState } from "@/store/store";
import { useLoginMutation } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const IFRAME_SECRET = import.meta.env.VITE_IFRAME_SECRET ?? "";

function isIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

type Props = { children: ReactNode };

export function AccessGate({ children }: Props) {
  const dispatch = useDispatch();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);

  const [status, setStatus] = useState<"checking" | "authed" | "login">(() => {
    // If a token is already stored, go straight to authed for both iframe and normal
    if (localStorage.getItem("rdp_access")) return "authed";
    return "checking";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [login, { isLoading }] = useLoginMutation();

  // When RTK Query's 401 handler clears credentials, re-check:
  // - iframe: silently re-fetch a new token
  // - normal: drop to login screen
  useEffect(() => {
    if (!accessToken && status === "authed") {
      if (isIframe()) {
        setStatus("checking");
      } else {
        setStatus("login");
      }
    }
  }, [accessToken, status]);

  // First-time load with no stored token
  useEffect(() => {
    if (status !== "checking") return;

    if (isIframe()) {
      // Auto-login silently using the shared iframe secret
      if (!IFRAME_SECRET) { setStatus("login"); return; }
      fetch(`${API_BASE}/auth/iframe-token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: IFRAME_SECRET }),
      })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json() as { access: string; refresh: string };
            dispatch(setCredentials({ accessToken: data.access, refreshToken: data.refresh }));
            setStatus("authed");
          } else {
            setStatus("login");
          }
        })
        .catch(() => setStatus("login"));
      return;
    }

    // Normal flow: try stored refresh token
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) { setStatus("login"); return; }

    fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json() as { access?: string };
          if (data.access) {
            dispatch(setCredentials({ accessToken: data.access }));
            setStatus("authed");
          } else {
            dispatch(clearCredentials());
            setStatus("login");
          }
        } else {
          dispatch(clearCredentials());
          setStatus("login");
        }
      })
      .catch(() => { dispatch(clearCredentials()); setStatus("login"); });
  }, [dispatch, status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login({ email, password }).unwrap();
      dispatch(setCredentials({ accessToken: result.access, refreshToken: result.refresh }));
      setStatus("authed");
    } catch {
      setError("Invalid email or password.");
    }
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "authed") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Route Day Plan</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
