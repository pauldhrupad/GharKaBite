"use client";
import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { formatINR } from "@/lib/cart-pricing";

export default function CheckoutActionBar({ total, totalLabel = "Total", label, href, disabled, loading, loadingText, onClick, type = "button", children }) {
  const bar = useRef(null);
  const [height, setHeight] = useState(112);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const layout = bar.current.closest("[data-customer-layout]");
    const summary = bar.current.closest(".checkout-summary");
    function measure() {
      if (bar.current) {
        const measured = bar.current.getBoundingClientRect().height;
        setHeight(measured);
        layout?.style.setProperty("--checkout-action-height", `${measured}px`);
        if (summary) summary.dataset.canStick = String(summary.getBoundingClientRect().height <= window.innerHeight - 120);
      }
      const typing = document.activeElement?.matches('input:not([type="radio"]):not([type="checkbox"]),textarea');
      setKeyboardOpen(Boolean(typing && window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75));
    }
    const observer = new ResizeObserver(measure);
    observer.observe(bar.current);
    if (summary) observer.observe(summary);
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    return () => { observer.disconnect(); layout?.style.removeProperty("--checkout-action-height"); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); document.removeEventListener("focusin", measure); document.removeEventListener("focusout", measure); };
  }, []);
  return <div className="checkout-action-space" data-keyboard-open={keyboardOpen} style={{ "--checkout-action-height": `${height}px` }}><div ref={bar} className="checkout-action-bar"><div className="checkout-action-amount"><span>{totalLabel}</span><strong>{Number.isFinite(total) ? formatINR(total) : "Review order"}</strong></div><Button type={type} href={disabled || loading ? undefined : href} disabled={disabled} loading={loading} loadingText={loadingText} onClick={onClick}>{label}</Button>{children && <p className="checkout-action-feedback">{children}</p>}</div></div>;
}
