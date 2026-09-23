import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Product } from "@/api/types";

/**
 * Multi-select over the product catalogue for the install form's "Systems to
 * install" section.
 *
 * Follows ActivityCombobox's Popover + Command shape, with two departures:
 * selecting does not close the popover (a tech usually adds two or three in a
 * row), and the current selection is shown as removable chips rather than in
 * the trigger — the chips are the section's real content, and the per-product
 * checklists below key off exactly this list.
 *
 * Only the selection is rendered inline. The full catalogue stays behind the
 * trigger, because printing every product as a chip buries a three-system job
 * in a wall of taps.
 */

type Props = {
  /** Already filtered to active-or-selected, and sorted, by the caller. */
  options: Product[];
  selectedIds: string[];
  onToggle: (productId: string) => void;
};

export function ProductPicker({ options, selectedIds, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Matched on SKU as well as name — the catalogue names are long and a tech
  // reading off a carton has the SKU to hand.
  const term = search.trim().toLowerCase();
  const filtered = term
    ? options.filter(
        (p) =>
          p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term),
      )
    : options;

  // Kept in `options` order rather than selection order, so a chip never jumps
  // position while the tech is working down the list.
  const selected = options.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-3">
      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing selected yet — add every system going in today.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map((product) => (
            <span
              key={product.id}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-primary bg-primary py-1 pl-4 pr-1 text-sm font-medium text-primary-foreground"
            >
              {product.name}
              <button
                type="button"
                onClick={() => onToggle(product.id)}
                aria-label={`Remove ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary-foreground/20"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add a system…
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or SKU…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 && <CommandEmpty>No products match.</CommandEmpty>}
              <CommandGroup>
                {filtered.map((product) => {
                  const on = selectedIds.includes(product.id);
                  return (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      // Deliberately left open: adding several systems in a row
                      // shouldn't cost a re-tap of the trigger each time.
                      onSelect={() => onToggle(product.id)}
                      className="min-h-11"
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4 shrink-0", on ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex-1">{product.name}</span>
                      {product.sku && (
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          {product.sku}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
