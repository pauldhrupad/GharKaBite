import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const authState = vi.hoisted(() => ({ id: null }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: authState.id, role: "customer" } }) }));
vi.mock("@/lib/delivery", () => ({ checkDelivery: async () => ({ serviceable: true }), validLocation: (location) => typeof location?.lat === "number" && typeof location?.lon === "number" && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180 }));

let replica, mongoose, Meal, DailyMenu, DailyCapacity, Order, Subscription, SubscriptionPlan, KitchenSettings, DemoPayment;
let getMenu, seedCatalog, kolkataDate, createOrder, updateOrderStatus, purchaseSubscription, setSubscriptionStatus;
let createDemoPayment, completeDemoPayment;
const user = () => new mongoose.Types.ObjectId();
const delivery = async () => ({ serviceable: true });
function request(mealId = "veg-home-meal", key = crypto.randomUUID()) {
  return { checkoutKey: key, serviceDate: kolkataDate(1), mealPeriod: "Lunch", deliverySlot: "12–1 PM",
    items: [{ mealId, quantity: 1 }], contact: { name: "Test Customer", phone: "9876543210", email: "" },
    deliveryAddress: { house: "12", street: "Test Street", area: "Behala", city: "Kolkata", pinCode: "700034" } };
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = replica.getUri("gharkabite_test");
  ({ default: mongoose } = await import("mongoose"));
  ({ default: Meal } = await import("@/models/Meal"));
  ({ default: DailyMenu } = await import("@/models/DailyMenu"));
  ({ default: DailyCapacity } = await import("@/models/DailyCapacity"));
  ({ default: Order } = await import("@/models/Order"));
  ({ default: Subscription } = await import("@/models/Subscription"));
  ({ default: SubscriptionPlan } = await import("@/models/SubscriptionPlan"));
  ({ default: KitchenSettings } = await import("@/models/KitchenSettings"));
  ({ default: DemoPayment } = await import("@/models/DemoPayment"));
  ({ getMenu, seedCatalog } = await import("@/lib/catalog"));
  ({ kolkataDate } = await import("@/lib/dates"));
  ({ createOrder, updateOrderStatus } = await import("@/lib/order-service"));
  ({ purchaseSubscription, setSubscriptionStatus } = await import("@/lib/subscription-service"));
  ({ POST: createDemoPayment } = await import("@/app/api/demo-payments/route"));
  ({ POST: completeDemoPayment } = await import("@/app/api/demo-payments/[id]/route"));
  const { default: dbConnect } = await import("@/lib/dbConnect");
  await dbConnect();
  await Promise.all([Meal.init(), DailyMenu.init(), DailyCapacity.init(), Order.init(), Subscription.init(), SubscriptionPlan.init(), KitchenSettings.init(), DemoPayment.init()]);
});
afterAll(async () => { if (mongoose?.connection?.readyState) await mongoose.disconnect(); if (replica) await replica.stop(); });
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); await seedCatalog(); });

describe("daily menu and checkout", () => {
  it("applies a daily override without changing the weekly schedule", async () => {
    const date = kolkataDate(1);
    const meal = await Meal.findOne({ slug: "veg-home-meal" });
    expect((await getMenu(date)).find((entry) => entry.id === meal.slug).available).toBe(true);
    await DailyMenu.create({ meal: meal._id, date, availableOverride: false, remaining: meal.stockLimit, stockLimitSnapshot: meal.stockLimit });
    expect((await getMenu(date)).find((entry) => entry.id === meal.slug).available).toBe(false);
  });

  it("prevents overselling and capacity overruns under concurrent requests", async () => {
    await Meal.updateOne({ slug: "veg-home-meal" }, { stockLimit: 1 });
    const attempts = await Promise.allSettled([createOrder(user(), request(), "COD", { verifyDelivery: delivery }), createOrder(user(), request(), "COD", { verifyDelivery: delivery })]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await Order.countDocuments()).toBe(1);
    expect((await DailyMenu.findOne({ date: kolkataDate(1) })).remaining).toBe(0);
    await KitchenSettings.create({ key: "primary", dailyMaximum: 1, lunchMaximum: 1, dinnerMaximum: 1 });
    const next = await createOrder(user(), request("veg-roti-meal"), "COD", { verifyDelivery: delivery }).catch((error) => error);
    expect(next.status).toBe(409);
  });

  it("replays an identical checkout key without a second deduction", async () => {
    const buyer = user(); const body = request();
    const first = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    const repeated = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(String(first._id)).toBe(String(repeated._id));
    expect(await Order.countDocuments()).toBe(1);
    expect((await DailyCapacity.findOne({ date: body.serviceDate })).daily).toBe(1);
  });

  it("admits only one order when two meals race for the final kitchen slot", async () => {
    await KitchenSettings.create({ key: "primary", dailyMaximum: 1, lunchMaximum: 1, dinnerMaximum: 1 });
    const attempts = await Promise.allSettled([
      createOrder(user(), request("veg-home-meal"), "COD", { verifyDelivery: delivery }),
      createOrder(user(), request("veg-roti-meal"), "COD", { verifyDelivery: delivery }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await Order.countDocuments()).toBe(1);
    expect((await DailyCapacity.findOne({ date: kolkataDate(1) })).daily).toBe(1);
  });

  it("deducts one plan credit and restores it once on early cancellation", async () => {
    const buyer = user(); const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(buyer, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    const body = { ...request(), subscriptionId: String(subscription._id), coveredMealId: "veg-home-meal" };
    const order = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(0);
    expect((await Subscription.findById(subscription._id)).remainingMeals).toBe(2);
    await updateOrderStatus(order.orderNumber, "cancelled");
    await updateOrderStatus(order.orderNumber, "cancelled");
    expect((await Subscription.findById(subscription._id)).remainingMeals).toBe(3);
    expect((await DailyCapacity.findOne({ date: body.serviceDate })).daily).toBe(0);
  });

  it("extends expiry when a paused plan resumes", async () => {
    const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(user(), { planId: String(plan._id), mode: "Lunch", purchaseKey: crypto.randomUUID() });
    await setSubscriptionStatus(subscription._id, "paused");
    const before = (await Subscription.findById(subscription._id)).expiryDate;
    await Subscription.updateOne({ _id: subscription._id }, { pausedAt: new Date(Date.now() - 86400000) });
    const resumed = await setSubscriptionStatus(subscription._id, "active");
    expect(resumed.expiryDate.getTime() - before.getTime()).toBeGreaterThanOrEqual(86400000);
  });

  it("rejects unverified delivery without creating an order", async () => {
    await expect(createOrder(user(), request(), "COD", { verifyDelivery: async () => ({ serviceable: false, reason: "Unverified" }) })).rejects.toMatchObject({ status: 422 });
    expect(await Order.countDocuments()).toBe(0);
  });

  it("rechecks and stores a map pin, while rejecting invalid coordinates", async () => {
    const point = { lat: 22.501, lon: 88.301 };
    const body = request();
    body.deliveryAddress.location = point;
    const verifyDelivery = vi.fn(async () => ({ serviceable: true }));
    const order = await createOrder(user(), body, "COD", { verifyDelivery });
    expect(verifyDelivery).toHaveBeenCalledWith(expect.objectContaining({ location: point }));
    expect((await Order.findById(order._id)).deliveryAddress.location.toObject()).toMatchObject(point);
    const invalid = request();
    invalid.deliveryAddress.location = { lat: 999, lon: 88.301 };
    await expect(createOrder(user(), invalid, "COD", { verifyDelivery })).rejects.toMatchObject({ status: 400 });
  });

  it("rechecks a map pin for demo payment before creating an order", async () => {
    const body = request();
    body.deliveryAddress.location = { lat: 22.501, lon: 88.301 };
    const verifyDelivery = vi.fn(async () => ({ serviceable: false, reason: "Outside delivery area" }));
    await expect(createOrder(user(), body, "DEMO", { verifyDelivery })).rejects.toMatchObject({ status: 422 });
    expect(verifyDelivery).toHaveBeenCalledWith(expect.objectContaining({ location: body.deliveryAddress.location }));
    expect(await Order.countDocuments()).toBe(0);
  });

  it("blocks a plan whose expiry has passed during the current delivery day", async () => {
    const buyer = user(); const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(buyer, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    await Subscription.updateOne({ _id: subscription._id }, { expiryDate: new Date(Date.now() - 1000) });
    const body = { ...request(), serviceDate: kolkataDate(), subscriptionId: String(subscription._id), coveredMealId: "veg-home-meal" };
    await expect(createOrder(buyer, body, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    expect(await Order.countDocuments()).toBe(0);
  });

  it("does not spend a plan credit on a slot after the plan expires", async () => {
    const buyer = user(); const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(buyer, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    await Subscription.updateOne({ _id: subscription._id }, { expiryDate: new Date(`${kolkataDate(1)}T15:00:00+05:30`) });
    const body = { ...request(), mealPeriod: "Dinner", deliverySlot: "7–8 PM", subscriptionId: String(subscription._id), coveredMealId: "veg-home-meal" };
    await expect(createOrder(buyer, body, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    expect(await Order.countDocuments()).toBe(0);
  });
});

describe("demo payment route", () => {
  async function start(kind, payload) {
    const key = kind === "order" ? payload.checkoutKey : payload.purchaseKey;
    const response = await createDemoPayment(new Request("http://localhost/api/demo-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, key, payload }) }));
    expect(response.status).toBe(200);
    return (await response.json()).id;
  }
  async function complete(id, outcome) {
    return completeDemoPayment(new Request(`http://localhost/api/demo-payments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }), { params: Promise.resolve({ id }) });
  }
  it("creates nothing when demo payment fails", async () => {
    authState.id = String(user());
    const id = await start("order", request());
    const response = await complete(id, "failure");
    expect(response.status).toBe(200);
    expect(await Order.countDocuments()).toBe(0);
    expect(await DailyMenu.countDocuments()).toBe(0);
    expect((await DemoPayment.findById(id)).status).toBe("failed");
  });
  it("creates one order for a successful payment and replays it", async () => {
    authState.id = String(user());
    const id = await start("order", request());
    expect((await complete(id, "success")).status).toBe(200);
    expect((await complete(id, "success")).status).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
    expect((await DemoPayment.findById(id)).status).toBe("paid");
  });
  it("purchases a plan once after successful demo payment", async () => {
    authState.id = String(user());
    const plan = await SubscriptionPlan.findOne({ slug: "weekly" });
    const id = await start("subscription", { planId: String(plan._id), mode: "Dinner", purchaseKey: crypto.randomUUID() });
    expect((await complete(id, "success")).status).toBe(200);
    expect((await complete(id, "success")).status).toBe(200);
    expect(await Subscription.countDocuments()).toBe(1);
    expect((await Subscription.findOne()).remainingMeals).toBe(7);
  });
});
