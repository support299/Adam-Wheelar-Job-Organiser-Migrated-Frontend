import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/fieldForms/imageCompress";
import { addPhoto, photoBlob, removePhoto, setPhotoCaption } from "@/lib/fieldForms/draftStore";
import type { FieldFormPhoto } from "@/lib/fieldForms/types";

/**
 * Camera + library photo capture, compressed on device and held in Dexie until
 * the PDF is built.
 *
 * Two inputs, not one: `capture` and `multiple` conflict on iOS — `capture`
 * forces the camera and silently drops multi-select — so the camera and the
 * library get a button each.
 */

const MAX_PHOTOS = 8;

type Props = {
  draftId: string;
  photos: FieldFormPhoto[];
  slotId?: string | null;
  disabled?: boolean;
};

export function PhotoCapture({ draftId, photos, slotId = null, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Object URLs are revoked when the photo set changes; leaking these across a
  // long form session is a slow leak on a device already short on memory.
  const previews = useMemo(
    () => photos.map((p) => ({ id: p.id, url: URL.createObjectURL(photoBlob(p)) })),
    [photos],
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos per form`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more photo${room === 1 ? "" : "s"} will fit — added the first ${room}`);
    }

    setBusy(true);
    try {
      // Strictly sequential: a 12MP decode is ~48MB of RGBA, and processing
      // these in parallel will kill the tab on an older phone.
      for (const file of files.slice(0, room)) {
        try {
          const img = await compressImage(file);
          await addPhoto({
            draftId,
            slotId,
            mime: img.mime,
            bytes: img.bytes,
            width: img.width,
            height: img.height,
            caption: "",
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Couldn't add ${file.name}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div className="grid gap-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFiles}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || full}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-1.5 h-4 w-4" />
          )}
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || full}
          onClick={() => libraryRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" />
          Add from library
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {photos.length} / {MAX_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <div key={photo.id} className="grid gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
                <img
                  src={previews[i]?.url}
                  alt={photo.caption || "Site photo"}
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 rounded-full bg-background/80 hover:bg-background"
                  disabled={disabled}
                  onClick={() => void removePhoto(photo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={photo.caption}
                onChange={(e) => void setPhotoCaption(photo.id, e.target.value)}
                placeholder="Caption"
                className="h-8 text-xs"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
