"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, MapPin, Search } from "lucide-react";
import LocationPicker from "./LocationPicker";
import { revealValidationTarget } from "@/lib/validation-navigation";

export default function DeliveryChecker() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [fieldError, setFieldError] = useState("");
  useEffect(() => {
    if (query.trim().length < 3) return undefined;
    const timer = window.setTimeout(() => fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }).then((response) => response.ok ? response.json() : null).then((data) => setSuggestions(data?.suggestions || [])).catch(() => setSuggestions([])), 400);
    return () => window.clearTimeout(timer);
  }, [query]);
  async function check(event) {
    event.preventDefault();
    if (!selected && query.trim().length < 10) {
      setFieldError("Enter a full delivery address or choose a location.");
      revealValidationTarget("delivery-address-error", "delivery-address");
      return;
    }
    setFieldError(""); setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: selected ? { ...selected.address, location: selected.location } : query }) });
      setResult(await response.json());
    } catch { setResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }); }
    finally { setBusy(false); }
  }
  return <div className="mt-7 rounded-2xl border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(56,45,31,0.08)] sm:p-5">
    <div className="flex items-start gap-3">
      <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0"><h2 className="font-black">Do we deliver to you?</h2><p className="mt-1 text-sm leading-5 text-text-secondary">Enter your address or choose a location.</p></div>
    </div>
    <form onSubmit={check} className="mt-5 flex flex-col gap-3 sm:flex-row">
      <label className="group relative min-w-0 flex-1"><span className="sr-only">Full delivery address</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary group-focus-within:text-primary" aria-hidden="true" /><input id="delivery-address" type="search" name="deliveryAddress" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); setResult(null); setFieldError(""); }} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "delivery-address-error" : undefined} className="input-field with-leading-icon" placeholder="Enter delivery address" autoComplete="street-address" enterKeyHint="search" /></label>
      <button disabled={busy} aria-busy={busy} className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50 sm:w-auto">{busy ? "Checking…" : "Check address"}</button>
    </form>
    {fieldError && <p id="delivery-address-error" role="alert" className="mt-2 text-xs font-bold text-danger">{fieldError}</p>}
    {suggestions.length > 0 && !selected && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">{suggestions.map((value) => <button key={value} type="button" onClick={() => { setQuery(value); setSuggestions([]); }} className="block min-h-11 w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{value}</button>)}</div>}
    <div className="mt-3"><LocationPicker compactTrigger location={selected?.location} onSelect={(choice) => { setSelected(choice); setQuery(choice.result.label || [choice.address.street, choice.address.area, choice.address.city, choice.address.pinCode].join(", ")); setSuggestions([]); setResult(choice.result); setFieldError(""); }} /></div>
    {result && <p role="status" className={`ui-enter mt-3 flex items-center gap-2 text-sm font-bold ${result.serviceable ? "text-success" : "text-danger"}`}>{result.serviceable ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}{result.reason}</p>}
    <p className="mt-3 text-xs leading-5 text-text-secondary">Verified addresses within 3 km only.</p>
  </div>;
}
