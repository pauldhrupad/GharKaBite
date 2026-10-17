"use client";

import { useEffect, useState } from "react";

export function usePromoQuote(code, subtotal, retry = 0) {
  const [quote, setQuote] = useState({ code: "", subtotal: 0, status: "idle", valid: false, discount: 0, message: "" });
  const normalizedCode = String(code || "").trim().toUpperCase();

  useEffect(() => {
    if (!normalizedCode) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/promos/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalizedCode, subtotal }), signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setQuote(response.ok ? { ...data.promo, code: normalizedCode, subtotal, retry, status: "ready" } : { code: normalizedCode, subtotal, retry, status: "ready", valid: false, discount: 0, message: data.message || "Unable to check this code." });
      } catch {
        if (!controller.signal.aborted) setQuote({ code: normalizedCode, subtotal, retry, status: "ready", valid: false, discount: 0, message: "Unable to check this code. Please try again." });
      }
    }, 400);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [normalizedCode, subtotal, retry]);

  if (!normalizedCode) return { code: "", subtotal, status: "idle", valid: false, discount: 0, message: "" };
  if (quote.code !== normalizedCode || quote.subtotal !== subtotal || quote.retry !== retry) return { code: normalizedCode, subtotal, status: "checking", valid: false, discount: 0, message: "Checking promo code…" };
  return quote;
}
