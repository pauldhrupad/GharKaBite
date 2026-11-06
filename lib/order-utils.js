import { orderStatuses } from "@/data/order-statuses";

export function getStatusIndex(status) {
  return orderStatuses.findIndex((entry) => entry.value === status);
}

export function isOrderComplete(order) {
  return order.orderStatus === "delivered" && (order.paymentStatus === "paid" || order.total === 0);
}

export function formatOrderTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function proofImageHref(order) {
  return `/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot?proofRevision=${encodeURIComponent(order.paymentProofRevision || "")}`;
}

export function orderStatusLabel(order) {
  if (order.orderStatus === "cancelled") return "Cancelled";
  if (order.orderStatus === "payment_pending") return "Order created";
  return orderStatuses[getStatusIndex(order.orderStatus)]?.label || "Status unavailable";
}

export function paymentPresentation(order) {
  const { paymentMethod: method, paymentStatus: status, orderStatus, total } = order;
  const cancelled = orderStatus === "cancelled";
  if (status === "refunded") return { label: "Refund recorded", tone: "neutral", description: "A refund is recorded for this order." };
  if (total === 0) return { label: "No payment due", tone: "neutral", description: orderStatus === "payment_pending" ? "Contact support about confirmation. No payment is required." : "There is no balance to pay on this order." };
  if (method === "COD") return status === "paid" ? { label: "Cash received", tone: "success", description: "GharKaBite recorded your cash payment." } : cancelled ? { label: "No cash due", tone: "neutral", description: "This order was cancelled." } : { label: "Cash due", tone: "pending", description: "Cash collection has not been recorded." };
  if (status === "paid") return { label: method === "manual_online" ? "Payment verified" : "Payment recorded", tone: "success", description: cancelled ? "Payment was recorded before cancellation. Contact support about next steps." : "Payment is recorded. Check order progress for the current kitchen stage." };
  if (status === "verification_pending") return { label: "Verification pending", tone: "pending", description: cancelled ? "Contact support if you already paid." : order.paymentProofMethod === "whatsapp" ? "You reported sending proof on WhatsApp. GharKaBite still needs to verify it." : "Your proof was received. GharKaBite still needs to verify the payment." };
  if (status === "rejected") return { label: "Payment not verified", tone: "error", description: order.paymentRejectionReason || "Contact support for help with your payment." };
  if (status === "failed") return { label: "Payment failed", tone: "error", description: "Contact support before trying another payment." };
  if (cancelled) return { label: "No payment requested", tone: "neutral", description: "If you already sent payment, contact support." };
  return { label: "Payment pending", tone: "pending", description: "Your order was created. Online payment must be verified before the kitchen starts." };
}

export function trackingSteps(order) {
  const current = getStatusIndex(order.orderStatus);
  return orderStatuses.map((step, index) => {
    const recorded = order.statusHistory?.findLast((entry) => entry.status === step.value);
    return { ...step, state: index === current ? "current" : index < current ? recorded ? "recorded" : "skipped" : "upcoming", timestamp: index <= current ? formatOrderTimestamp(recorded?.timestamp) : "" };
  });
}
