/**
 * Stub for jsPDF's optional peer deps (html2canvas, dompurify, canvg).
 *
 * jsPDF lazily imports these only for `doc.html()` and SVG rendering. The field
 * forms draw their PDFs with explicit layout primitives (see pdfKit.ts) and
 * never call either, but the real packages are ~377KB that the service worker
 * would otherwise precache onto every technician's phone.
 *
 * Aliased in vite.config.ts. If anyone ever needs jsPDF's HTML or SVG path,
 * remove the aliases there rather than editing this file.
 */

function unavailable(): never {
  throw new Error(
    "jsPDF HTML/SVG rendering is not bundled in this app — build the PDF with pdfKit primitives instead.",
  );
}

export default unavailable;
