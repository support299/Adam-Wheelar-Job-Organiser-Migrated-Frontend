import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Finger/stylus signature capture on a canvas.
 *
 * The fiddly bits, all of which are bugs if removed:
 * - `touch-none` — without it iOS scrolls the page instead of drawing.
 * - setPointerCapture — a stroke that leaves the box keeps tracking.
 * - DPR transform — otherwise the ink lands offset from the finger on retina.
 * - ResizeObserver redraw — setting canvas.width clears the bitmap, so a rotate
 *   or a layout shift would wipe a signature that's already been given.
 * - The dashed baseline is a CSS sibling *behind* a transparent canvas. Stroking
 *   it onto the canvas would bake it into the exported PNG and then the PDF.
 * - Export composites onto white, so a viewer that renders alpha oddly doesn't
 *   show a black smear.
 */

const PAD_HEIGHT = 150;
// Literal hex, not var(--foreground): the theme tokens are oklch() and
// ctx.strokeStyle handling of those is inconsistent across mobile browsers.
const INK = "#0f172a";

type Props = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
  disabled?: boolean;
};

export function SignaturePad({ label, value, onChange, required, disabled }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  // Last exported image, used to repaint after a resize clears the bitmap.
  const lastRef = useRef<string | null>(value);
  const widthRef = useRef(0);
  const [hasInk, setHasInk] = useState(Boolean(value));

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }, []);

  /** Size the bitmap to the device pixel grid and restore any existing ink. */
  const layout = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const cssWidth = wrap.clientWidth;
    if (cssWidth === 0 || cssWidth === widthRef.current) return;
    widthRef.current = cssWidth;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(PAD_HEIGHT * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${PAD_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;

    const previous = lastRef.current;
    if (previous) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssWidth, PAD_HEIGHT);
      img.src = previous;
    }
  }, []);

  useEffect(() => {
    layout();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => layout());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [layout]);

  // Hydrate when a saved draft loads after mount.
  useEffect(() => {
    if (value === lastRef.current) return;
    lastRef.current = value;
    hasInkRef.current = Boolean(value);
    setHasInk(Boolean(value));

    const ctx = context();
    const cssWidth = widthRef.current;
    if (!ctx || cssWidth === 0) return;
    ctx.clearRect(0, 0, cssWidth, PAD_HEIGHT);
    if (!value) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, cssWidth, PAD_HEIGHT);
    img.src = value;
  }, [value, context]);

  function pointIn(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const ctx = context();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointIn(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap with no drag should still leave a mark.
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = context();
    if (!ctx) return;
    const { x, y } = pointIn(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInkRef.current = true;
  }

  /** Flatten onto white and hand the PNG up. Called on pointer up, not on move. */
  function commit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    const dataUrl = out.toDataURL("image/png");
    out.width = 0;
    out.height = 0;
    lastRef.current = dataUrl;
    setHasInk(true);
    onChange(dataUrl);
  }

  function handleUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (hasInkRef.current) commit();
  }

  function clear() {
    const ctx = context();
    if (ctx) ctx.clearRect(0, 0, widthRef.current, PAD_HEIGHT);
    drawingRef.current = false;
    hasInkRef.current = false;
    lastRef.current = null;
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">✱</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={clear}
          disabled={disabled || !hasInk}
        >
          Clear
        </Button>
      </div>

      <div
        ref={wrapRef}
        className={cn(
          "relative w-full overflow-hidden rounded-md border bg-background",
          disabled && "opacity-60",
        )}
        style={{ height: PAD_HEIGHT }}
      >
        <div className="pointer-events-none absolute inset-x-4 bottom-8 border-b border-dashed border-muted-foreground/50" />
        <span className="pointer-events-none absolute bottom-[22px] left-4 text-sm text-muted-foreground">
          ×
        </span>
        <canvas
          ref={canvasRef}
          className="relative touch-none"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
        />
      </div>
    </div>
  );
}
