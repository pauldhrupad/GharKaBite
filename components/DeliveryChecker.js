"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";

export default function DeliveryChecker() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.trim().length < 3) return undefined;
    const timer = window.setTimeout(() => fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }).then((response) => response.ok ? response.json() : null).then((data) => setSuggestions(data?.suggestions || [])).catch(() => setSuggestions([])), 400);
    return () => window.clearTimeout(timer);
  }, [query]);
  async function check(event) {
    event.preventDefault(); setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: query }) });
      setResult(await response.json());
    } catch { setResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }); }
    finally { setBusy(false); }
  }
  return <div className="mt-7 rounded-2xl border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(56,45,31,0.08)] sm:p-5"><div className="flex items-center gap-2"><MapPin className="size-5 text-primary" aria-hidden="true" /><div><h2 className="font-black">Do we deliver to you?</h2><p className="text-xs text-text-secondary">Search a full street address before choosing a meal.</p></div></div><form onSubmit={check} className="mt-4 flex gap-2"><label className="relative flex-1"><span className="sr-only">Full delivery address</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setResult(null); }} className="input-field pl-10" placeholder="Street, area, city and PIN" /></label><button disabled={busy || query.trim().length < 10} className="rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">{busy ? "Checking…" : "Check"}</button></form>{suggestions.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">{suggestions.map((value) => <button key={value} type="button" onClick={() => { setQuery(value); setSuggestions([]); }} className="block w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{value}</button>)}</div>}{result && <p role="status" className={`mt-3 text-sm font-bold ${result.serviceable ? "text-success" : "text-danger"}`}>{result.reason}</p>}<p className="mt-2 text-xs text-text-secondary">Delivery is limited to verified addresses within 5 km.</p></div>;
}
