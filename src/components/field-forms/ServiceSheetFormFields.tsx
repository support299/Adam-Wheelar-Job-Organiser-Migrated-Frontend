import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, Section } from "@/components/jobs/formLayout";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { PhotoCapture } from "./PhotoCapture";
import { SignaturePad } from "./SignaturePad";
import { SERVICE_ITEMS } from "./checklistContent";
import type { ServiceSheetFormState } from "./useServiceSheetForm";

/** Presentational half of the Service Sheet — props are the hook's return. */
export function ServiceSheetFormFields(props: ServiceSheetFormState) {
  const {
    draftId,
    form,
    setForm,
    photos,
    setAnswer,
    setItemNote,
    setEquipment,
    markAll,
    serviceDone,
    serviceTotal,
    saving,
  } = props;

  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3";

  return (
    <div className="space-y-6">
      <Section title="01 · Visit">
        <div className={grid}>
          <Field label="Service technician" htmlFor="s_tech" className="sm:col-span-2">
            <Input
              id="s_tech"
              value={form.technician}
              onChange={(e) => setForm({ ...form, technician: e.target.value })}
            />
          </Field>
          <Field label="Date" htmlFor="s_date">
            <Input
              id="s_date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Time" htmlFor="s_time">
            <Input
              id="s_time"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="02 · Customer">
        <div className={grid}>
          <Field label="Customer name" htmlFor="s_cust" className="sm:col-span-2">
            <Input
              id="s_cust"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="s_phone">
            <Input
              id="s_phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Cell phone" htmlFor="s_cell">
            <Input
              id="s_cell"
              type="tel"
              value={form.cellPhone}
              onChange={(e) => setForm({ ...form, cellPhone: e.target.value })}
            />
          </Field>
          <Field label="Email address" htmlFor="s_email" className="sm:col-span-2">
            <Input
              id="s_email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Address" htmlFor="s_addr">
            <Input
              id="s_addr"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="City" htmlFor="s_city">
            <Input
              id="s_city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="03 · Equipment on site">
        <p className="-mt-1 text-xs text-muted-foreground">
          Model, serial, or condition for each unit serviced.
        </p>
        <div className={grid}>
          <Field label="RO" htmlFor="s_ro">
            <Input id="s_ro" value={form.equipment.ro} onChange={(e) => setEquipment("ro", e.target.value)} />
          </Field>
          <Field label="Conditioner" htmlFor="s_cond">
            <Input
              id="s_cond"
              value={form.equipment.conditioner}
              onChange={(e) => setEquipment("conditioner", e.target.value)}
            />
          </Field>
          <Field label="EAC" htmlFor="s_eac">
            <Input id="s_eac" value={form.equipment.eac} onChange={(e) => setEquipment("eac", e.target.value)} />
          </Field>
          <Field label="U/V light" htmlFor="s_uv">
            <Input id="s_uv" value={form.equipment.uv} onChange={(e) => setEquipment("uv", e.target.value)} />
          </Field>
          <Field label="AIO" htmlFor="s_aio">
            <Input id="s_aio" value={form.equipment.aio} onChange={(e) => setEquipment("aio", e.target.value)} />
          </Field>
          <Field label="Hours (HRS)" htmlFor="s_hrs">
            <Input id="s_hrs" value={form.equipment.hours} onChange={(e) => setEquipment("hours", e.target.value)} />
          </Field>
          <Field label="Peroxide" htmlFor="s_perox">
            <Input
              id="s_perox"
              value={form.equipment.peroxide}
              onChange={(e) => setEquipment("peroxide", e.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="s_notes" className="sm:col-span-2">
            <Textarea
              id="s_notes"
              rows={3}
              value={form.equipmentNotes}
              onChange={(e) => setForm({ ...form, equipmentNotes: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="04 · Site details">
        <div className="space-y-3">
          <Field label="Location & hookups">
            <div className="flex flex-wrap gap-4 pt-1">
              {(
                [
                  ["basement", "Basement"],
                  ["underSink", "Under sink"],
                  ["fridgeHookup", "Fridge hook-up"],
                  ["iceMaker", "Ice maker"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`s_${key}`}
                    checked={form[key]}
                    onCheckedChange={(v) => setForm({ ...form, [key]: v === true })}
                  />
                  <Label htmlFor={`s_${key}`} className="cursor-pointer text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </Field>

          <div className={grid}>
            <Field label="Counter type" htmlFor="s_counter">
              <Input
                id="s_counter"
                value={form.counterType}
                onChange={(e) => setForm({ ...form, counterType: e.target.value })}
              />
            </Field>
            <Field label="Plumbing">
              <div className="flex flex-wrap gap-4 pt-1">
                {(
                  [
                    ["plumbingHalf", '½"'],
                    ["plumbingThreeQuarter", '¾"'],
                    ["plumbingPlastic", "Plastic"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`s_${key}`}
                      checked={form[key]}
                      onCheckedChange={(v) => setForm({ ...form, [key]: v === true })}
                    />
                    <Label htmlFor={`s_${key}`} className="cursor-pointer text-sm font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title={`05 · Service checklist (${serviceDone}/${serviceTotal})`}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => markAll(SERVICE_ITEMS.map((i) => i.id))}
          >
            Mark all
          </Button>
        }
      >
        <div className="rounded-md border px-3">
          {SERVICE_ITEMS.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              checked={Boolean(form.answers[item.id])}
              note={form.itemNotes[item.id] ?? ""}
              onToggle={(v) => setAnswer(item.id, v)}
              onNoteChange={(n) => setItemNote(item.id, n)}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-destructive">✱</span> must be completed before sign-off ·
          tap “Note” to add a remark to any line
        </p>
      </Section>

      <Section title="06 · Messages & photos">
        <Field label="Messages for the office" htmlFor="s_msg">
          <Textarea
            id="s_msg"
            rows={3}
            value={form.officeMessage}
            onChange={(e) => setForm({ ...form, officeMessage: e.target.value })}
            placeholder="Follow-ups, parts needed, next visit…"
          />
        </Field>
        <Field label="Photos (optional)">
          <PhotoCapture draftId={draftId} photos={photos} disabled={saving} />
        </Field>
      </Section>

      <Section title="07 · Sign-off">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <SignaturePad
              label="Customer signature"
              value={form.customerSignature}
              onChange={(v) => setForm({ ...form, customerSignature: v })}
              disabled={saving}
            />
            <Input
              value={form.customerSignatureName}
              onChange={(e) => setForm({ ...form, customerSignatureName: e.target.value })}
              placeholder="Printed name"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            <SignaturePad
              label="Service tech signature"
              value={form.technicianSignature}
              onChange={(v) => setForm({ ...form, technicianSignature: v })}
              disabled={saving}
            />
            <Input
              value={form.technicianSignatureName}
              onChange={(e) => setForm({ ...form, technicianSignatureName: e.target.value })}
              placeholder="Printed name"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
