import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderRefreshDelay, watchOrder } from "@/lib/use-order-refresh";
import { paymentPresentation, trackingSteps } from "@/lib/order-utils";
import { orderPaymentAvailability, paymentWindowDeadline } from "@/lib/payment-settings";

const online = { orderStatus: "payment_pending", paymentStatus: "verification_pending", paymentMethod: "manual_online", total: 150 };
const cod = { orderStatus: "delivered", paymentStatus: "pending", paymentMethod: "COD", total: 150 };
const ok = (order, payment = null) => Response.json({ order, payment });

describe("order refresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps polling through verification and fulfillment but stops for settled orders", async () => {
    const read = vi.fn().mockResolvedValueOnce(ok({ ...online, items: ["saved item"] })).mockResolvedValueOnce(ok({ ...online, orderStatus: "confirmed", paymentStatus: "paid" })).mockResolvedValueOnce(ok({ ...online, orderStatus: "delivered", paymentStatus: "paid" }));
    const onChange = vi.fn();
    const watch = watchOrder({ read, onChange, visible: () => true });
    await watch.refresh();
    await vi.advanceTimersByTimeAsync(15000);
    expect(read.mock.calls.map(([partial]) => partial)).toEqual([false, true]);
    expect(onChange.mock.lastCall[0].order.items).toEqual(["saved item"]);
    expect(onChange.mock.lastCall[0].announcement).toContain("Confirmed");
    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(180000);
    expect(read).toHaveBeenCalledTimes(3);
    watch.dispose();
  });

  it("coalesces triggers, aborts a stale read on mutation, and clears private state on authorization loss", async () => {
    let resolve;
    const read = vi.fn().mockResolvedValueOnce(ok({ ...online, paymentStatus: "pending" })).mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValueOnce(ok(online)).mockResolvedValueOnce(new Response(null, { status: 401 }));
    const onChange = vi.fn();
    const watch = watchOrder({ read, onChange, visible: () => true });
    await watch.refresh();
    const stale = watch.refresh();
    expect(watch.refresh()).toBe(stale);
    await Promise.resolve();
    const finish = watch.beginMutation();
    expect(read.mock.lastCall[1].aborted).toBe(true);
    const refreshed = finish(online, 200);
    resolve(ok({ ...online, orderStatus: "cancelled" }));
    expect(await stale).toBe(false);
    expect(await refreshed).toBe(true);
    expect(onChange.mock.calls.some(([state]) => state.order?.orderStatus === "cancelled")).toBe(false);
    await watch.refresh();
    expect(onChange.mock.lastCall[0]).toMatchObject({ access: 401, order: null, payment: null });
    await vi.advanceTimersByTimeAsync(180000);
    expect(read).toHaveBeenCalledTimes(4);
    watch.dispose();
  });

  it("pauses in the background, backs off and recovers, and aborts on disposal", async () => {
    let visible = true;
    const read = vi.fn().mockResolvedValueOnce(ok(cod)).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ok(cod)).mockImplementationOnce((_partial, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const onChange = vi.fn();
    const watch = watchOrder({ read, onChange, visible: () => visible });
    await watch.refresh();
    expect(orderRefreshDelay(cod)).toBe(60000);
    expect(orderRefreshDelay({ ...cod, total: 0 })).toBeNull();
    visible = false; watch.visibilityChanged();
    await vi.advanceTimersByTimeAsync(180000);
    expect(read).toHaveBeenCalledTimes(1);
    visible = true; await watch.visibilityChanged();
    expect(onChange.mock.lastCall[0].error).toContain("last known");
    await vi.advanceTimersByTimeAsync(15000);
    expect(onChange.mock.lastCall[0].error).toBe("");
    const pending = watch.refresh();
    await Promise.resolve();
    watch.dispose();
    expect(read.mock.lastCall[1].aborted).toBe(true);
    expect(await pending).toBe(false);
    await vi.advanceTimersByTimeAsync(180000);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("allows explicit refresh for cancelled orders without polling them", async () => {
    const read = vi.fn().mockImplementation(async () => ok({ ...online, orderStatus: "cancelled" }));
    const watch = watchOrder({ read, onChange: () => {}, visible: () => true });
    await watch.refresh();
    await vi.advanceTimersByTimeAsync(180000);
    expect(read).toHaveBeenCalledTimes(1);
    await watch.refresh();
    expect(read).toHaveBeenCalledTimes(2);
    watch.dispose();
  });
});

describe("truthful order presentation", () => {
  it("shows only recorded earlier stages as complete and uses no synthetic timestamps", () => {
    const steps = trackingSteps({ orderStatus: "packed", statusHistory: [{ status: "confirmed", timestamp: "2026-11-06T13:00:00Z" }] });
    expect(steps.map(({ state }) => state)).toEqual(["skipped", "recorded", "skipped", "current", "upcoming", "upcoming"]);
    expect(steps.filter(({ timestamp }) => timestamp)).toHaveLength(1);
  });

  it("distinguishes COD cash, proof self-reports, and zero balance", () => {
    expect(paymentPresentation(cod).label).toBe("Cash due");
    expect(paymentPresentation({ ...cod, paymentStatus: "paid" }).label).toBe("Cash received");
    expect(paymentPresentation({ ...online, paymentProofMethod: "whatsapp" }).description).toContain("reported");
    expect(paymentPresentation({ ...online, total: 0 }).label).toBe("No payment due");
    expect(paymentPresentation({ ...online, paymentStatus: "paid", orderStatus: "cancelled" }).description).toContain("before cancellation");
  });

  it("shows only unchanged configured destinations and never asks a zero-balance order to pay", () => {
    const details = { upiId: "kitchen@upi", upiPhoneNumber: "9876543210", upiQrImage: "https://res.cloudinary.com/demo/image/upload/v1/gharkabite/payment-qr/test.png" };
    const order = { ...online, serviceDate: "2026-11-07", mealPeriod: "Lunch", deliverySlot: "12–1 PM", paymentStatus: "pending", paymentDetails: details };
    const config = { ...details, lunchCutoff: "11:00", onlinePaymentEnabled: true, upiId: "another@upi" };
    const now = new Date("2026-11-07T10:59:59+05:30");
    const partial = orderPaymentAvailability(order, config, true, now);
    expect(partial.channelsChanged).toBe(true);
    expect(partial.destinations).toEqual({ upiPhoneNumber: details.upiPhoneNumber, upiQrImage: details.upiQrImage });
    expect(orderPaymentAvailability(order, { ...config, onlinePaymentEnabled: false }, true, now)).toMatchObject({ availability: "paused", destinations: {}, proofUploadAvailable: true });
    expect(orderPaymentAvailability({ ...order, total: 0 }, config, true, now)).toMatchObject({ availability: "not_due", destinations: {} });
    expect(orderPaymentAvailability(order, config, true, new Date("2026-11-07T11:00:00+05:30"))).toMatchObject({ availability: "closed", destinations: {}, proofUploadAvailable: true });
  });

  it("uses the earliest recorded deadline, current cutoff, or slot start and fails closed on unknown legacy dates", () => {
    const order = { serviceDate: "2026-11-07", mealPeriod: "Dinner", deliverySlot: "7–8 PM" };
    expect(paymentWindowDeadline(order, { dinnerCutoff: "20:00" })?.toISOString()).toBe("2026-11-07T13:30:00.000Z");
    const withSnapshot = { ...order, paymentDeadline: "2026-11-07T18:00:00+05:30" };
    expect(paymentWindowDeadline(withSnapshot, { dinnerCutoff: "18:30" })?.toISOString()).toBe("2026-11-07T12:30:00.000Z");
    expect(paymentWindowDeadline(withSnapshot, { dinnerCutoff: "17:00" })?.toISOString()).toBe("2026-11-07T11:30:00.000Z");
    expect(paymentWindowDeadline({ ...order, serviceDate: "2026-11-31" }, { dinnerCutoff: "18:00" })).toBeNull();
  });
});
