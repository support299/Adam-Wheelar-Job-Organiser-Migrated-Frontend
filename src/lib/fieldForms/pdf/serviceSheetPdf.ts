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
import { SERVICE_ITEMS } from "@/components/field-forms/checklistContent";
import type { JobSnapshot, ServiceSheetValues } from "../types";

export type ServiceSheetPdfInput = {
  job: JobSnapshot;
  values: ServiceSheetValues;
  photos: PdfPhoto[];
};

export async function buildServiceSheetPdf(
  input: ServiceSheetPdfInput,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  // Lazy so jsPDF stays out of the main bundle. Workbox precaches the chunk,
  // so this still resolves with no connection.
  const { jsPDF } = await import("jspdf");
  const { job, values, photos } = input;

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const d: Doc = { pdf, y: 0, title: "Service Sheet" };
  pageHeader(d);

  heading(d, "Visit");
  kvGrid(d, [
    ["Service technician", values.technician],
    ["Job reference", job.jobId.slice(0, 8)],
    ["Date", values.date],
    ["Time", values.time],
  ]);

  heading(d, "Customer");
  kvGrid(d, [
    ["Customer name", values.customerName],
    ["Phone", values.phone],
    ["Cell phone", values.cellPhone],
    ["Email", values.email],
    ["Address", values.address],
    ["City", values.city],
  ]);

  heading(d, "Equipment on site");
  kvGrid(d, [
    ["RO", values.equipment.ro],
    ["Conditioner", values.equipment.conditioner],
    ["EAC", values.equipment.eac],
    ["U/V light", values.equipment.uv],
    ["AIO", values.equipment.aio],
    ["Hours (HRS)", values.equipment.hours],
    ["Peroxide", values.equipment.peroxide],
  ]);
  if (values.equipmentNotes.trim()) {
    wrapped(d, values.equipmentNotes.trim());
    d.y += 2;
  }

  heading(d, "Site details");
  const hookups = [
    values.basement && "Basement",
    values.underSink && "Under sink",
    values.fridgeHookup && "Fridge hook-up",
    values.iceMaker && "Ice maker",
  ].filter(Boolean) as string[];
  const plumbing = [
    values.plumbingHalf && '1/2"',
    values.plumbingThreeQuarter && '3/4"',
    values.plumbingPlastic && "Plastic",
  ].filter(Boolean) as string[];
  kvGrid(d, [
    ["Location & hookups", hookups.join(", ")],
    ["Counter type", values.counterType],
    ["Plumbing", plumbing.join(", ")],
  ]);

  const done = SERVICE_ITEMS.filter((i) => values.answers[i.id]).length;
  heading(d, `Service checklist (${done}/${SERVICE_ITEMS.length})`);
  for (const item of SERVICE_ITEMS) {
    checkRow(d, item.label, Boolean(values.answers[item.id]), values.itemNotes[item.id]);
  }

  if (values.officeMessage.trim()) {
    heading(d, "Messages for the office");
    wrapped(d, values.officeMessage.trim());
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
      label: "Service tech signature",
      dataUrl: values.technicianSignature,
      name: values.technicianSignatureName || values.technician,
    },
  );

  paginate(pdf);

  const fileName = `Service-Sheet_${slugify(values.customerName || job.name)}_${
    values.date || job.serviceDate
  }.pdf`;
  return { bytes: pdf.output("arraybuffer"), fileName };
}
