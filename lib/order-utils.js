import { orderStatuses } from "@/data/order-statuses";

export function getStatusIndex(status) {
  return orderStatuses.findIndex((entry) => entry.value === status);
}

export function formatOrderTimestamp(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(timestamp));
}
