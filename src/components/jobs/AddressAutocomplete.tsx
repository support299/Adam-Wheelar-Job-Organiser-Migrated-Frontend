import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/hooks/use-google-maps";

type Props = {
  value: string;
  onChange: (val: string) => void;
  onSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
};

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const { ready } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
    });
    acRef.current = ac;
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      onSelect({
        address: place.formatted_address ?? inputRef.current!.value,
        lat: loc.lat(),
        lng: loc.lng(),
      });
    });

    const guardedAttr = "data-pac-guarded";

    // Fixed positioning is viewport-relative regardless of scroll or which
    // scrollable ancestor (dialog body, page body) the input sits in, so no
    // "host" element or containing-block math is needed — this works the same
    // whether the field is inside the modal's Dialog or a plain page.
    const positionContainer = (el: HTMLElement) => {
      const input = inputRef.current;
      if (!input) return;
      const inputRect = input.getBoundingClientRect();
      el.style.position = "fixed";
      el.style.left = `${Math.round(inputRect.left)}px`;
      el.style.top = `${Math.round(inputRect.bottom)}px`;
      el.style.width = `${Math.round(inputRect.width)}px`;
      el.style.zIndex = "10000";
    };

    const guardContainer = (el: HTMLElement) => {
      if (el.parentElement !== document.body) document.body.appendChild(el);
      positionContainer(el);
      if (el.getAttribute(guardedAttr)) return;
      el.setAttribute(guardedAttr, "1");
      const markSelecting = () => {
        selectingRef.current = true;
        window.setTimeout(() => { selectingRef.current = false; }, 250);
      };
      ["mousedown", "pointerdown", "touchstart"].forEach((evt) =>
        el.addEventListener(evt, markSelecting, true),
      );
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".pac-container").forEach(guardContainer);
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: false });
    const interval = window.setInterval(scan, 300);
    const handleReposition = () => scan();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    scan();

    return () => {
      listener.remove();
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (selectingRef.current) {
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
      placeholder={placeholder ?? (ready ? "Start typing an address…" : "Loading maps…")}
    />
  );
}
