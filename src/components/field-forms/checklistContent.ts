/**
 * Field-form checklist content. Pure data — no React, no imports from the form
 * components. This is the only file to edit when the wording changes.
 *
 * Verbatim from the original ECW Field Forms HTML (SVC / SYS_STEPS / WRAP_ITEMS
 * arrays in its <script> block) — not guessed. Section structure and the
 * required/optional split come from the same source.
 *
 * `id` values are stable keys: they key the draft's answer map and appear in no
 * user-visible output, so they can outlive label rewording. NEVER renumber or
 * reuse an id — a changed id reads as "unanswered" on any draft already saved on
 * a technician's phone. Adding or removing items is otherwise safe.
 */

export type ChecklistItem = {
  id: string;
  label: string;
  /** Must be ticked before submit is allowed. Rendered with a ✱ marker. */
  required: boolean;
  /** Shows a "Note" button that reveals a textarea for this line. */
  allowsNotes: boolean;
};

const note = (id: string, label: string, required = false): ChecklistItem => ({
  id,
  label,
  required,
  allowsNotes: true,
});

const check = (id: string, label: string, required = false): ChecklistItem => ({
  id,
  label,
  required,
  allowsNotes: false,
});

/** Service Sheet — the 13-item checklist (section 05), from SVC in the original. */
export const SERVICE_ITEMS: ChecklistItem[] = [
  note("sc_press", "Pressure test system — 20 minutes"),
  note("sc_flow", "Check for water flow at faucet"),
  note("sc_lines", "All lines tied up"),
  note("sc_tank", "Tank valve open"),
  note("sc_exflush", "Explain how to flush the system"),
  note("sc_cloudy", "Explain water may be cloudy temporarily"),
  note("sc_glass", "Let water stand 1 minute in a glass"),
  note("sc_noleaks", "Ensure no leaks"),
  note("sc_prog", "Program unit"),
  note("sc_leak2", "Check for leaks — after programming"),
  note("sc_uv", "U/V light checked"),
  note("sc_leak3", "Final check for leaks"),
  note("sc_clean", "Everything in order and clean", true),
];

/**
 * Install Checklist — the per-system steps (section "System checklists"), from
 * SYS_STEPS in the original. The original applied this same 11-item list to
 * every system uniformly (its systems were a fixed code list: RO, PC, EAC, UV,
 * TIT, TAN, ARS). We apply it the same way, but to whichever products the job
 * actually calls for — see useInstallChecklistForm.ts.
 */
export const INSTALL_SYSTEM_STEPS: ChecklistItem[] = [
  check("oring", "Lubricate O-rings"),
  check("flush", "Flush system"),
  check("backwash", "Manual backwash"),
  check("leaks", "Check for leaks — use flashlight"),
  check("press", "Pressurize system"),
  check("flow", "Check for water flow"),
  check("lines", "All lines tied up / clamped"),
  check("program", "Program unit / hardness test"),
  check("photos", "Take picture(s) of system", true),
  check("manuals", "Give manual(s) to customer", true),
  check("explain", "Explain system to customer", true),
];

/** Install Checklist wrap-up (section 08), from WRAP_ITEMS in the original. */
export const WRAP_UP_ITEMS: ChecklistItem[] = [
  check("i_hotwater", "Hot water tank turned on"),
  check("i_cleanup", "Cleaned up — no garbage left behind", true),
];

/** Photo slots on the install form (section 09), from I_SLOTS in the original. */
export const INSTALL_PHOTO_SLOTS = [
  { id: "ph_before", label: "Before — whole area", required: true },
  { id: "ph_after", label: "After — whole area", required: true },
  { id: "ph_bdrain", label: "Before — drain line", required: false },
  { id: "ph_adrain", label: "After — drain line", required: false },
] as const;

/**
 * INSTALL_SYSTEM_STEPS ids are shared across every selected product (there's
 * one "flush" step, reused per product). Composite this with the product id
 * before touching `answers`/`itemNotes`, or ticking a step for one product
 * would tick it for all of them.
 */
export function productStepId(productId: string, stepId: string): string {
  return `${productId}.${stepId}`;
}

export function countAnswered(items: ChecklistItem[], answers: Record<string, boolean>): number {
  return items.reduce((n, item) => (answers[item.id] ? n + 1 : n), 0);
}

/** Required items still unticked — drives the submit guard's error message. */
export function missingRequired(
  items: ChecklistItem[],
  answers: Record<string, boolean>,
): ChecklistItem[] {
  return items.filter((item) => item.required && !answers[item.id]);
}
