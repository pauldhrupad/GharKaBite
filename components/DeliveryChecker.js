"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import LocationPicker from "./LocationPicker";

export default function DeliveryChecker() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (query.trim().length < 3) return undefined;
    const timer = window.setTimeout(() => fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }).then((response) => response.ok ? response.json() : null).then((data) => setSuggestions(data?.suggestions || [])).catch(() => setSuggestions([])), 400);
    return () => window.clearTimeout(timer);
  }, [query]);
  async function check(event) {
    event.preventDefault(); setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: selected ? { ...selected.address, location: selected.location } : query }) });
      setResult(await response.json());
    } catch { setResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }); }
    finally { setBusy(false); }
  }
  return <div className="mt-7 rounded-2xl border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(56,45,31,0.08)] sm:p-5"><div className="flex items-center gap-2"><MapPin className="size-5 text-primary" aria-hidden="true" /><div><h2 className="font-black">Do we deliver to you?</h2><p className="text-xs text-text-secondary">Search a full street address or choose a point on the map.</p></div></div><form onSubmit={check} className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">Full delivery address</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><input type="search" name="deliveryAddress" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); setResult(null); }} className="input-field with-leading-icon" placeholder="House, street, area, city and PIN" autoComplete="street-address" enterKeyHint="search" /></label><button disabled={busy || (!selected && query.trim().length < 10)} className="min-h-12 rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">{busy ? "Checking…" : "Check"}</button></form>{suggestions.length > 0 && !selected && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">{suggestions.map((value) => <button key={value} type="button" onClick={() => { setQuery(value); setSuggestions([]); }} className="block w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{value}</button>)}</div>}<div className="mt-3"><LocationPicker location={selected?.location} onSelect={(choice) => { setSelected(choice); setQuery(choice.result.label || [choice.address.street, choice.address.area, choice.address.city, choice.address.pinCode].join(", ")); setSuggestions([]); setResult(choice.result); }} /></div>{result && <p role="status" className={`mt-3 text-sm font-bold ${result.serviceable ? "text-success" : "text-danger"}`}>{result.reason}</p>}<p className="mt-2 text-xs text-text-secondary">Delivery is limited to verified addresses within 5 km.</p></div>;
}
