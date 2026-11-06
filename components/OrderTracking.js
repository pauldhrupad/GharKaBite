"use client";

import Link from "next/link";
import { Check, Circle, ClipboardCheck, CookingPot, House, PackageCheck, ReceiptText, Truck } from "lucide-react";
import Badge from "./Badge";
import Button from "./Button";
import OrderPaymentStatus, { OrderRefreshFeedback } from "./OrderPaymentStatus";
import OrderSummary from "./OrderSummary";
import ThaliOrderDetails from "./ThaliOrderDetails";
import { formatINR } from "@/lib/cart-pricing";
import { formatOrderTimestamp, orderStatusLabel, proofImageHref, trackingSteps } from "@/lib/order-utils";
import { canSubmitProof, whatsappUrl } from "@/lib/payment-settings";
import { useOrderRefresh } from "@/lib/use-order-refresh";

const icons = [ReceiptText, ClipboardCheck, CookingPot, PackageCheck, Truck, House];

export default function OrderTracking({ orderId }) {
  const read = useOrderRefresh(orderId);
  const { order, payment } = read;
  if (!order || read.access) return <div className="container-shell py-4"><OrderRefreshFeedback read={read} orderId={orderId} /></div>;
  const cancelled = order.orderStatus === "cancelled";
  const waiting = order.orderStatus === "payment_pending";
  const status = orderStatusLabel(order);
  const address = order.deliveryAddress;
  const paymentUrl = `/orders/${encodeURIComponent(order.orderNumber)}/payment`;
  const support = whatsappUrl(!read.error && payment?.businessWhatsApp, `Hi GharKaBite, I need help with order ${order.orderNumber}.`);
  return <section className="container-shell post-checkout">
    <Link href="/orders" className="checkout-text-action">← My orders</Link>
    <header className="post-checkout-header"><div><p className="eyebrow">Order tracking</p><h1 className="type-page-title break-all">{order.orderNumber}</h1><p className="mt-1 type-supporting text-text-secondary">{[order.serviceDate, order.mealPeriod, order.deliverySlot].filter(Boolean).join(" · ")}</p></div><Badge tone={cancelled ? "cancelled" : order.orderStatus === "delivered" ? "success" : "pending"}>{status}</Badge></header>
    <div className="post-checkout-grid">
      <div className="post-checkout-stack">
        <section className="card-surface post-checkout-card">
          <h2 className="type-section-title">Order progress</h2>
          {cancelled ? <p className="type-body mt-3">This order was cancelled. Contact GharKaBite if you have a payment or refund question.</p> :
            waiting ? <p className="type-body mt-3">Your order was created. The kitchen has not started preparing it.</p> :
              <ol aria-label="Kitchen and delivery stages" className="tracking-steps">
                {trackingSteps(order).map(({ value, label, state, timestamp }, index) => {
                  const Icon = state === "recorded" ? Check : state === "skipped" ? Circle : icons[index];
                  return <li key={value} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                    <span className="tracking-step-icon"><Icon className="size-5" aria-hidden="true" /></span>
                    <div><p className="type-label">{label}</p><p className="type-meta text-text-secondary">{state === "skipped" ? "Not recorded" : state === "upcoming" ? "Upcoming" : [state === "current" ? "Current stage" : "Recorded", timestamp].filter(Boolean).join(" · ")}</p></div>
                  </li>;
                })}
              </ol>}
          <OrderRefreshFeedback read={read} orderId={orderId} />
        </section>
        <details className="card-surface post-checkout-card">
          <summary className="post-checkout-disclosure"><span>Order details</span><strong>{formatINR(order.total)}</strong></summary>
          <div className="tracking-items divide-y divide-border">{order.items.map((item, index) => <div key={`${item.mealId}-${index}`} className="tracking-item"><div><p className="type-label">{item.name}</p><p className="type-meta text-text-secondary">{item.quantity} × {formatINR(item.price)}</p><ThaliOrderDetails item={item} /></div><strong>{formatINR(item.quantity * item.price)}</strong></div>)}</div>
          {order.notes && <p className="type-supporting my-3">Order note: {order.notes}</p>}
          <OrderSummary storedOrder={order} />
        </details>
      </div>
      <aside className="post-checkout-stack">
        <section className="card-surface post-checkout-card"><h2 className="type-card-title">Payment</h2><p className="type-supporting my-2 text-text-secondary">{order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod === "manual_online" ? "Online payment · manually verified" : "Earlier order payment"}</p><OrderPaymentStatus order={order} />{order.paymentReceivedAt && <p className="type-meta mt-2 text-text-secondary">Recorded {formatOrderTimestamp(order.paymentReceivedAt)}</p>}{canSubmitProof(order) && order.total > 0 && <Button href={paymentUrl} className="mt-3">{order.paymentStatus === "rejected" ? "Review or resubmit proof" : "Payment instructions"}</Button>}{order.paymentHasScreenshot && <a href={proofImageHref(order)} target="_blank" rel="noopener noreferrer" className="checkout-text-action mt-2">View submitted screenshot</a>}</section>
        {address && <section className="card-surface post-checkout-card"><h2 className="type-card-title">Delivery</h2><p className="type-supporting mt-2">{order.deliverySlot}</p><address className="type-supporting mt-2 not-italic text-text-secondary">{[address.house, address.street, address.area, address.landmark, address.city, address.pinCode].filter(Boolean).join(", ")}</address></section>}
        <section className="card-surface post-checkout-card"><h2 className="type-card-title">Need help with this order?</h2>{support ? <a className="checkout-text-action mt-2" href={support} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a> : <Link className="checkout-text-action mt-2" href="/contact">Contact GharKaBite</Link>}</section>
      </aside>
    </div>
  </section>;
}
