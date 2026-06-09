import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import type { Job } from "@/api/types";
import { statusColor } from "@/lib/jobs";
import { buildGhlContactUrl } from "@/lib/ghlContactUrl";

type Props = {
  jobs: Job[];
  routeOrder?: Job[];
  selectedIds?: Set<string>;
  onMarkerClick?: (job: Job) => void;
  focusedId?: string | null;
  showLabels?: boolean;
  className?: string;
  drawCircleEnabled?: boolean;
  circle?: { center: { lat: number; lng: number }; radiusMeters: number } | null;
  onCircleChange?: (c: { center: { lat: number; lng: number }; radiusMeters: number } | null) => void;
  originPoint?: { lat: number; lng: number; label?: string } | null;
  routeReturnsToOrigin?: boolean;
};

export function JobMap({
  jobs, routeOrder, selectedIds, onMarkerClick, focusedId, showLabels,
  className, drawCircleEnabled, circle, onCircleChange, originPoint, routeReturnsToOrigin,
}: Props) {
  const { ready } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const markerByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polyRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const radiusLabelRef = useRef<google.maps.OverlayView | null>(null);
  const drawListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const didFitRef = useRef<boolean>(false);

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
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    markerByIdRef.current.clear();
    polyRef.current?.setMap(null);
    polyRef.current = null;
    originMarkerRef.current?.setMap(null);
    originMarkerRef.current = null;
    if (jobs.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    const markers = jobs.map((job) => {
      const isSelected = selectedIds?.has(job.id);
      const inRoute = routeOrder?.findIndex((j) => j.id === job.id) ?? -1;
      const label = inRoute >= 0 ? String(inRoute + 1) : "";
      const marker = new google.maps.Marker({
        position: { lat: job.lat, lng: job.lng },
        title: job.name,
        label: label ? { text: label, color: "#fff", fontWeight: "700" } : undefined,
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
      if (showLabels) {
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
    markers.forEach((m) => m.setMap(map));
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
    if (!bounds.isEmpty() && !didFitRef.current) {
      map.fitBounds(bounds, 60);
      if (jobs.length === 1) {
        google.maps.event.addListenerOnce(map, "idle", () => map.setZoom(13));
      }
      didFitRef.current = true;
    }
  }, [ready, jobs, routeOrder, selectedIds, onMarkerClick, showLabels, originPoint, routeReturnsToOrigin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusedId) return;
    const marker = markerByIdRef.current.get(focusedId);
    const job = jobs.find((j) => j.id === focusedId);
    if (!marker || !job) return;
    map.panTo({ lat: job.lat, lng: job.lng });
    if ((map.getZoom() ?? 0) < 13) map.setZoom(14);
    infoRef.current?.setContent(buildInfoHtml(job));
    infoRef.current?.open({ map, anchor: marker });
  }, [focusedId, ready, jobs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    circleRef.current?.setMap(null);
    circleRef.current = null;
    radiusLabelRef.current?.setMap(null);
    radiusLabelRef.current = null;
    if (!circle) return;
    circleRef.current = new google.maps.Circle({
      map,
      center: circle.center,
      radius: circle.radiusMeters,
      fillColor: "#2563eb",
      fillOpacity: 0.12,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      clickable: true,
      draggable: true,
    });
    const updateLabel = () => {
      const c = circleRef.current;
      if (!c) return;
      const center = c.getCenter();
      const radius = c.getRadius();
      if (!center) return;
      radiusLabelRef.current?.setMap(null);
      radiusLabelRef.current = createLabelOverlay(
        { lat: center.lat(), lng: center.lng() },
        `<div style="font-weight:700;">${(radius / 1000).toFixed(2)} km</div>`,
      );
      radiusLabelRef.current.setMap(map);
    };
    circleRef.current.addListener("dragend", () => {
      const c = circleRef.current;
      if (!c) return;
      const center = c.getCenter();
      if (!center) return;
      updateLabel();
      onCircleChange?.({ center: { lat: center.lat(), lng: center.lng() }, radiusMeters: c.getRadius() });
    });
    circleRef.current.addListener("drag", updateLabel);
    radiusLabelRef.current = createLabelOverlay(
      circle.center,
      `<div style="font-weight:700;">${(circle.radiusMeters / 1000).toFixed(2)} km</div>`,
    );
    radiusLabelRef.current.setMap(map);
  }, [ready, circle, onCircleChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    drawListenersRef.current.forEach((l) => l.remove());
    drawListenersRef.current = [];
    if (!drawCircleEnabled) {
      map.setOptions({ draggable: true, gestureHandling: "auto", disableDoubleClickZoom: false });
      return;
    }
    map.setOptions({ draggable: false, gestureHandling: "none", disableDoubleClickZoom: true });
    let drawing = false;
    let liveCircle: google.maps.Circle | null = null;
    let center: google.maps.LatLng | null = null;
    const cleanupLive = () => { liveCircle?.setMap(null); liveCircle = null; };
    const computeRadius = (a: google.maps.LatLng, b: google.maps.LatLng) => {
      if (google.maps.geometry?.spherical) return google.maps.geometry.spherical.computeDistanceBetween(a, b);
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(b.lat() - a.lat()); const dLng = toRad(b.lng() - a.lng());
      const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat()))*Math.cos(toRad(b.lat()))*Math.sin(dLng/2)**2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    const down = map.addListener("mousedown", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      circleRef.current?.setMap(null); circleRef.current = null;
      radiusLabelRef.current?.setMap(null); radiusLabelRef.current = null;
      drawing = true; center = e.latLng; cleanupLive();
      liveCircle = new google.maps.Circle({ map, center: { lat: center.lat(), lng: center.lng() }, radius: 1, fillColor: "#2563eb", fillOpacity: 0.12, strokeColor: "#2563eb", strokeOpacity: 0.9, strokeWeight: 2, clickable: false });
    });
    const move = map.addListener("mousemove", (e: google.maps.MapMouseEvent) => {
      if (!drawing || !center || !e.latLng || !liveCircle) return;
      liveCircle.setRadius(computeRadius(center, e.latLng));
    });
    const finish = (e?: google.maps.MapMouseEvent) => {
      if (!drawing || !center) return;
      drawing = false;
      const end = e?.latLng ?? center;
      const r = Math.max(1, computeRadius(center, end));
      cleanupLive();
      onCircleChange?.({ center: { lat: center.lat(), lng: center.lng() }, radiusMeters: r });
      center = null;
    };
    const up = map.addListener("mouseup", (e: google.maps.MapMouseEvent) => finish(e));
    drawListenersRef.current = [down, move, up];
    return () => {
      drawListenersRef.current.forEach((l) => l.remove());
      drawListenersRef.current = [];
      cleanupLive();
      map.setOptions({ draggable: true, gestureHandling: "auto" });
    };
  }, [ready, drawCircleEnabled, onCircleChange]);

  return (
    <div className={className ?? "w-full h-[60vh] rounded-lg overflow-hidden border bg-muted"}>
      <div ref={containerRef} className="w-full h-full" />
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
      this.getPanes()!.floatPane.appendChild(div);
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
