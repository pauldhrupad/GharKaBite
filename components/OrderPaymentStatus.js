import Badge from "./Badge";
import Button from "./Button";
import LoadingState from "./LoadingState";
import { paymentPresentation } from "@/lib/order-utils";

export default function OrderPaymentStatus({ order }) {
  const { label, description, tone } = paymentPresentation(order);
  return <div className="space-y-2"><Badge tone={tone}>{label}</Badge><p className="type-supporting text-text-secondary">{description}</p></div>;
}

export function OrderRefreshFeedback({ read, orderId, payment = false }) {
  const href = `/orders/${encodeURIComponent(orderId)}${payment ? "/payment" : ""}`;
  if (read.access) return <section className="container-shell py-8"><div className="card-surface p-5"><h1 className="type-page-title">{read.access === 401 ? "Sign in to view this order" : "Order unavailable"}</h1><p className="my-3 type-supporting text-text-secondary">{read.access === 401 ? "Sign in again to continue securely." : "Check the order number or return to your orders."}</p><Button href={read.access === 401 ? `/welcome?mode=signin&returnTo=${encodeURIComponent(href)}` : "/orders"}>{read.access === 401 ? "Sign in" : "My orders"}</Button></div></section>;
  if (!read.order && !read.error) return <LoadingState label={payment ? "Loading payment details" : "Loading order tracking"} rows={2} />;
  return <div className="order-refresh">
    <div><p className="type-meta text-text-secondary">{read.checkedAt ? `Last checked at ${read.checkedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST` : ""}</p>{read.error && <p className="type-supporting text-danger" role="status">{read.error}</p>}</div>
    <Button type="button" variant="outline" onClick={read.refresh} disabled={read.checking}>{read.checking ? "Checking…" : read.order ? "Refresh status" : "Try again"}</Button>
    <p className="sr-only" role="status">{read.announcement}</p>
  </div>;
}
