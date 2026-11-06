"use client";
/* eslint-disable @next/next/no-img-element -- Keep the original QR pixels and aspect ratio. */

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { validUpiId } from "@/lib/payment-settings";
import Button from "./Button";

export function availableChannels(payment) {
  if (Array.isArray(payment?.channels)) return payment.channels;
  return [payment?.upiQrImage && "qr", payment?.upiId && "upi_id", payment?.upiPhoneNumber && "phone"].filter(Boolean);
}

export function CopyPaymentValue({ value, label }) {
  const [message, setMessage] = useState("");
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied ✓");
      timer.current = window.setTimeout(() => setMessage(""), 1800);
    } catch { setMessage("Copy unavailable. Select and copy the displayed value."); }
  }
  return <div className="payment-copy"><Button type="button" variant="outline" onClick={copy}><Copy className="size-4" aria-hidden="true" />{label}</Button><span className="type-meta text-text-secondary" role="status">{message}</span></div>;
}

const labels = { qr: "Scan QR", upi_id: "UPI ID", phone: "Phone number" };

export default function PaymentOptions({ payment, defaultChannel, amount, orderNumber }) {
  const [selected, setSelected] = useState("");
  const [failedQr, setFailedQr] = useState("");
  const channels = availableChannels(payment);
  if (!channels.length) return null;
  const channel = channels.includes(selected) ? selected : channels.includes(defaultChannel) ? defaultChannel : channels[0];
  const upiLink = validUpiId(payment.upiId) && Number.isFinite(amount) && amount > 0 ? `upi://pay?${new URLSearchParams({ pa: payment.upiId, ...(payment.upiDisplayName ? { pn: payment.upiDisplayName } : {}), am: amount.toFixed(2), cu: "INR", tn: orderNumber })}` : "";
  return <fieldset className="payment-methods">
    <legend className="type-section-title">How to pay</legend>
    <div className="payment-channels">{channels.map((item) => <label className="checkout-choice" key={item}><input type="radio" name="order-payment-channel" checked={channel === item} onChange={() => setSelected(item)} /><span>{labels[item]}</span></label>)}</div>
    <div className="payment-destination">
      {channel === "qr" && (failedQr === payment.upiQrImage ? <p role="status" className="type-supporting text-danger">The QR could not load. Try another available channel or contact support.</p> : <><img src={payment.upiQrImage} alt="Configured GharKaBite UPI payment QR" className="payment-qr" onError={() => setFailedQr(payment.upiQrImage)} /><a href={payment.upiQrImage} target="_blank" rel="noopener noreferrer" className="checkout-text-action">Enlarge QR</a></>)}
      {channel === "upi_id" && <><p className="type-meta text-text-secondary">UPI ID</p><p className="break-all text-lg font-bold">{payment.upiId}</p><CopyPaymentValue value={payment.upiId} label="Copy UPI ID" />{upiLink && <a href={upiLink} className="checkout-text-action">Open UPI app</a>}</>}
      {channel === "phone" && <><p className="type-meta text-text-secondary">UPI-linked phone</p><p className="text-lg font-bold">+91 {payment.upiPhoneNumber}</p><CopyPaymentValue value={`+91${payment.upiPhoneNumber}`} label="Copy phone number" /></>}
      {payment.upiDisplayName && <p className="type-supporting text-text-secondary">Payee: <strong>{payment.upiDisplayName}</strong></p>}
    </div>
    <p className="type-supporting mt-3 text-text-secondary">Pay the exact order amount. Keep your screenshot and Transaction ID so GharKaBite can verify the payment.</p>
  </fieldset>;
}
