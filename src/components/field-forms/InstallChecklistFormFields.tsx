import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/jobs/formLayout";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { ProductPicker } from "./ProductPicker";
import { PhotoCapture } from "./PhotoCapture";
import { SignaturePad } from "./SignaturePad";
import { INSTALL_SYSTEM_STEPS, WRAP_UP_ITEMS, productStepId } from "./checklistContent";
import type { InstallChecklistFormState } from "./useInstallChecklistForm";

/** Presentational half of the Install Checklist. */
export function InstallChecklistFormFields(props: InstallChecklistFormState) {
  const {
    draftId,
    form,
    setForm,
    photos,
    productOptions,
    selectedProducts,
    setAnswer,
    setItemNote,
    toggleProduct,
    markAll,
    addProductLine,
    updateProductLine,
    removeProductLine,
    wrapDone,
    wrapTotal,
    saving,
  } = props;

  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3";

  return (
    <div className="space-y-6">
      <Section title="01 · Job">
        <div className={grid}>
          <Field label="Installer" htmlFor="i_installer">
            <Input
              id="i_installer"
              value={form.installer}
              onChange={(e) => setForm({ ...form, installer: e.target.value })}
            />
          </Field>
          <Field label="Confirmed by" htmlFor="i_confirmed">
            <Input
              id="i_confirmed"
              value={form.confirmedBy}
              onChange={(e) => setForm({ ...form, confirmedBy: e.target.value })}
            />
          </Field>
          <Field label="Date" htmlFor="i_date">
            <Input
              id="i_date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Time" htmlFor="i_time">
            <Input
              id="i_time"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="02 · Customer">
        <div className={grid}>
          <Field label="Customer name" htmlFor="i_cust" className="sm:col-span-2">
            <Input
              id="i_cust"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="i_phone">
            <Input
              id="i_phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="City" htmlFor="i_city">
            <Input
              id="i_city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Address" htmlFor="i_addr" className="sm:col-span-2">
            <Input
              id="i_addr"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="03 · Site">
        <div className={grid}>
          <Field label="Counter & faucet" htmlFor="i_counter">
            <Input
              id="i_counter"
              value={form.counterAndFaucet}
              onChange={(e) => setForm({ ...form, counterAndFaucet: e.target.value })}
            />
          </Field>
          <Field label="Basement type" htmlFor="i_bsmt">
            <Input
              id="i_bsmt"
              value={form.basementType}
              onChange={(e) => setForm({ ...form, basementType: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="04 · Systems to install"
        action={
          form.productIds.length > 0 ? (
            <span className="text-xs font-medium text-muted-foreground">
              {form.productIds.length} selected
            </span>
          ) : undefined
        }
      >
        <p className="-mt-1 text-xs text-muted-foreground">
          Pre-filled from what's already on this job. Add or remove systems here — a checklist opens
          below for each.
        </p>
        {productOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No products in the catalog yet — add some under Settings → Products.
          </p>
        ) : (
          <ProductPicker
            options={productOptions}
            selectedIds={form.productIds}
            onToggle={toggleProduct}
          />
        )}
      </Section>

      <Section title="05 · System checklists">
        {selectedProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No systems selected yet.</p>
        ) : (
          <div className="space-y-5">
            {selectedProducts.map((product) => {
              const done = INSTALL_SYSTEM_STEPS.filter((step) =>
                Boolean(form.answers[productStepId(product.id, step.id)]),
              ).length;
              return (
                <div key={product.id} className="rounded-md border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <span className="text-sm font-semibold">
                      {product.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        {done}/{INSTALL_SYSTEM_STEPS.length}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        markAll(
                          INSTALL_SYSTEM_STEPS.map((step) => productStepId(product.id, step.id)),
                        )
                      }
                    >
                      Mark all
                    </Button>
                  </div>

                  <div className="px-3">
                    {INSTALL_SYSTEM_STEPS.map((step) => {
                      const key = productStepId(product.id, step.id);
                      return (
                        <ChecklistItemRow
                          key={key}
                          item={step}
                          checked={Boolean(form.answers[key])}
                          note={form.itemNotes[key] ?? ""}
                          onToggle={(v) => setAnswer(key, v)}
                          onNoteChange={(n) => setItemNote(key, n)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-destructive">✱</span> must be completed before sign-off
        </p>
      </Section>

      <Section
        title="06 · Products & soap"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={addProductLine}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add a product
          </Button>
        }
      >
        {form.productLines.length > 0 && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_100px_36px] gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Product</span>
              <span>Qty</span>
              <span />
            </div>
            {form.productLines.map((line) => (
              <div key={line.id} className="grid grid-cols-[1fr_100px_36px] items-center gap-2">
                <Input
                  value={line.name}
                  onChange={(e) => updateProductLine(line.id, { name: e.target.value })}
                  placeholder="Product"
                />
                <Input
                  value={line.quantity}
                  inputMode="decimal"
                  onChange={(e) => updateProductLine(line.id, { quantity: e.target.value })}
                  placeholder="Qty"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeProductLine(line.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Field label="Deliver / explain soap" htmlFor="i_soap">
          <Input
            id="i_soap"
            value={form.soap}
            onChange={(e) => setForm({ ...form, soap: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="07 · Measurements">
        <div className={grid}>
          <Field label="TDS" htmlFor="i_tds" hint="ppm">
            <Input
              id="i_tds"
              inputMode="decimal"
              value={form.tds}
              onChange={(e) => setForm({ ...form, tds: e.target.value })}
            />
          </Field>
          <Field label="Hardness" htmlFor="i_hard">
            <Input
              id="i_hard"
              inputMode="decimal"
              value={form.hardness}
              onChange={(e) => setForm({ ...form, hardness: e.target.value })}
            />
          </Field>
          <Field label="PEX used" htmlFor="i_pex" hint="ft">
            <Input
              id="i_pex"
              inputMode="decimal"
              value={form.pexUsed}
              onChange={(e) => setForm({ ...form, pexUsed: e.target.value })}
            />
          </Field>
          <Field label="Connections used" htmlFor="i_conn">
            <Input
              id="i_conn"
              inputMode="numeric"
              value={form.connectionsUsed}
              onChange={(e) => setForm({ ...form, connectionsUsed: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section
        title={`08 · Wrap-up (${wrapDone}/${wrapTotal})`}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => markAll(WRAP_UP_ITEMS.map((i) => i.id))}
          >
            Mark all
          </Button>
        }
      >
        <div className="rounded-md border px-3">
          {WRAP_UP_ITEMS.map((item) => (
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
        <Field label="Notes" htmlFor="i_notes">
          <Textarea
            id="i_notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="09 · Photos">
        <p className="-mt-1 text-xs text-muted-foreground">
          Before &amp; after of the whole area are required
          <span className="ml-0.5 font-bold text-destructive">✱</span> — drain line shots if
          applicable.
        </p>
        <PhotoCapture draftId={draftId} photos={photos} disabled={saving} />
      </Section>

      <Section title="10 · Sign-off">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <SignaturePad
              label="Customer signature"
              required
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
              label="Installer signature"
              required
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
