"use client";
import { useState } from "react";
import Button from "./Button";

export default function PromoCodeControl({ code, onApply, onRemove, promo, id = "promo-code", disabled = false }) {
  const [draft, setDraft] = useState(code);
  function apply() { onApply(draft.trim().toUpperCase()); }
  return <div className="checkout-promo"><label htmlFor={id}>Promo code</label><div className="checkout-promo-input"><input id={id} className="input-field" value={draft} onChange={(event) => setDraft(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!disabled) apply(); } }} placeholder="Enter code" maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={disabled} aria-describedby={`${id}-message`} /><Button type="button" variant="outline" disabled={disabled} loading={promo.status === "checking"} loadingText="Checking…" onClick={apply}>Apply</Button></div><p id={`${id}-message`} role="status" className={promo.valid ? "checkout-promo-success" : ""}>{code ? promo.message : "Have a code? Apply it here."}</p>{code && <button type="button" disabled={disabled} className="checkout-text-action" onClick={() => { setDraft(""); onRemove(); }}>Remove code</button>}</div>;
}
