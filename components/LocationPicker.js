"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, Search, X } from "lucide-react";
import { dismissOnBackdrop, useModalFocus } from "@/lib/use-modal-focus";

const mapKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAPS_KEY;
const kolkata = { lat: 22.5726, lon: 88.3639 };

export default function LocationPicker({ location, onSelect }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalFocus(open, () => setOpen(false));
  const [point, setPoint] = useState(location || null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mapElement = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pointRef = useRef(location || null);
  const movePinRef = useRef(null);

  useEffect(() => {
    if (!open || !mapKey) return undefined;
    let active = true;
    import("leaflet").then(({ default: L }) => {
      if (!active || !mapElement.current) return;
      const start = pointRef.current || kolkata;
      const instance = L.map(mapElement.current, { zoomControl: true }).setView([start.lat, start.lon], pointRef.current ? 16 : 12);
      L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(mapKey)}`, {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.geoapify.com/">Geoapify</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      }).addTo(instance);
      map.current = instance;
      const pinIcon = L.divIcon({ className: "", html: '<span class="map-picker-pin"></span>', iconSize: [26, 34], iconAnchor: [13, 34] });
      function movePin(next) {
        pointRef.current = next;
        setPoint(next);
        setMessage("");
        if (!marker.current) {
          marker.current = L.marker([next.lat, next.lon], { draggable: true, icon: pinIcon }).addTo(instance);
          marker.current.on("dragend", () => {
            const position = marker.current.getLatLng();
            pointRef.current = { lat: position.lat, lon: position.lng };
            setPoint(pointRef.current);
            setMessage("");
          });
        } else marker.current.setLatLng([next.lat, next.lon]);
      }
      movePinRef.current = movePin;
      if (pointRef.current) movePin(pointRef.current);
      instance.on("click", (event) => movePin({ lat: event.latlng.lat, lon: event.latlng.lng }));
      window.setTimeout(() => instance.invalidateSize(), 0);
    }).catch(() => { if (active) setMessage("The map could not load. Enter your address manually instead."); });
    return () => { active = false; movePinRef.current = null; marker.current = null; map.current?.remove(); map.current = null; };
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 3) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/delivery/map-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }), signal: controller.signal });
        const data = await response.json();
        setSuggestions(response.ok ? data.suggestions || [] : []);
      } catch { if (!controller.signal.aborted) setSuggestions([]); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  function choosePoint(next) {
    pointRef.current = next;
    setPoint(next);
    setMessage("");
    movePinRef.current?.(next);
    map.current?.setView([next.lat, next.lon], 17);
  }

  function currentLocation() {
    if (!navigator.geolocation) { setMessage("This browser cannot access your location. Search or enter the address manually."); return; }
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      setBusy(false);
      choosePoint({ lat: position.coords.latitude, lon: position.coords.longitude });
      if (position.coords.accuracy > 100) setMessage("Location accuracy is low. Move the pin to your exact delivery entrance.");
    }, () => { setBusy(false); setMessage("Location access was denied or timed out. Search the map or enter the address manually."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  async function confirm() {
    if (!point) return;
    setBusy(true); setMessage("Checking this pin…");
    try {
      const response = await fetch("/api/delivery/resolve-location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: point }) });
      const result = await response.json();
      if (!result.serviceable) { setMessage(result.reason || "We could not verify this pin."); return; }
      onSelect({ location: point, address: result.address, result });
      setOpen(false);
    } catch { setMessage("The location could not be checked. Enter the address manually instead."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={() => { pointRef.current = location || null; setPoint(pointRef.current); setMessage(""); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary px-4 text-sm font-bold text-primary"><MapPin className="size-4" aria-hidden="true" /> Choose on map or use current location</button>
    {location && <p className="mt-2 text-xs font-bold text-success">Delivery pin selected. You can move it or enter the address manually.</p>}
    {open && <div className="ui-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-5" onPointerDown={(event) => dismissOnBackdrop(event, () => setOpen(false))}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Choose delivery location" className="ui-dialog flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"><div className="flex items-center justify-between border-b border-border p-4"><div><h2 className="text-lg font-black">Choose your delivery point</h2><p className="text-xs text-text-secondary">Tap the map or drag the pin to the exact entrance.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close map" className="grid size-11 place-items-center rounded-lg hover:bg-surface-muted"><X className="size-5" /></button></div>
      <div className="space-y-3 overflow-y-auto p-4"><button type="button" onClick={currentLocation} disabled={busy || !mapKey} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"><Crosshair className="size-4" aria-hidden="true" /> Choose my current location</button><label className="relative block"><span className="sr-only">Search map address</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSuggestions([]); }} disabled={!mapKey} className="input-field with-leading-icon" placeholder="Search street, area or PIN" autoComplete="off" /></label>{suggestions.length > 0 && <div className="max-h-36 overflow-y-auto rounded-xl border border-border">{suggestions.map((item) => <button type="button" key={`${item.location.lat}-${item.location.lon}`} onClick={() => { choosePoint(item.location); setQuery(item.label); setSuggestions([]); }} className="block w-full border-b border-border p-2 text-left text-sm hover:bg-surface-muted">{item.label}</button>)}</div>}
        {mapKey ? <div ref={mapElement} className="h-[38dvh] min-h-64 w-full overflow-hidden rounded-xl border border-border" aria-label="Delivery location map" /> : <p className="rounded-xl bg-warning/10 p-4 text-sm">Map setup is unavailable. Enter your address manually.</p>}
        {message && <p role="status" className="text-sm font-bold text-text-secondary">{message}</p>}<p className="text-xs text-text-secondary">The map pin checks the same 5 km delivery area. House or flat number must still be entered separately.</p>
      </div><div className="flex justify-end border-t border-border p-4"><button type="button" onClick={confirm} disabled={!point || busy || !mapKey} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Checking…" : "Use this delivery point"}</button></div></section></div>}
  </>;
}
