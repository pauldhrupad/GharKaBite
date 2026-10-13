"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, MapPin, Search } from "lucide-react";
import LocationPicker from "./LocationPicker";
import { LoadingSpinner } from "./LoadingState";
import { revealValidationTarget } from "@/lib/validation-navigation";
import { useDeliveryPreview } from "@/context/DeliveryPreviewContext";
import { checkedDeliveryLabel } from "@/lib/meal-period";

export default function DeliveryChecker() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [fieldError, setFieldError] = useState("");
  const { label, expanded, updatePreview } = useDeliveryPreview();
  const request = useRef(null);
  const input = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (window.location.hash === "#delivery-checker") updatePreview({ expanded: true });
  }, [updatePreview]);
  useEffect(() => { if (expanded) input.current?.focus({ preventScroll: true }); }, [expanded]);
  function invalidate() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    updatePreview({ label: "" });
  }
  function showResult(value, address) {
    setResult(value);
    updatePreview({ label: checkedDeliveryLabel(value, address) });
  }
  useEffect(() => {
    if (query.trim().length < 3 || selected) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggesting(true);
      try {
        const response = await fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }), signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setSuggestions(data?.suggestions || []);
      } catch { if (!controller.signal.aborted) setSuggestions([]); }
      finally { if (!controller.signal.aborted) setSuggesting(false); }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);
  async function check(event) {
    event.preventDefault();
    if (!selected && query.trim().length < 10) {
      setFieldError("Enter a full delivery address or choose a location.");
      revealValidationTarget("delivery-address-error", "delivery-address");
      return;
    }
    invalidate();
    const controller = new AbortController();
    request.current = controller;
    setFieldError(""); setBusy(true);
    try {
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: selected ? { ...selected.address, location: selected.location } : query }), signal: controller.signal });
      const value = await response.json();
      if (!controller.signal.aborted) showResult(response.ok ? value : { ...value, serviceable: false }, query);
    } catch { if (!controller.signal.aborted) showResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }, query); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  return <div id="delivery-checker" className="delivery-checker home-delivery">
    <button type="button" className="delivery-summary" aria-expanded={expanded} aria-controls="delivery-checker-panel" onClick={() => updatePreview({ expanded: !expanded })}><MapPin size={18} aria-hidden="true" /><span>{label ? <>Delivery checked <strong>{label}</strong></> : <>Local delivery <strong>Check your address</strong></>}</span><ChevronDown size={18} className={expanded ? "rotate-180" : ""} aria-hidden="true" /></button>
    <div id="delivery-checker-panel" hidden={!expanded} className="delivery-panel">
    <div className="flex items-start gap-3">
      <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0"><h2 className="font-black">Check if we deliver to your area</h2><p className="mt-1 text-sm leading-5 text-text-secondary">Enter your address or choose a location.</p></div>
    </div>
    <form onSubmit={check} className="mt-5 flex flex-col gap-3 sm:flex-row">
      <label className="group relative min-w-0 flex-1"><span className="sr-only">Full delivery address</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary group-focus-within:text-primary" aria-hidden="true" /><input ref={input} id="delivery-address" type="search" name="deliveryAddress" value={query} onChange={(event) => { invalidate(); setQuery(event.target.value); setSelected(null); setSuggestions([]); setSuggesting(false); setFieldError(""); }} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "delivery-address-error" : undefined} className="input-field with-leading-icon" placeholder="Enter delivery address" autoComplete="street-address" enterKeyHint="search" /></label>
      <button disabled={busy} aria-busy={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50 sm:w-auto">{busy && <LoadingSpinner />}{busy ? "Checking…" : "Check Delivery"}</button>
    </form>
    {fieldError && <p id="delivery-address-error" role="alert" className="mt-2 text-xs font-bold text-danger">{fieldError}</p>}
    {suggesting && <p role="status" className="mt-2 flex items-center gap-2 text-xs font-bold text-text-secondary"><LoadingSpinner />Searching addresses…</p>}
    {suggestions.length > 0 && !selected && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">{suggestions.map((value) => <button key={value} type="button" onClick={() => { invalidate(); setQuery(value); setSuggestions([]); }} className="block min-h-11 w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{value}</button>)}</div>}
    <div className="mt-3"><LocationPicker compactTrigger location={selected?.location} onSelect={(choice) => { invalidate(); const address = choice.result.label || [choice.address.street, choice.address.area, choice.address.city, choice.address.pinCode].join(", "); setSelected(choice); setQuery(address); setSuggestions([]); setSuggesting(false); showResult(choice.result, address); setFieldError(""); }} /></div>
    {result && <p role="status" className={`ui-enter mt-3 flex items-center gap-2 text-sm font-bold ${result.serviceable ? "text-success" : "text-danger"}`}>{result.serviceable ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}{result.reason}</p>}
    <p className="mt-3 text-xs leading-5 text-text-secondary">Your exact address is checked against the kitchen&apos;s delivery area.</p>
    </div>
  </div>;
}
