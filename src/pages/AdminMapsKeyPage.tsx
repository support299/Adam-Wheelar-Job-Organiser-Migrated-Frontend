import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DEFAULT_GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_API_KEY_STORAGE_KEY,
} from "@/lib/maps-config";

export function AdminMapsKeyPage() {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(GOOGLE_MAPS_API_KEY_STORAGE_KEY);
    setOverride(stored);
    setValue(stored ?? DEFAULT_GOOGLE_MAPS_API_KEY);
  }, []);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("API key cannot be empty");
      return;
    }
    window.localStorage.setItem(GOOGLE_MAPS_API_KEY_STORAGE_KEY, trimmed);
    setOverride(trimmed);
    toast.success("Saved. Reloading to apply…");
    setTimeout(() => window.location.reload(), 600);
  };

  const reset = () => {
    window.localStorage.removeItem(GOOGLE_MAPS_API_KEY_STORAGE_KEY);
    setOverride(null);
    setValue(DEFAULT_GOOGLE_MAPS_API_KEY);
    toast.success("Reset to default. Reloading…");
    setTimeout(() => window.location.reload(), 600);
  };

  const active = override ?? DEFAULT_GOOGLE_MAPS_API_KEY;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google Maps API Key</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hidden admin page. Stored locally in this browser only.
        </p>
      </div>

      <Card className="p-4 space-y-2">
        <Label className="text-xs text-muted-foreground">Currently active key</Label>
        <div className="font-mono text-sm break-all">
          {show ? active : active.replace(/.(?=.{4})/g, "•")}
        </div>
        <div className="text-xs text-muted-foreground">
          Source: {override ? "Local override" : "Default (from env)"}
        </div>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="key">New API key</Label>
        <Input
          id="key"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AIza..."
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Show key
        </label>
      </div>

      <div className="flex gap-2">
        <Button onClick={save}>Save & reload</Button>
        <Button variant="outline" onClick={reset}>Reset to default</Button>
      </div>
    </div>
  );
}
