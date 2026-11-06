"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Badge from "./Badge";
import Button from "./Button";
import PaymentOptions, { CopyPaymentValue } from "./PaymentOptions";
import PaymentScreenshotPicker from "./PaymentScreenshotPicker";
import OrderPaymentStatus, { OrderRefreshFeedback } from "./OrderPaymentStatus";
import { canSubmitProof, whatsappUrl } from "@/lib/payment-settings";
import { formatINR } from "@/lib/cart-pricing";
import { formatOrderTimestamp, orderStatusLabel, paymentPresentation, proofImageHref } from "@/lib/order-utils";
import { revealValidationTarget } from "@/lib/validation-navigation";
import { useOrderRefresh } from "@/lib/use-order-refresh";

const fileTypes = ["image/jpeg", "image/png", "image/webp"];

export default function OrderPayment({ orderId }) {
  const read = useOrderRefresh(orderId);
  if (!read.order || read.access) return <div className="container-shell py-4"><OrderRefreshFeedback read={read} orderId={orderId} payment /></div>;
  return <PaymentDetails key={read.key} read={read} />;
}

function PaymentDetails({ read }) {
  const { order, payment } = read;
  const [showProof, setShowProof] = useState(false);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [unresolved, setUnresolved] = useState(false);
  const [elapsedDeadline, setElapsedDeadline] = useState(null);
  const pending = useRef(null);
  const uploaded = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const deadline = payment?.deadline;
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setTimeout(() => setElapsedDeadline(deadline), Math.max(0, Date.parse(deadline) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline]);

  const canSubmit = canSubmitProof(order);
  const paymentClosed = order.orderStatus === "payment_pending" && (payment?.windowClosed || Boolean(deadline && elapsedDeadline === deadline));
  const showDestinations = canSubmit && !paymentClosed && !read.error && payment?.availability === "available";
  const businessWhatsApp = read.error ? "" : payment?.businessWhatsApp;
  const proofUrl = whatsappUrl(businessWhatsApp, `Hi GharKaBite, I’m sending payment proof for order ${order.orderNumber} (${formatINR(order.total)}).`);
  const helpUrl = whatsappUrl(businessWhatsApp, `Hi GharKaBite, I need help with order ${order.orderNumber}.`);
  const orderHref = `/orders/${encodeURIComponent(order.orderNumber)}`;
  const paymentStatus = paymentPresentation(order);

  async function submit(method) {
    if (pending.current || !canSubmit || unresolved) return;
    const transaction = reference.trim().toUpperCase();
    const nextErrors = {};
    if (method === "website") {
      if (!/^[A-Z0-9-]{6,50}$/.test(transaction)) nextErrors.reference = "Enter 6–50 letters, digits or hyphens from your payment app.";
      if (!screenshot || !screenshot.size || screenshot.size > 5 * 1024 * 1024 || !fileTypes.includes(screenshot.type)) nextErrors.screenshot = "Choose a JPG, PNG or WebP screenshot up to 5 MB.";
    }
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) { revealValidationTarget(`payment-${first}-error`, `payment-${first}`); return; }
    setError("");
    const controller = new AbortController();
    pending.current = controller;
    const deadline = window.setTimeout(() => controller.abort("PROOF_TIMEOUT"), 45000);
    const finish = read.beginMutation();
    const endpoint = `/api/orders/${encodeURIComponent(order.orderNumber)}/payment-proof`;
    const revision = order.paymentProofRevision;
    let phase = "upload", status = 0, result, failure = "";
    try {
      let screenshotUrl;
      if (method === "website") {
        if (uploaded.current?.file === screenshot && uploaded.current.revision === revision) {
          screenshotUrl = uploaded.current.url;
        } else {
          setBusy("Uploading screenshot…");
          const signature = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
          status = signature.status;
          const signed = await signature.json();
          if (!signature.ok) throw new Error(signed.message);
          const upload = new FormData();
          for (const [name, value] of Object.entries({ file: screenshot, api_key: signed.apiKey, timestamp: signed.timestamp, public_id: signed.publicId, type: signed.type, signature: signed.signature, overwrite: signed.overwrite, allowed_formats: signed.allowed_formats })) upload.set(name, value);
          const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloud)}/image/upload`, { method: "POST", body: upload, signal: controller.signal });
          if (!response.ok) throw new Error("Screenshot upload failed. Try again.");
          screenshotUrl = (await response.json()).secure_url;
          if (!screenshotUrl) throw new Error("The upload could not be confirmed. Try again.");
          uploaded.current = { file: screenshot, revision, url: screenshotUrl };
        }
      }
      phase = "submit"; status = 0;
      setBusy("Submitting proof…");
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ method, expectedProofRevision: revision, ...(method === "website" ? { paymentReference: transaction, paymentNote: note, screenshotUrl } : {}) }) });
      status = response.status;
      const data = await response.json();
      if (!response.ok || !data.order) {
        if (status === 400) uploaded.current = null;
        throw new Error(data.message || "Could not confirm the submission.");
      }
      result = data.order;
    } catch (problem) { failure = controller.signal.reason === "PROOF_TIMEOUT" ? "The request timed out. Check your connection and try again." : problem.message || "Could not submit proof."; }
    finally { window.clearTimeout(deadline); }

    if (controller.signal.aborted && controller.signal.reason !== "PROOF_TIMEOUT") return;
    const refreshed = await finish?.(result, status);
    if (controller.signal.aborted && controller.signal.reason !== "PROOF_TIMEOUT") return;
    if (result) {
      setReference(""); setNote(""); setScreenshot(null); setShowProof(false); uploaded.current = null;
    } else if (![401, 403, 404].includes(status)) {
      if (phase === "submit" && (!status || status >= 500 || status < 300) && !refreshed) {
        setUnresolved(true);
        setError("We couldn’t check whether your proof was received. Refresh the order before retrying.");
      } else if (failure) {
        setError(failure);
        revealValidationTarget("payment-form-error");
      }
    }
    setBusy(""); pending.current = null;
  }

  async function refresh() {
    if (await read.refresh()) { setUnresolved(false); setError(""); }
  }

  return <section className="container-shell post-checkout">
    <Link className="checkout-text-action" href={orderHref}>← Order details</Link>
    <header className="post-checkout-header order-payment-header">
      <div><p className="eyebrow">Order {order.orderNumber}</p><h1 className="type-page-title">{order.paymentMethod === "manual_online" ? "Order payment" : "Payment details"}</h1><div className="payment-badges"><Badge tone={order.orderStatus === "cancelled" ? "cancelled" : "informational"}>{orderStatusLabel(order)}</Badge><Badge tone={paymentStatus.tone}>{paymentStatus.label}</Badge></div><CopyPaymentValue value={order.orderNumber} label="Copy order number" /></div>
      <div><span className="type-meta text-text-secondary">{showDestinations && order.paymentStatus === "pending" ? "Amount to pay" : "Stored order total"}</span><p className="payment-amount">{formatINR(order.total)}</p>{showDestinations && <CopyPaymentValue value={order.total.toFixed(2)} label="Copy amount" />}</div>
    </header>
    <div className="post-checkout-grid">
      <div className="post-checkout-stack">
        {canSubmit && order.paymentStatus === "rejected" && <div className="card-surface post-checkout-card"><OrderPaymentStatus order={order} /><p className="type-supporting mt-2">If you already paid, check your original transaction before sending money again.</p></div>}
        {(canSubmit || paymentClosed) && <section className="card-surface post-checkout-card">
          {paymentClosed ? <><h2 className="type-section-title">Payment window closed</h2><p className="type-supporting mt-2 text-text-secondary">Please don’t send a new payment. If you already paid, <a href="#payment-help" className="font-bold underline">contact support</a> so we can review your transfer. You can still send proof if it hasn’t been submitted.</p></> : showDestinations ? <>{payment.channelsChanged && <p className="checkout-notice mb-3">Some payment options changed since checkout. If you already paid or aren’t sure, submit proof or <a href="#payment-help" className="font-bold underline">contact support</a> before paying again.</p>}<PaymentOptions payment={payment.destinations} defaultChannel={order.paymentChannel} amount={order.total} orderNumber={order.orderNumber} /></> : <><h2 className="type-section-title">Payment instructions unavailable</h2><p className="type-supporting mt-2 text-text-secondary">We couldn’t confirm a current destination for this order. Contact support before paying. If you already paid, you can still submit proof when a proof option is available.</p></>}
        </section>}
        {canSubmit && <section className="card-surface post-checkout-card">
          <h2 className="type-section-title">Already paid?</h2><p className="type-supporting my-2 text-text-secondary">Send proof for manual verification. Submitting it does not confirm your order.</p>
          {payment?.proofUploadAvailable ? <>
            <Button type="button" variant="outline" disabled={Boolean(busy)} aria-expanded={showProof} aria-controls="payment-proof-form" onClick={() => setShowProof(!showProof)}>{showProof ? "Hide proof form" : order.paymentStatus === "rejected" ? "Resubmit proof" : "Submit payment proof"}</Button>
            {showProof && <form id="payment-proof-form" className="payment-proof-form" noValidate onSubmit={(event) => { event.preventDefault(); submit("website"); }}>
              <label className="type-label block">Transaction ID / UTR<input id="payment-reference" className="input-field mt-2" required value={reference} maxLength={50} disabled={Boolean(busy)} onChange={(event) => { setReference(event.target.value); setErrors({ ...errors, reference: "" }); }} aria-invalid={Boolean(errors.reference)} aria-describedby={errors.reference ? "payment-reference-error" : undefined} />{errors.reference && <span className="type-meta text-danger" role="alert" id="payment-reference-error">{errors.reference}</span>}</label>
              <PaymentScreenshotPicker file={screenshot} onChange={(file) => { setScreenshot(file); uploaded.current = null; setErrors({ ...errors, screenshot: "" }); }} disabled={Boolean(busy)} requiredError={errors.screenshot} />
              <label className="type-label block">Note (optional)<textarea className="input-field mt-2" maxLength={500} value={note} disabled={Boolean(busy)} onChange={(event) => setNote(event.target.value)} /></label>
              <Button type="submit" loading={Boolean(busy)} loadingText={busy} disabled={unresolved}>Submit for verification</Button>
            </form>}
          </> : <p className="type-supporting text-text-secondary">Website screenshot upload is unavailable.</p>}
          {proofUrl && <div className="payment-whatsapp"><a className="checkout-text-action" href={proofUrl} target="_blank" rel="noopener noreferrer">Send proof on WhatsApp</a><p className="type-supporting text-text-secondary">Attach your screenshot in the chat, then come back and report that you sent it. GharKaBite still checks the payment manually.</p><Button type="button" variant="outline" disabled={Boolean(busy) || unresolved} onClick={() => submit("whatsapp")}>I sent proof on WhatsApp</Button></div>}
          {busy && <p className="type-meta text-text-secondary" role="status">{busy}</p>}
          {error && <p id="payment-form-error" className="checkout-notice checkout-notice--error" tabIndex={-1} role="alert">{error}</p>}
        </section>}
        {!canSubmit && <section className="card-surface post-checkout-card"><h2 className="type-section-title">What happens next</h2><div className="my-3"><OrderPaymentStatus order={order} /></div><Button href={orderHref}>Track order</Button></section>}
      </div>
      <aside className="post-checkout-stack">
        <section className="card-surface post-checkout-card"><h2 className="type-card-title">Order summary</h2><p className="type-supporting mt-2">{[order.serviceDate, order.mealPeriod, order.deliverySlot].filter(Boolean).join(" · ")}</p>{canSubmit && order.paymentStatus === "pending" && <p className="type-supporting mt-2 text-text-secondary">{paymentStatus.description}</p>}{order.paymentSubmittedAt && <p className="type-meta mt-3 text-text-secondary">{order.paymentProofMethod === "whatsapp" ? "Proof reported" : "Proof submitted"} {formatOrderTimestamp(order.paymentSubmittedAt)}</p>}{order.paymentReference && <p className="type-meta mt-1 break-all">UTR: {order.paymentReference}</p>}{order.paymentHasScreenshot && <a className="checkout-text-action mt-2" href={proofImageHref(order)} target="_blank" rel="noopener noreferrer">View submitted screenshot</a>}<OrderRefreshFeedback read={{ ...read, refresh }} orderId={order.orderNumber} payment /></section>
        <section id="payment-help" className="card-surface post-checkout-card scroll-mt-20"><h2 className="type-card-title">Need help?</h2><p className="type-supporting mt-2 text-text-secondary">Have your order number ready when contacting GharKaBite.</p>{helpUrl ? <a className="checkout-text-action mt-2" href={helpUrl} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a> : <Link className="checkout-text-action mt-2" href="/contact">Contact GharKaBite</Link>}</section>
      </aside>
    </div>
  </section>;
}
