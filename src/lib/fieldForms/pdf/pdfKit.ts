/**
 * A small cursor-based layout kit over jsPDF, shared by both form generators.
 *
 * jsPDF is imported lazily by the generators (`await import("jspdf")`) so it
 * stays out of the main bundle; Workbox still precaches the async chunk, so
 * generating a PDF works offline.
 */

import type { jsPDF } from "jspdf";
import { ECW_LOGO, ECW_LOGO_ASPECT } from "./logo";

export const PAGE = {
  width: 210,
  height: 297,
  margin: 14,
  contentWidth: 210 - 14 * 2,
  bottom: 297 - 18,
} as const;

export type Doc = {
  pdf: jsPDF;
  y: number;
  title: string;
};

/**
 * jsPDF's built-in fonts are Latin-1 only. An out-of-range codepoint renders as
 * garbage, so replace it visibly rather than letting it corrupt silently.
 */
export function sanitize(text: string): string {
  // Iterate code points rather than regex-matching a control-character range,
  // so an astral character (an emoji in a customer note) collapses to a single
  // "?" instead of two mangled surrogate halves.
  let out = "";
  for (const ch of text ?? "") {
    out += (ch.codePointAt(0) ?? 0) <= 0xff ? ch : "?";
  }
  return out;
}

/** Brand palette, carried over from the original ECW Field Forms stylesheet. */
const INK: [number, number, number] = [16, 48, 63];
const INK_MUTED: [number, number, number] = [90, 115, 132];
const GREEN: [number, number, number] = [111, 180, 60];

const LOGO_HEIGHT = 17;
const RULE_Y = 33;

/**
 * Letterhead, repeated on every page: logo left, title and company right,
 * green rule beneath. Falls back to a text wordmark when the logo asset
 * hasn't been added yet (see logo.ts).
 */
export function pageHeader(d: Doc): void {
  const { pdf } = d;
  const right = PAGE.width - PAGE.margin;

  if (ECW_LOGO) {
    pdf.addImage(
      ECW_LOGO,
      "PNG",
      PAGE.margin,
      9,
      LOGO_HEIGHT * ECW_LOGO_ASPECT,
      LOGO_HEIGHT,
    );
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...GREEN);
    pdf.text("EAST COAST", PAGE.margin, 17);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...INK_MUTED);
    pdf.text("WATER SOLUTIONS", PAGE.margin, 21.5);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.setTextColor(...INK);
  pdf.text(sanitize(d.title.toUpperCase()), right, 18, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK_MUTED);
  pdf.text("East Coast Water Solutions", right, 24, { align: "right" });

  const now = new Date();
  const stamp = `${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}  ·  ${now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
  pdf.text(sanitize(stamp), right, 29.5, { align: "right" });

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.7);
  pdf.line(PAGE.margin, RULE_Y, right, RULE_Y);

  d.y = RULE_Y + 9;
}

/** Break to a new page when `needed` mm won't fit below the cursor. */
export function ensureSpace(d: Doc, needed: number): void {
  if (d.y + needed <= PAGE.bottom) return;
  d.pdf.addPage();
  pageHeader(d);
}

export function heading(d: Doc, text: string): void {
  ensureSpace(d, 14);
  d.y += 3;
  d.pdf.setFont("helvetica", "bold");
  d.pdf.setFontSize(9.5);
  d.pdf.setTextColor(76, 135, 36);
  d.pdf.text(sanitize(text.toUpperCase()), PAGE.margin, d.y);
  d.y += 2;
  d.pdf.setDrawColor(225, 235, 242);
  d.pdf.setLineWidth(0.3);
  d.pdf.line(PAGE.margin, d.y, PAGE.width - PAGE.margin, d.y);
  d.y += 5;
}

/** Two-column label/value. Empty values render as a dash, never blank. */
export function kv(d: Doc, label: string, value: string, column = 0): void {
  const colWidth = PAGE.contentWidth / 2;
  const x = PAGE.margin + column * colWidth;
  if (column === 0) ensureSpace(d, 6);

  d.pdf.setFont("helvetica", "normal");
  d.pdf.setFontSize(7.5);
  d.pdf.setTextColor(110, 130, 142);
  d.pdf.text(sanitize(label.toUpperCase()), x, d.y);

  d.pdf.setFontSize(9.5);
  d.pdf.setTextColor(16, 48, 63);
  const text = d.pdf.splitTextToSize(sanitize(value || "—"), colWidth - 6) as string[];
  d.pdf.text(text[0] ?? "—", x, d.y + 4);

  if (column === 1) d.y += 10;
}

/** Paired kv() calls, laid out two-up. */
export function kvGrid(d: Doc, pairs: Array<[string, string]>): void {
  pairs.forEach(([label, value], i) => kv(d, label, value, i % 2));
  if (pairs.length % 2 === 1) d.y += 10;
}

export function wrapped(d: Doc, text: string, indent = 0): void {
  const lines = d.pdf.splitTextToSize(
    sanitize(text),
    PAGE.contentWidth - indent,
  ) as string[];
  d.pdf.setFont("helvetica", "normal");
  d.pdf.setFontSize(9);
  d.pdf.setTextColor(16, 48, 63);
  for (const line of lines) {
    ensureSpace(d, 5);
    d.pdf.text(line, PAGE.margin + indent, d.y);
    d.y += 4.4;
  }
}

/** A checklist line: tick box, label, optional wrapped note beneath. */
export function checkRow(d: Doc, label: string, done: boolean, note?: string): void {
  ensureSpace(d, 8);
  const boxY = d.y - 3;

  d.pdf.setDrawColor(done ? 111 : 190, done ? 180 : 205, done ? 60 : 218);
  d.pdf.setFillColor(done ? 111 : 255, done ? 180 : 255, done ? 60 : 255);
  d.pdf.setLineWidth(0.4);
  d.pdf.roundedRect(PAGE.margin, boxY, 4, 4, 0.7, 0.7, done ? "FD" : "D");

  if (done) {
    d.pdf.setDrawColor(255, 255, 255);
    d.pdf.setLineWidth(0.6);
    d.pdf.line(PAGE.margin + 1, boxY + 2, PAGE.margin + 1.8, boxY + 2.9);
    d.pdf.line(PAGE.margin + 1.8, boxY + 2.9, PAGE.margin + 3.1, boxY + 1.1);
  }

  d.pdf.setFont("helvetica", "normal");
  d.pdf.setFontSize(9);
  d.pdf.setTextColor(16, 48, 63);
  const lines = d.pdf.splitTextToSize(sanitize(label), PAGE.contentWidth - 8) as string[];
  d.pdf.text(lines[0] ?? "", PAGE.margin + 6.5, d.y);
  d.y += 4.6;
  for (const line of lines.slice(1)) {
    ensureSpace(d, 5);
    d.pdf.text(line, PAGE.margin + 6.5, d.y);
    d.y += 4.4;
  }

  if (note?.trim()) {
    d.pdf.setFontSize(8);
    d.pdf.setTextColor(110, 130, 142);
    const noteLines = d.pdf.splitTextToSize(
      `Note: ${sanitize(note.trim())}`,
      PAGE.contentWidth - 10,
    ) as string[];
    for (const line of noteLines) {
      ensureSpace(d, 4.5);
      d.pdf.text(line, PAGE.margin + 6.5, d.y);
      d.y += 3.8;
    }
    d.y += 1;
  }
}

export type PdfPhoto = {
  dataUrl: string;
  caption: string;
  width: number;
  height: number;
};

/** Two-up photo grid, each image aspect-fitted into its cell. */
export function photoGrid(d: Doc, photos: PdfPhoto[]): void {
  if (photos.length === 0) return;
  const gap = 6;
  const cellWidth = (PAGE.contentWidth - gap) / 2;
  const maxHeight = 58;

  for (let i = 0; i < photos.length; i += 2) {
    const row = photos.slice(i, i + 2);
    const heights = row.map((p) =>
      Math.min(maxHeight, cellWidth * (p.height / Math.max(1, p.width))),
    );
    const rowHeight = Math.max(...heights) + 7;
    ensureSpace(d, rowHeight);

    row.forEach((photo, col) => {
      const x = PAGE.margin + col * (cellWidth + gap);
      const scale = Math.min(cellWidth / photo.width, maxHeight / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      // JPEG is embedded verbatim — the PDF inherits the capture-time budget.
      d.pdf.addImage(photo.dataUrl, "JPEG", x, d.y, w, h);
      if (photo.caption.trim()) {
        d.pdf.setFont("helvetica", "normal");
        d.pdf.setFontSize(7.5);
        d.pdf.setTextColor(110, 130, 142);
        const caption = d.pdf.splitTextToSize(
          sanitize(photo.caption.trim()),
          cellWidth,
        ) as string[];
        d.pdf.text(caption[0] ?? "", x, d.y + h + 3.5);
      }
    });
    d.y += rowHeight;
  }
}

export function signatureBlock(
  d: Doc,
  left: { label: string; dataUrl: string | null; name: string },
  right: { label: string; dataUrl: string | null; name: string },
): void {
  ensureSpace(d, 42);
  const gap = 10;
  const boxWidth = (PAGE.contentWidth - gap) / 2;

  [left, right].forEach((sig, col) => {
    const x = PAGE.margin + col * (boxWidth + gap);

    d.pdf.setFont("helvetica", "normal");
    d.pdf.setFontSize(7.5);
    d.pdf.setTextColor(110, 130, 142);
    d.pdf.text(sanitize(sig.label.toUpperCase()), x, d.y);

    if (sig.dataUrl) {
      d.pdf.addImage(sig.dataUrl, "PNG", x, d.y + 2, boxWidth, 22);
    }

    d.pdf.setDrawColor(190, 205, 218);
    d.pdf.setLineWidth(0.4);
    d.pdf.line(x, d.y + 26, x + boxWidth, d.y + 26);

    d.pdf.setFontSize(8.5);
    d.pdf.setTextColor(16, 48, 63);
    d.pdf.text(sanitize(sig.name || "—"), x, d.y + 30);
  });

  d.y += 36;
}

/** Run last: numbers every page once the total is known. */
export function paginate(pdf: jsPDF): void {
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 158, 170);
    pdf.text(`Page ${page} of ${total}`, PAGE.width / 2, PAGE.height - 10, { align: "center" });
  }
}

export function slugify(text: string): string {
  return sanitize(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "job";
}
