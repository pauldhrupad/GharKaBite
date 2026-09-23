import { adminStatusOptions } from "@/data/order-statuses";

export const orderStageFilters = [
  { value: "all", label: "All stages" },
  ...adminStatusOptions.map((option) => option.value === "payment_pending" ? { ...option, label: "Awaiting payment" } : option),
];

export const paymentFilters = [
  { value: "all", label: "All payments" },
  { value: "pending", label: "Unpaid" },
  { value: "verification_pending", label: "Needs verification" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "COD", label: "Cash on Delivery" },
];

export function normalizePaymentFilter(value) {
  return paymentFilters.some((option) => option.value === value) ? value : "all";
}

export function filterAdminOrders(orders, { query = "", status = "all", paymentFilter = "all", period = "All" }) {
  const normalizedQuery = query.trim().toLowerCase();
  return orders.filter((order) => {
    const searchable = `${order.orderNumber} ${order.customer.name} ${order.customer.phone}`.toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (status === "all" || order.orderStatus === status)
      && (paymentFilter === "all" || (paymentFilter === "COD" ? order.paymentMethod === "COD" : order.paymentStatus === paymentFilter))
      && (period === "All" || order.mealPeriod === period);
  });
}
