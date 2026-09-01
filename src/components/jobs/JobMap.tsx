import { useEffect, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import type { Job } from "@/api/types";
import { statusColor } from "@/lib/jobs";
import { buildGhlContactUrl } from "@/lib/ghlContactUrl";

// Above this many visible jobs we skip per-marker name labels: each label is a
// custom OverlayView whose draw() runs on every pan/zoom, so thousands of them
// freeze the page. Labels reappear automatically once filters shrink the set.
const LABEL_MAX = 150;

// Jobs that failed geocoding are stored at 0,0; plotting them drags the map
// bounds across the ocean. Only plot jobs with real coordinates.
function hasValidCoords(j: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(j.lat) &&
    Number.isFinite(j.lng) &&
    Math.abs(j.lat) <= 90 &&
    Math.abs(j.lng) <= 180 &&
    !(Math.abs(j.lat) < 0.0001 && Math.abs(j.lng) < 0.0001)
  );
}

type Props = {
  jobs: Job[];
  routeOrder?: Job[];
  selectedIds?: Set<string>;
  onMarkerClick?: (job: Job) => void;
  focusedId?: string | null;
  showLabels?: boolean;
  className?: string;
  drawPolygonEnabled?: boolean;
  polygon?: { lat: number; lng: number }[] | null;
  onPolygonChange?: (path: { lat: number; lng: number }[] | null) => void;
  originPoint?: { lat: number; lng: number; label?: string } | null;
  routeReturnsToOrigin?: boolean;
};

export function JobMap({
  jobs, routeOrder, selectedIds, onMarkerClick, focusedId, showLabels,
  className, drawPolygonEnabled, polygon, onPolygonChange, originPoint, routeReturnsToOrigin,
}: Props) {
  const { ready } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const markerByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const polyDrawListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const onPolygonChangeRef = useRef(onPolygonChange);
  // Vertices placed so far in the active drawing session — drives the on-map hint.
  const [drawCount, setDrawCount] = useState(0);
  // Signature of the last-fitted job set — lets us re-fit when the data changes
  // (e.g. date filter) but not when the user merely focuses/selects a marker.
  const fitSigRef = useRef<string>("");

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: 39.5, lng: -98.35 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoRef.current = new google.maps.InfoWindow();
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    clustererRef.current?.clearMarkers();
    clustererRef.current?.setMap(null);
    clustererRef.current = null;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    markerByIdRef.current.clear();
    polyRef.current?.setMap(null);
    polyRef.current = null;
    originMarkerRef.current?.setMap(null);
    originMarkerRef.current = null;
    const plottable = jobs.filter(hasValidCoords);
    if (plottable.length === 0) return;
    // Cluster only in plain map mode. In route mode (Daily Planner) markers are
    // numbered stops joined by a polyline, so they must stay individually visible.
    const useCluster = !routeOrder;
    const renderLabels = !!showLabels && plottable.length <= LABEL_MAX;
    const bounds = new google.maps.LatLngBounds();
    const markers = plottable.map((job) => {
      const isSelected = selectedIds?.has(job.id);
      const inRoute = routeOrder?.findIndex((j) => j.id === job.id) ?? -1;
      const label = inRoute >= 0 ? String(inRoute + 1) : "";
      const marker = new google.maps.Marker({
        position: { lat: job.lat, lng: job.lng },
        title: job.name,
        label: label ? { text: label, color: "#fff", fontWeight: "700" } : undefined,
        // While drawing an area, job markers must not swallow the click meant to
        // place a vertex (nor pan the map by focusing the job).
        clickable: !drawPolygonEnabled,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected || inRoute >= 0 ? 14 : 10,
          fillColor: statusColor(job.status),
          fillOpacity: 1,
          strokeColor: isSelected ? "#111" : "#fff",
          strokeWeight: isSelected ? 3 : 2,
        },
      });
      marker.addListener("click", () => {
        infoRef.current?.setContent(buildInfoHtml(job));
        infoRef.current?.open({ map, anchor: marker });
        onMarkerClick?.(job);
      });
      bounds.extend({ lat: job.lat, lng: job.lng });
      markerByIdRef.current.set(job.id, marker);
      if (renderLabels) {
        const overlay = createLabelOverlay(
          { lat: job.lat, lng: job.lng },
          `<div style="font-weight:600;">${escapeHtml(job.name)}</div>
           <div style="opacity:.85;">$${Number(job.service_value).toFixed(0)} · ${job.service_time.slice(0,5)}</div>`,
        );
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      }
      return marker;
    });
    markersRef.current = markers;
    if (useCluster) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers,
        // While drawing, a cluster click would zoom the map — swallow it.
        onClusterClick: drawPolygonEnabled ? () => {} : undefined,
      });
    } else {
      markers.forEach((m) => m.setMap(map));
    }
    if (originPoint) {
      originMarkerRef.current = new google.maps.Marker({
        position: { lat: originPoint.lat, lng: originPoint.lng },
        map,
        title: originPoint.label ?? "Base",
        zIndex: 9999,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#16a34a",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        label: { text: "B", color: "#fff", fontWeight: "700", fontSize: "11px" },
      });
      bounds.extend({ lat: originPoint.lat, lng: originPoint.lng });
    }
    if (routeOrder && routeOrder.length >= 1) {
      const path: google.maps.LatLngLiteral[] = [];
      if (originPoint) path.push({ lat: originPoint.lat, lng: originPoint.lng });
      for (const j of routeOrder) path.push({ lat: j.lat, lng: j.lng });
      if (originPoint && routeReturnsToOrigin) path.push({ lat: originPoint.lat, lng: originPoint.lng });
      if (path.length > 1) {
        polyRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map,
        });
      }
    }
    const fitSig = `${plottable.length}:${plottable[0]?.id ?? ""}:${plottable[plottable.length - 1]?.id ?? ""}`;
    if (!bounds.isEmpty() && fitSig !== fitSigRef.current) {
      // Record the signature even when we skip the camera move, so a data change
      // that arrives mid-draw doesn't yank the map once drawing ends.
      fitSigRef.current = fitSig;
      // Don't re-fit while the user is drawing an area — a background job refresh
      // must not move the map out from under them.
      if (!drawPolygonEnabled) {
        map.fitBounds(bounds, 60);
        if (plottable.length === 1) {
          google.maps.event.addListenerOnce(map, "idle", () => map.setZoom(13));
        }
      }
    }
  }, [ready, jobs, routeOrder, selectedIds, onMarkerClick, showLabels, originPoint, routeReturnsToOrigin, drawPolygonEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusedId) return;
    const job = jobs.find((j) => j.id === focusedId);
    if (!job) return;
    map.panTo({ lat: job.lat, lng: job.lng });
    // Open by position (not anchor): the marker may be hidden inside a cluster.
    infoRef.current?.setContent(buildInfoHtml(job));
    infoRef.current?.setPosition({ lat: job.lat, lng: job.lng });
    infoRef.current?.open({ map });
  }, [focusedId, ready, jobs]);

  // Keep the latest onPolygonChange without making the drawing effect depend on
  // it: the parent passes an inline arrow that changes identity every render, and
  // a re-render mid-draw must not tear down the in-progress vertices.
  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  });

  // Render the committed area polygon. It is draggable (move the whole shape) and
  // editable (drag/insert/remove vertices); edits are pushed back to the parent
  // debounced so a vertex drag doesn't thrash React state.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    if (!polygon || polygon.length < 3) return;
    const poly = new google.maps.Polygon({
      map,
      paths: polygon,
      fillColor: "#2563eb",
      fillOpacity: 0.12,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      clickable: true,
      draggable: true,
      editable: true,
    });
    polygonRef.current = poly;
    let emitTimer: number | null = null;
    const emit = () => {
      const path = poly.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      onPolygonChangeRef.current?.(path.length >= 3 ? path : null);
    };
    const scheduleEmit = () => {
      if (emitTimer) window.clearTimeout(emitTimer);
      emitTimer = window.setTimeout(emit, 250);
    };
    const path = poly.getPath();
    const listeners = [
      path.addListener("set_at", scheduleEmit),
      path.addListener("insert_at", scheduleEmit),
      path.addListener("remove_at", scheduleEmit),
      poly.addListener("dragend", scheduleEmit),
    ];
    return () => {
      if (emitTimer) window.clearTimeout(emitTimer);
      listeners.forEach((l) => l.remove());
      poly.setMap(null);
    };
  }, [ready, polygon]);

  // Drawing mode: each click drops a vertex immediately (no debounce, so fast
  // clicks are never dropped); double-click, or a click on the first vertex,
  // closes the area. Because a double-click also delivers 1–2 `click` events at
  // the same spot, the dblclick handler strips any trailing vertices that sit
  // within a few pixels of the closing point. The map stays pannable/zoomable —
  // a drag-pan never emits a `click`. A rubber-band edge and a translucent fill
  // preview follow the cursor; Esc cancels, Backspace removes the last point.
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!ready || !map) return;
    polyDrawListenersRef.current.forEach((l) => l.remove());
    polyDrawListenersRef.current = [];
    if (!drawPolygonEnabled) {
      map.setOptions({ disableDoubleClickZoom: false });
      return;
    }
    // Only suppress double-click zoom so the closing gesture doesn't also zoom.
    map.setOptions({ disableDoubleClickZoom: true });
    if (container) container.style.cursor = "crosshair";
    // drawCount is reset to 0 by this effect's cleanup when drawing mode ends.

    const pts: google.maps.LatLng[] = [];
    const vertexMarkers: google.maps.Marker[] = [];
    // clickable:false is essential — a clickable Polyline swallows map clicks
    // that land near an already-drawn edge, so later vertices silently fail.
    let line: google.maps.Polyline | null = new google.maps.Polyline({
      map, path: [], strokeColor: "#2563eb", strokeOpacity: 0.9, strokeWeight: 2, clickable: false,
    });
    let preview: google.maps.Polygon | null = null;
    let done = false;

    // Screen-pixel distance between two positions, used to spot the duplicate
    // vertices a double-click produces. Falls back to a zoom-scaled degree
    // threshold until the map projection is ready.
    const withinPixels = (a: google.maps.LatLng, b: google.maps.LatLng, px: number) => {
      const scale = 2 ** (map.getZoom() ?? 4);
      const proj = map.getProjection();
      if (proj) {
        const pa = proj.fromLatLngToPoint(a);
        const pb = proj.fromLatLngToPoint(b);
        if (pa && pb) {
          const dx = (pa.x - pb.x) * scale;
          const dy = (pa.y - pb.y) * scale;
          return dx * dx + dy * dy <= px * px;
        }
      }
      const degPerPx = 360 / (256 * scale);
      return (
        Math.abs(a.lng() - b.lng()) <= degPerPx * px &&
        Math.abs(a.lat() - b.lat()) <= degPerPx * px
      );
    };

    // Redraw the in-progress edge and (once there are ≥3 points) the fill
    // preview, optionally including the live cursor position as a phantom vertex.
    const renderGuides = (cursor?: google.maps.LatLng) => {
      const live = cursor ? [...pts, cursor] : [...pts];
      line?.setPath(live);
      if (live.length >= 3) {
        if (!preview) {
          preview = new google.maps.Polygon({
            map, paths: [], fillColor: "#2563eb", fillOpacity: 0.1,
            strokeColor: "#2563eb", strokeOpacity: 0.5, strokeWeight: 1, clickable: false,
          });
        }
        preview.setPath(live);
      } else if (preview) {
        preview.setMap(null);
        preview = null;
      }
    };

    const cleanup = () => {
      line?.setMap(null);
      line = null;
      preview?.setMap(null);
      preview = null;
      vertexMarkers.forEach((m) => m.setMap(null));
      vertexMarkers.length = 0;
    };
    const finish = (closeAt?: google.maps.LatLng | null) => {
      if (done) return;
      // A closing double-click / marker-click also lands 1–2 stray `click`
      // vertices at the closing point — drop any that sit right on top of it.
      if (closeAt) {
        while (pts.length > 3 && withinPixels(pts[pts.length - 1], closeAt, 8)) {
          vertexMarkers.pop()?.setMap(null);
          pts.pop();
        }
        setDrawCount(pts.length);
      }
      if (pts.length < 3) return;
      done = true;
      const closed = pts.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      cleanup();
      onPolygonChangeRef.current?.(closed);
    };
    const cancel = () => {
      if (done) return;
      done = true;
      cleanup();
      onPolygonChangeRef.current?.(null);
    };
    const addPoint = (latLng: google.maps.LatLng) => {
      if (done) return;
      const first = pts.length === 0;
      pts.push(latLng);
      setDrawCount(pts.length);
      const marker = new google.maps.Marker({
        position: latLng,
        map,
        // Vertices never intercept clicks while drawing (that would block
        // placing the next point). The first vertex opts back in once the area
        // has 3+ points so a click on it can close the shape.
        clickable: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: first ? 7 : 5,
          fillColor: first ? "#111" : "#2563eb",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      if (first) marker.addListener("click", () => finish(pts[0]));
      vertexMarkers.push(marker);
      if (pts.length === 3) {
        vertexMarkers[0].setOptions({ clickable: true, title: "Click to close the area" });
      }
      renderGuides();
    };
    const undoLast = () => {
      if (done || pts.length === 0) return;
      pts.pop();
      setDrawCount(pts.length);
      vertexMarkers.pop()?.setMap(null);
      renderGuides();
    };

    const clickL = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || done) return;
      // Ignore a click that lands on the previous vertex — that's mouse jitter
      // or a stray double, not a wanted point, and it inflates the count.
      const last = pts[pts.length - 1];
      if (last && withinPixels(last, e.latLng, 6)) return;
      addPoint(e.latLng);
    });
    const dblL = map.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
      finish(e.latLng);
    });
    // Throttle the rubber-band redraw to one per frame — updating the preview
    // Polygon on every raw mousemove starves the main thread and drops clicks.
    let moveRaf: number | null = null;
    let cursor: google.maps.LatLng | null = null;
    const moveL = map.addListener("mousemove", (e: google.maps.MapMouseEvent) => {
      if (done || !e.latLng || pts.length === 0) return;
      cursor = e.latLng;
      if (moveRaf != null) return;
      moveRaf = requestAnimationFrame(() => {
        moveRaf = null;
        if (!done && cursor && pts.length > 0) renderGuides(cursor);
      });
    });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); cancel(); }
      else if (ev.key === "Backspace" || ev.key === "Delete") { ev.preventDefault(); undoLast(); }
    };
    window.addEventListener("keydown", onKey);
    polyDrawListenersRef.current = [clickL, dblL, moveL];

    return () => {
      polyDrawListenersRef.current.forEach((l) => l.remove());
      polyDrawListenersRef.current = [];
      window.removeEventListener("keydown", onKey);
      if (moveRaf != null) cancelAnimationFrame(moveRaf);
      cleanup();
      setDrawCount(0);
      if (container) container.style.cursor = "";
      map.setOptions({ disableDoubleClickZoom: false });
    };
  }, [ready, drawPolygonEnabled]);

  return (
    <div className={`relative ${className ?? "w-full h-[60vh] rounded-lg overflow-hidden border bg-muted"}`}>
      <div ref={containerRef} className="w-full h-full" />
      {drawPolygonEnabled && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow-lg">
          {drawCount === 0
            ? "Click on the map to start the area"
            : `${drawCount} point${drawCount === 1 ? "" : "s"} · double-click or click the first point to finish`}
          <span className="opacity-70"> · Esc cancels · ⌫ removes last</span>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildInfoHtml(job: Job): string {
  const contactLink = job.ghl_contact_id
    ? `<div style="margin-top:8px;"><a href="${buildGhlContactUrl(job.ghl_contact_id)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:4px 8px;background:#2563eb;color:#fff;border-radius:4px;font-size:12px;text-decoration:none;font-weight:500;">Open Contact ↗</a></div>`
    : "";
  return `<div style="font-family:system-ui;min-width:200px;">
    <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${escapeHtml(job.name)}</div>
    <div style="font-size:12px;color:#555;">${escapeHtml(job.email)}</div>
    <div style="font-size:12px;margin-top:6px;">${escapeHtml(job.address)}</div>
    <div style="font-size:12px;margin-top:6px;">📅 ${job.service_date} · ${job.service_time.slice(0,5)}</div>
    <div style="font-size:12px;margin-top:4px;">💰 $${Number(job.service_value).toFixed(2)} · ${job.status}</div>
    ${contactLink}
  </div>`;
}

function createLabelOverlay(position: { lat: number; lng: number }, html: string): google.maps.OverlayView {
  class LabelOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    onAdd() {
      const div = document.createElement("div");
      div.style.cssText = "position:absolute;transform:translate(-50%,-140%);background:rgba(17,24,39,0.92);color:#fff;padding:3px 6px;border-radius:6px;font-size:11px;line-height:1.25;font-family:system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.25);";
      div.innerHTML = html;
      this.div = div;
      this.getPanes()!.markerLayer.appendChild(div);
    }
    draw() {
      if (!this.div) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(position.lat, position.lng));
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
    }
    onRemove() { this.div?.parentNode?.removeChild(this.div); this.div = null; }
  }
  return new LabelOverlay();
}
