/**
 * Downscale a camera photo to something a PDF can carry over a van's 3G.
 *
 * Two things here are load-bearing:
 *
 * 1. EXIF orientation. A portrait photo from an iPhone rear camera arrives with
 *    orientation 6 — decoded naively it lands sideways in the PDF. Passing
 *    `imageOrientation: "from-image"` to createImageBitmap applies the rotation.
 *    The <img> fallback gets it for free, since browsers honour EXIF when
 *    rendering an image element.
 * 2. Memory. Decoding a 12MP photo costs ~48MB of RGBA. Callers must process
 *    photos one at a time; Promise.all over a multi-select is how an older phone
 *    silently kills the tab. Bitmaps and canvases are released here on every path.
 */

export type CompressedImage = {
  bytes: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
};

type Options = {
  maxEdge?: number;
  targetBytes?: number;
};

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_TARGET_BYTES = 350_000;
const START_QUALITY = 0.72;
const MIN_QUALITY = 0.5;
const MAX_PASSES = 3;

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Older Safari rejects the options bag, or the codec isn't supported.
      // Fall through to the <img> path rather than failing the capture.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode that image"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(file: File, opts: Options = {}): Promise<CompressedImage> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const targetBytes = opts.targetBytes ?? DEFAULT_TARGET_BYTES;

  const decoded = await decode(file);
  const canvas = document.createElement("canvas");

  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare that image");
    // White matte: a PNG with alpha would otherwise composite to black in the PDF.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let quality = START_QUALITY;
    let blob = await toBlob(canvas, quality);
    for (let pass = 1; pass < MAX_PASSES && blob.size > targetBytes && quality > MIN_QUALITY; pass++) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
      blob = await toBlob(canvas, quality);
    }

    return { bytes: await blob.arrayBuffer(), mime: "image/jpeg", width, height };
  } finally {
    decoded.release();
    // Release the backing store; some engines hold it until the canvas is GC'd.
    canvas.width = 0;
    canvas.height = 0;
  }
}
