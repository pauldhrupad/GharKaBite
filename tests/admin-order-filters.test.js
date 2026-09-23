import { describe, expect, it } from "vitest";
import { filterAdminOrders, normalizePaymentFilter, orderStageFilters, paymentFilters } from "@/lib/admin-order-filters";

const orders = [
  { orderNumber: "GKB-001", customer: { name: "Ananya Sen", phone: "9876543210" }, mealPeriod: "Lunch", orderStatus: "confirmed", paymentStatus: "pending", paymentMethod: "COD" },
  { orderNumber: "GKB-002", customer: { name: "Rohan Das", phone: "9876543211" }, mealPeriod: "Dinner", orderStatus: "payment_pending", paymentStatus: "verification_pending", paymentMethod: "manual_online" },
  { orderNumber: "GKB-003", customer: { name: "Ananya Sen", phone: "9876543210" }, mealPeriod: "Dinner", orderStatus: "delivered", paymentStatus: "paid", paymentMethod: "COD" },
  { orderNumber: "GKB-004", customer: { name: "Mira Roy", phone: "9876543212" }, mealPeriod: "Lunch", orderStatus: "payment_pending", paymentStatus: "rejected", paymentMethod: "manual_online" },
];

describe("admin order filters", () => {
  it("combines search, meal period, order stage and payment state", () => {
    expect(filterAdminOrders(orders, { query: "rohan", period: "Dinner", status: "payment_pending", paymentFilter: "verification_pending" }).map((order) => order.orderNumber)).toEqual(["GKB-002"]);
    expect(filterAdminOrders(orders, { query: "9876543210", period: "Dinner", status: "delivered", paymentFilter: "paid" }).map((order) => order.orderNumber)).toEqual(["GKB-003"]);
    expect(filterAdminOrders(orders, { query: "missing" })).toEqual([]);
  });

  it("keeps Cash on Delivery as a payment-method filter", () => {
    expect(filterAdminOrders(orders, { paymentFilter: "COD" }).map((order) => order.orderNumber)).toEqual(["GKB-001", "GKB-003"]);
    expect(filterAdminOrders(orders, { paymentFilter: "pending" }).map((order) => order.orderNumber)).toEqual(["GKB-001"]);
  });

  it("accepts the dashboard verification deep link and rejects unknown values", () => {
    expect(normalizePaymentFilter("verification_pending")).toBe("verification_pending");
    expect(normalizePaymentFilter("not-a-filter")).toBe("all");
    expect(filterAdminOrders(orders, { paymentFilter: normalizePaymentFilter("verification_pending") }).map((order) => order.orderNumber)).toEqual(["GKB-002"]);
  });

  it("labels the two pending concepts distinctly", () => {
    expect(orderStageFilters.find((filter) => filter.value === "payment_pending")?.label).toBe("Awaiting payment");
    expect(paymentFilters.find((filter) => filter.value === "pending")?.label).toBe("Unpaid");
  });
});
