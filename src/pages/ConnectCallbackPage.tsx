import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExchangeGhlCodeMutation } from "@/api/ghlApi";

export function ConnectCallbackPage() {
  const navigate = useNavigate();
  const [exchangeCode] = useExchangeGhlCodeMutation();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Exchanging authorization code…");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) {
      setState("error");
      setMessage(`GoHighLevel returned an error: ${errorParam}`);
      return;
    }
    if (!code) {
      setState("error");
      setMessage("Missing ?code in callback URL.");
      return;
    }

    const redirectUri = `${window.location.origin}/connect/callback`;
    exchangeCode({ code, redirect_uri: redirectUri })
      .unwrap()
      .then(() => {
        setState("ok");
        setMessage("Connected successfully. Redirecting…");
        setTimeout(() => navigate("/connect"), 1200);
      })
      .catch((e: unknown) => {
        setState("error");
        const detail = (e as { data?: { detail?: string } })?.data?.detail;
        setMessage(detail ?? (e instanceof Error ? e.message : "Token exchange failed."));
      });
  }, [exchangeCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>GoHighLevel Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={state === "error" ? "text-destructive" : "text-muted-foreground"}>
            {message}
          </p>
          {state === "working" && (
            <div className="flex justify-center py-2">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
          {state === "error" && (
            <Button asChild variant="outline">
              <Link to="/connect">Back to System Settings</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
