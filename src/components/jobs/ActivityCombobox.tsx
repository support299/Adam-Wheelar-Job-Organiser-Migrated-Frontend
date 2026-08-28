import { useState } from "react";
import { toast } from "sonner";
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
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListActivitiesQuery, useCreateActivityMutation } from "@/api/activitiesApi";

export const ACTIVITY_MAX_LEN = 30;

type Props = {
  value: number | null;
  onChange: (id: number | null) => void;
};

/**
 * Single-select picker over the Activity catalogue, with inline "Create" for a
 * name that doesn't exist yet. Shared by the new-job and edit-job forms.
 */
export function ActivityCombobox({ value, onChange }: Props) {
  const { data: activities = [] } = useListActivitiesQuery();
  const [createActivity] = useCreateActivityMutation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = activities.find((a) => a.id === value) ?? null;
  const term = search.trim();
  const filtered = term
    ? activities.filter((a) => a.body.toLowerCase().includes(term.toLowerCase()))
    : activities;
  const canCreate =
    term.length > 0 && !activities.some((a) => a.body.toLowerCase() === term.toLowerCase());

  async function createAndSelect() {
    const body = term.slice(0, ACTIVITY_MAX_LEN);
    if (!body) return;
    try {
      setCreating(true);
      const created = await createActivity({ body }).unwrap();
      onChange(created.id);
      setSearch("");
      setOpen(false);
      toast.success(`Activity "${created.body}" created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create activity");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
          >
            {selected ? selected.body : "Select or create an activity…"}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type a new activity…"
              value={search}
              onValueChange={setSearch}
              maxLength={ACTIVITY_MAX_LEN}
            />
            <CommandList>
              {value != null && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange(null);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Clear activity
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {filtered.length === 0 && !canCreate && <CommandEmpty>No activities yet.</CommandEmpty>}
                {filtered.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={String(a.id)}
                    onSelect={() => {
                      onChange(a.id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                    {a.body}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <CommandGroup>
                  <CommandItem value="__create__" disabled={creating} onSelect={createAndSelect}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create “{term.slice(0, ACTIVITY_MAX_LEN)}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        One classification for this job. Type a new name and choose “Create” to add it.
      </p>
    </div>
  );
}
