import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "./checklistContent";

/**
 * One checklist line: a checkbox, a ✱ on required lines, and a "Note" toggle
 * revealing a textarea — matching the original form's .ckrow / .notebtn pair.
 * Binary, not tri-state: the source markup uses <input type="checkbox">.
 */

type Props = {
  item: ChecklistItem;
  checked: boolean;
  note: string;
  onToggle: (checked: boolean) => void;
  onNoteChange: (note: string) => void;
  /** Highlights a required line the submit guard rejected. */
  invalid?: boolean;
};

export function ChecklistItemRow({
  item,
  checked,
  note,
  onToggle,
  onNoteChange,
  invalid,
}: Props) {
  const [showNote, setShowNote] = useState(Boolean(note));
  const inputId = `ck-${item.id}`;

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-start gap-2 py-1">
        <Label
          htmlFor={inputId}
          className="flex flex-1 cursor-pointer items-start gap-3 py-2 text-sm font-normal"
        >
          <Checkbox
            id={inputId}
            checked={checked}
            onCheckedChange={(v) => onToggle(v === true)}
            className="mt-0.5 shrink-0"
          />
          <span className={checked ? "text-muted-foreground" : undefined}>
            {item.label}
            {item.required && <span className="ml-1 font-bold text-destructive">✱</span>}
          </span>
        </Label>

        {item.allowsNotes && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setShowNote((s) => !s)}
          >
            {note ? "Note •" : "Note"}
          </Button>
        )}
      </div>

      {showNote && item.allowsNotes && (
        <div className="pb-3 pl-7">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add a remark for this line…"
            className="text-sm"
          />
        </div>
      )}

      {invalid && (
        <p className="pb-2 pl-7 text-xs text-destructive">This line is required.</p>
      )}
    </div>
  );
}
