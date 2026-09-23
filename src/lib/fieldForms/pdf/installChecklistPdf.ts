import {
  checkRow,
  heading,
  kvGrid,
  pageHeader,
  paginate,
  photoGrid,
  signatureBlock,
  slugify,
  wrapped,
  type Doc,
  type PdfPhoto,
} from "./pdfKit";
import {
  INSTALL_SYSTEM_STEPS,
  WRAP_UP_ITEMS,
  productStepId,
} from "@/components/field-forms/checklistContent";
import type { InstallChecklistValues, JobSnapshot } from "../types";

export type InstallChecklistPdfInput = {
  job: JobSnapshot;
  values: InstallChecklistValues;
  photos: PdfPhoto[];
  /**
   * Resolved name for every selected product. The builder must stay pure and
   * offline-safe — it can't call RTK Query itself — so the caller (the page,
   * which already has the catalog loaded for the chips) resolves names before
   * handing them over. Order here is the order they print in.
   */
  selectedProducts: Array<{ id: string; name: string }>;
};

export async function buildInstallChecklistPdf(
  input: InstallChecklistPdfInput,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  const { jsPDF } = await import("jspdf");
  const { job, values, photos, selectedProducts } = input;

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const d: Doc = { pdf, y: 0, title: "Install Checklist" };
  pageHeader(d);

  heading(d, "Job");
  kvGrid(d, [
    ["Installer", values.installer],
    ["Confirmed by", values.confirmedBy],
    ["Date", values.date],
    ["Time", values.time],
    ["Job reference", job.jobId.slice(0, 8)],
  ]);

  heading(d, "Customer");
  kvGrid(d, [
    ["Customer name", values.customerName],
    ["Phone", values.phone],
    ["Address", values.address],
    ["City", values.city],
  ]);

  heading(d, "Site");
  kvGrid(d, [
    ["Counter & faucet", values.counterAndFaucet],
    ["Basement type", values.basementType],
  ]);

  // Only selected products appear at all. Printing every catalog product as
  // "N/A" would bury the real content under pages of noise.
  heading(d, "Systems installed");
  wrapped(
    d,
    selectedProducts.length > 0
      ? selectedProducts.map((p) => p.name).join(", ")
      : "None recorded",
  );
  d.y += 2;

  for (const product of selectedProducts) {
    const done = INSTALL_SYSTEM_STEPS.filter((step) =>
      Boolean(values.answers[productStepId(product.id, step.id)]),
    ).length;
    heading(d, `${product.name} (${done}/${INSTALL_SYSTEM_STEPS.length})`);

    for (const step of INSTALL_SYSTEM_STEPS) {
      const key = productStepId(product.id, step.id);
      checkRow(d, step.label, Boolean(values.answers[key]), values.itemNotes[key]);
    }
  }

  const productLines = values.productLines.filter((l) => l.name.trim().length > 0);
  if (productLines.length > 0 || values.soap.trim()) {
    heading(d, "Products & soap");
    for (const line of productLines) {
      wrapped(d, `• ${line.name}${line.quantity.trim() ? ` — ${line.quantity}` : ""}`);
    }
    if (values.soap.trim()) {
      d.y += 1;
      kvGrid(d, [["Deliver / explain soap", values.soap]]);
    }
  }

  heading(d, "Measurements");
  kvGrid(d, [
    ["TDS", values.tds.trim() ? `${values.tds} ppm` : ""],
    ["Hardness", values.hardness],
    ["PEX used", values.pexUsed.trim() ? `${values.pexUsed} ft` : ""],
    ["Connections used", values.connectionsUsed],
  ]);

  const wrapDone = WRAP_UP_ITEMS.filter((i) => values.answers[i.id]).length;
  heading(d, `Wrap-up (${wrapDone}/${WRAP_UP_ITEMS.length})`);
  for (const item of WRAP_UP_ITEMS) {
    checkRow(d, item.label, Boolean(values.answers[item.id]), values.itemNotes[item.id]);
  }

  if (values.notes.trim()) {
    heading(d, "Notes");
    wrapped(d, values.notes.trim());
  }

  if (photos.length > 0) {
    heading(d, "Photos");
    photoGrid(d, photos);
  }

  heading(d, "Sign-off");
  signatureBlock(
    d,
    {
      label: "Customer signature",
      dataUrl: values.customerSignature,
      name: values.customerSignatureName || values.customerName,
    },
    {
      label: "Installer signature",
      dataUrl: values.technicianSignature,
      name: values.technicianSignatureName || values.installer,
    },
  );

  paginate(pdf);

  const fileName = `Install-Checklist_${slugify(values.customerName || job.name)}_${
    values.date || job.serviceDate
  }.pdf`;
  return { bytes: pdf.output("arraybuffer"), fileName };
}
