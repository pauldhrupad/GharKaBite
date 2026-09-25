import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const authState = vi.hoisted(() => ({ id: null, role: "customer" }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: authState.id, role: authState.role } }) }));
vi.mock("@/lib/delivery", () => ({ checkDelivery: async () => ({ serviceable: true }), validLocation: (location) => typeof location?.lat === "number" && typeof location?.lon === "number" && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180 }));

let replica, mongoose, Meal, DailyMenu, DailyCapacity, Order, Subscription, SubscriptionPlan, KitchenSettings, DemoPayment, PromoCode, User;
let getMenu, seedCatalog, kolkataDate, createOrder, updateOrderStatus, markCodPaymentReceived, purchaseSubscription, setSubscriptionStatus;
let createDemoPayment, completeDemoPayment, submitPaymentProof, signPaymentProof, verifyPayment, getPaymentScreenshot, signedProofDownloadUrl;
let patchOrder;
let getPublicPaymentSettings, patchAdminPaymentSettings;
let getPublicSettings, patchAdminSettings, getAdminPromos, createAdminPromo, updateAdminPromo, deleteAdminPromo, validateCustomerPromo;
let getAdminAvatar, uploadAdminAvatar;
let getCustomerProfile, uploadCustomerAvatar;
let createAdminThali;
let getAdminOrderAlerts, getCustomerNavSummary;
const user = () => new mongoose.Types.ObjectId();
const delivery = async () => ({ serviceable: true });
function request(mealId = "veg-home-meal", key = crypto.randomUUID()) {
  return { checkoutKey: key, serviceDate: kolkataDate(1), mealPeriod: "Lunch", deliverySlot: "12–1 PM",
    items: [{ mealId, quantity: 1, selectedChoices: mealId === "fish-curry-meal" ? {} : { base: ["rice"] }, selectedAddOns: {} }], contact: { name: "Test Customer", phone: "9876543210", email: "" },
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
  ({ default: PromoCode } = await import("@/models/PromoCode"));
  ({ default: User } = await import("@/models/User"));
  ({ getMenu, seedCatalog } = await import("@/lib/catalog"));
  ({ kolkataDate } = await import("@/lib/dates"));
  ({ createOrder, updateOrderStatus, markCodPaymentReceived } = await import("@/lib/order-service"));
  ({ PATCH: patchOrder } = await import("@/app/api/orders/[orderId]/route"));
  ({ purchaseSubscription, setSubscriptionStatus } = await import("@/lib/subscription-service"));
  ({ POST: createDemoPayment } = await import("@/app/api/demo-payments/route"));
  ({ POST: completeDemoPayment } = await import("@/app/api/demo-payments/[id]/route"));
  ({ POST: submitPaymentProof, GET: signPaymentProof } = await import("@/app/api/orders/[orderId]/payment-proof/route"));
  ({ PATCH: verifyPayment } = await import("@/app/api/orders/[orderId]/payment-verification/route"));
  ({ GET: getPaymentScreenshot, signedProofDownloadUrl } = await import("@/app/api/orders/[orderId]/payment-screenshot/route"));
  ({ GET: getPublicPaymentSettings } = await import("@/app/api/payment-settings/route"));
  ({ PATCH: patchAdminPaymentSettings } = await import("@/app/api/admin/payment-settings/route"));
  ({ GET: getPublicSettings } = await import("@/app/api/settings/route"));
  ({ PATCH: patchAdminSettings } = await import("@/app/api/admin/settings/route"));
  ({ GET: getAdminPromos, POST: createAdminPromo, PATCH: updateAdminPromo, DELETE: deleteAdminPromo } = await import("@/app/api/admin/promos/route"));
  ({ POST: validateCustomerPromo } = await import("@/app/api/promos/validate/route"));
  ({ GET: getAdminAvatar, POST: uploadAdminAvatar } = await import("@/app/api/admin/avatar/route"));
  ({ GET: getCustomerProfile } = await import("@/app/api/profile/route"));
  ({ POST: uploadCustomerAvatar } = await import("@/app/api/profile/avatar/route"));
  ({ POST: createAdminThali } = await import("@/app/api/admin/meals/route"));
  ({ GET: getAdminOrderAlerts } = await import("@/app/api/admin/order-alerts/route"));
  ({ GET: getCustomerNavSummary } = await import("@/app/api/orders/nav-summary/route"));
  const { default: dbConnect } = await import("@/lib/dbConnect");
  await dbConnect();
  await Promise.all([Meal.init(), DailyMenu.init(), DailyCapacity.init(), Order.init(), Subscription.init(), SubscriptionPlan.init(), KitchenSettings.init(), DemoPayment.init(), PromoCode.init()]);
});
afterAll(async () => { if (mongoose?.connection?.readyState) await mongoose.disconnect(); if (replica) await replica.stop(); });
beforeEach(async () => { authState.role = "customer"; authState.id = null; for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); await seedCatalog(); });

describe("daily menu and checkout", () => {
  it("alerts admins only to orders awaiting a first action", async () => {
    expect((await getAdminOrderAlerts()).status).toBe(403);
    const order = await createOrder(user(), request(), "COD", { verifyDelivery: delivery });
    authState.role = "admin";
    const alerts = await getAdminOrderAlerts();
    expect(alerts.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await alerts.json()).toMatchObject({ count: 1, orders: [{ orderNumber: order.orderNumber }] });

    await updateOrderStatus(order.orderNumber, "cooking");
    expect(await (await getAdminOrderAlerts()).json()).toEqual({ count: 0, orders: [] });

    await Order.updateOne({ orderNumber: order.orderNumber }, { $set: { orderStatus: "payment_pending", paymentStatus: "verification_pending" } });
    expect(await (await getAdminOrderAlerts()).json()).toMatchObject({ count: 1, orders: [{ orderNumber: order.orderNumber }] });
    await Order.updateOne({ orderNumber: order.orderNumber }, { $set: { orderStatus: "delivered", paymentStatus: "paid" } });
    expect(await (await getAdminOrderAlerts()).json()).toEqual({ count: 0, orders: [] });
  });

  it("keeps navbar order status scoped to the signed-in customer", async () => {
    expect((await getCustomerNavSummary()).status).toBe(401);
    const buyer = user();
    const other = user();
    const mine = await createOrder(buyer, request(), "COD", { verifyDelivery: delivery });
    await createOrder(other, request(), "COD", { verifyDelivery: delivery });
    authState.id = buyer.toString();
    const summary = await getCustomerNavSummary();
    expect(summary.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await summary.json()).toMatchObject({ activeCount: 1, orders: [{ orderNumber: mine.orderNumber }] });
    for (let index = 0; index < 3; index += 1) await createOrder(buyer, request(), "COD", { verifyDelivery: delivery });
    const expanded = await (await getCustomerNavSummary()).json();
    expect(expanded.activeCount).toBe(4);
    expect(expanded.orders).toHaveLength(3);
    expect(expanded.orders.every((order) => order.orderNumber !== undefined)).toBe(true);
    await Order.updateOne({ orderNumber: mine.orderNumber }, { $set: { orderStatus: "delivered" } });
    expect((await (await getCustomerNavSummary()).json()).activeCount).toBe(3);
  });

  it("migrates to four configurable Thalis without the old duplicate meals", async () => {
    const menu = await getMenu(kolkataDate(1));
    expect(menu.map((item) => item.name).sort()).toEqual(["Chicken Thali", "Egg Thali", "Fish Thali", "Veg Thali"]);
    expect(menu.find((item) => item.category === "Fish").choiceGroups).toHaveLength(0);
    expect(menu.find((item) => item.category === "Fish").fixedItems.map((item) => item.name)).toContain("Rice");
    expect(menu.find((item) => item.category === "Chicken").choiceGroups[0].options.map((item) => item.name)).toEqual(["Rice", "Roti"]);
  });

  it("rejects missing, forged and excessive choices on the server", async () => {
    const buyer = user();
    await expect(createOrder(buyer, { ...request(), items: [{ mealId: "veg-home-meal", quantity: 1 }] }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    await expect(createOrder(buyer, { ...request(), items: [{ mealId: "veg-home-meal", quantity: 1, selectedChoices: { base: ["invented"] } }] }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    await expect(createOrder(buyer, { ...request(), items: [{ mealId: "veg-home-meal", quantity: 1, selectedChoices: { base: ["rice", "roti"] } }] }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
  });

  it("prices two variants separately and keeps their snapshots after an admin edit", async () => {
    const body = request("egg-curry-meal");
    body.items = [
      { mealId: "egg-curry-meal", quantity: 1, selectedChoices: { base: ["rice"] }, selectedAddOns: {} },
      { mealId: "egg-curry-meal", quantity: 2, selectedChoices: { base: ["roti"] }, selectedAddOns: { "extra-egg": 1, "extra-roti": 2 } },
    ];
    const order = await createOrder(user(), body, "COD", { verifyDelivery: delivery });
    expect(order.items).toHaveLength(2);
    expect(order.items[0].price).toBe(139);
    expect(order.items[1].price).toBe(179);
    expect(order.subtotal).toBe(497);
    expect(order.items[1].selectedAddOns.map((item) => [item.name, item.quantity])).toEqual([["Extra Egg", 1], ["Extra Roti", 2]]);
    await Meal.updateOne({ slug: "egg-curry-meal" }, { $set: { price: 299, name: "Changed Thali" } });
    const saved = await Order.findById(order._id).lean();
    expect(saved.items[1].name).toBe("Egg Thali");
    expect(saved.items[1].price).toBe(179);
  });

  it("ignores legacy add-on stock while retaining per-Thali add-on limits", async () => {
    await Meal.updateOne({ slug: "egg-curry-meal", "addOns.id": "extra-egg" }, { $set: { "addOns.$.stock": 0 } });
    const body = request("egg-curry-meal");
    body.items[0].selectedAddOns = { "extra-egg": 2 };
    const order = await createOrder(user(), body, "COD", { verifyDelivery: delivery });
    expect((await Meal.findOne({ slug: "egg-curry-meal" })).addOns.find((item) => item.id === "extra-egg").stock).toBe(0);
    await updateOrderStatus(order.orderNumber, "cancelled");
    expect((await Meal.findOne({ slug: "egg-curry-meal" })).addOns.find((item) => item.id === "extra-egg").stock).toBe(0);
    body.checkoutKey = crypto.randomUUID(); body.items[0].selectedAddOns = { "extra-egg": 99 };
    await expect(createOrder(user(), body, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
  });

  it("charges paid add-ons when a subscription covers the base Thali", async () => {
    const buyer = user(); const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(buyer, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    const body = { ...request("egg-curry-meal"), subscriptionId: String(subscription._id), coveredMealId: "egg-curry-meal" };
    body.items[0].selectedAddOns = { "extra-egg": 1 };
    const order = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(order.subtotal).toBe(159);
    expect(order.discount).toBe(139);
    expect(order.total).toBe(20);
  });

  it("lets admin create a custom Thali with two OR groups and a multi-choice group", async () => {
    authState.role = "admin";
    const source = (await Meal.findOne({ slug: "veg-home-meal" })).toObject();
    const payload = { ...source, slug: "test-special-thali", name: "Test Special Thali", category: "Special", price: 199,
      fixedItems: [{ name: "Dal" }, { name: "Sabzi" }],
      choiceGroups: [
        { id: "base", name: "Choose base", minSelections: 1, maxSelections: 1, options: [{ id: "rice", name: "Rice", priceAdjustment: 0 }, { id: "roti", name: "Roti", priceAdjustment: 10 }] },
        { id: "dal", name: "Choose dal", minSelections: 1, maxSelections: 1, options: [{ id: "masoor", name: "Masoor Dal", priceAdjustment: 0 }, { id: "moong", name: "Moong Dal", priceAdjustment: 5 }] },
        { id: "sides", name: "Choose sides", minSelections: 0, maxSelections: 2, options: [{ id: "salad", name: "Salad", priceAdjustment: 0 }, { id: "papad", name: "Papad", priceAdjustment: 0 }, { id: "chutney", name: "Chutney", priceAdjustment: 0 }] },
      ], addOns: [{ id: "dessert", name: "Dessert", price: 30, maxQuantity: 2, stock: 10 }] };
    const response = await createAdminThali(new Request("http://localhost/api/admin/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    expect(response.status).toBe(201);
    const custom = (await getMenu(kolkataDate(1))).find((item) => item.id === payload.slug);
    expect(custom.choiceGroups).toHaveLength(3);
    authState.role = "customer";
    const body = request(payload.slug);
    body.items[0].selectedChoices = { base: ["roti"], dal: ["moong"], sides: ["salad", "papad"] };
    body.items[0].selectedAddOns = { dessert: 2 };
    const order = await createOrder(user(), body, "COD", { verifyDelivery: delivery });
    expect(order.items[0].price).toBe(274);
    expect(order.items[0].selectedChoices[1].options[0].name).toBe("Moong Dal");
  });

  it("lets admin add a single dish, order it, and keeps plan credits for Thalis", async () => {
    authState.role = "admin";
    const source = (await Meal.findOne({ slug: "veg-home-meal" })).toObject();
    const payload = { ...source, slug: "test-aloo-bhaja", kind: "dish", mealType: "Single Dish", name: "Aloo Bhaja", shortDescription: "Crisp potato fry", description: "Home-style potato fry.", price: 79, choiceGroups: [], addOns: [], fixedItems: [] };
    const response = await createAdminThali(new Request("http://localhost/api/admin/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    expect(response.status).toBe(201);
    const dish = (await getMenu(kolkataDate(1))).find((item) => item.id === payload.slug);
    expect(dish).toMatchObject({ kind: "dish", mealType: "Single Dish", contents: ["Aloo Bhaja"] });

    authState.role = "customer";
    const buyer = user();
    const body = request(payload.slug);
    body.items[0].selectedChoices = {};
    const order = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(order.items[0]).toMatchObject({ kind: "dish", name: "Aloo Bhaja", price: 79 });

    const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(buyer, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    await expect(createOrder(buyer, { ...body, checkoutKey: crypto.randomUUID(), subscriptionId: String(subscription._id), coveredMealId: payload.slug }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    expect((await Subscription.findById(subscription._id)).remainingMeals).toBe(3);
  });
  it("applies a daily override without changing the weekly schedule", async () => {
    const date = kolkataDate(1);
    const meal = await Meal.findOne({ slug: "veg-home-meal" });
    expect((await getMenu(date)).find((entry) => entry.id === meal.slug).available).toBe(true);
    await DailyMenu.create({ meal: meal._id, date, availableOverride: false });
    expect((await getMenu(date)).find((entry) => entry.id === meal.slug).available).toBe(false);
  });

  it("rejects a checkout submitted after today's server cutoff", async () => {
    await KitchenSettings.create({ key: "primary", lunchCutoff: "00:00" });
    const body = { ...request(), serviceDate: kolkataDate() };
    await expect(createOrder(user(), body, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({
      status: 409,
      message: "Ordering for this meal period has just closed. Please choose another available meal period.",
    });
    expect(await Order.countDocuments()).toBe(0);
  });

  it("honors manual period and item availability without stock fields", async () => {
    await KitchenSettings.create({ key: "primary", lunchEnabled: false });
    await expect(createOrder(user(), request(), "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    await KitchenSettings.updateOne({ key: "primary" }, { lunchEnabled: true });
    const meal = await Meal.findOne({ slug: "veg-home-meal" });
    await DailyMenu.create({ meal: meal._id, date: kolkataDate(1), availableOverride: false });
    await expect(createOrder(user(), request(), "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    await DailyMenu.updateOne({ meal: meal._id, date: kolkataDate(1) }, { availableOverride: true });
    expect((await createOrder(user(), request(), "COD", { verifyDelivery: delivery })).orderStatus).toBe("confirmed");
  });

  it("accepts concurrent orders without applying legacy stock or capacity limits", async () => {
    await Meal.updateOne({ slug: "veg-home-meal" }, { stockLimit: 1 });
    await KitchenSettings.create({ key: "primary", dailyMaximum: 1, lunchMaximum: 1, dinnerMaximum: 1 });
    const attempts = await Promise.allSettled([createOrder(user(), request(), "COD", { verifyDelivery: delivery }), createOrder(user(), request(), "COD", { verifyDelivery: delivery })]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(2);
    expect(await Order.countDocuments()).toBe(2);
    expect(await DailyMenu.countDocuments()).toBe(0);
    expect(await DailyCapacity.countDocuments()).toBe(0);
  });

  it("replays an identical checkout key without creating a second order", async () => {
    const buyer = user(); const body = request();
    const first = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    const repeated = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(String(first._id)).toBe(String(repeated._id));
    expect(await Order.countDocuments()).toBe(1);
    expect(await DailyCapacity.countDocuments()).toBe(0);
  });

  it("accepts different meals even when historical capacity fields contain low values", async () => {
    await KitchenSettings.create({ key: "primary", dailyMaximum: 1, lunchMaximum: 1, dinnerMaximum: 1 });
    const attempts = await Promise.allSettled([
      createOrder(user(), request("veg-home-meal"), "COD", { verifyDelivery: delivery }),
      createOrder(user(), request("egg-curry-meal"), "COD", { verifyDelivery: delivery }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(2);
    expect(await Order.countDocuments()).toBe(2);
    expect(await DailyCapacity.countDocuments()).toBe(0);
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
    expect(await DailyCapacity.countDocuments()).toBe(0);
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

  it("requires delivery before confirming COD cash and records it only once", async () => {
    const order = await createOrder(user(), request(), "COD", { verifyDelivery: delivery });
    await expect(markCodPaymentReceived(order.orderNumber)).rejects.toMatchObject({ status: 409 });
    await updateOrderStatus(order.orderNumber, "delivered");
    const paid = await markCodPaymentReceived(order.orderNumber);
    expect(paid).toMatchObject({ orderStatus: "delivered", paymentStatus: "paid" });
    expect(paid.paymentReceivedAt).toBeTruthy();
    const repeated = await markCodPaymentReceived(order.orderNumber);
    expect(new Date(repeated.paymentReceivedAt).getTime()).toBe(new Date(paid.paymentReceivedAt).getTime());
    await expect(updateOrderStatus(order.orderNumber, "cancelled")).rejects.toMatchObject({ status: 409 });
  });

  it("lets only an admin confirm an already-delivered COD payment", async () => {
    const order = await createOrder(user(), request(), "COD", { verifyDelivery: delivery });
    await updateOrderStatus(order.orderNumber, "delivered");
    const makeRequest = () => new Request(`http://localhost/api/orders/${order.orderNumber}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_cod_received" }) });
    expect((await patchOrder(makeRequest(), { params: Promise.resolve({ orderId: order.orderNumber }) })).status).toBe(403);
    authState.role = "admin";
    const response = await patchOrder(makeRequest(), { params: Promise.resolve({ orderId: order.orderNumber }) });
    expect(response.status).toBe(200);
    expect((await response.json()).order.paymentStatus).toBe("paid");
  });

  it("does not allow a demo payment to be confirmed as COD cash", async () => {
    const order = await createOrder(user(), request(), "DEMO", { verifyDelivery: delivery });
    await updateOrderStatus(order.orderNumber, "delivered");
    await expect(markCodPaymentReceived(order.orderNumber)).rejects.toMatchObject({ status: 409 });
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
  it("refuses the legacy demo route for food orders", async () => {
    authState.id = String(user());
    const payload = request();
    const response = await createDemoPayment(new Request("http://localhost/api/demo-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "order", key: payload.checkoutKey, payload }) }));
    expect(response.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
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

describe("owner delivery and promo controls", () => {
  const jsonRequest = (path, method, body) => new Request(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("lets only the owner set the free-delivery minimum and uses it for actual orders", async () => {
    const settings = { acceptingOrders: true, lunchEnabled: true, dinnerEnabled: true, lunchCutoff: "11:00", dinnerCutoff: "18:00", freeDeliveryThreshold: 100 };
    expect((await patchAdminSettings(jsonRequest("/api/admin/settings", "PATCH", settings))).status).toBe(403);
    authState.role = "admin";
    expect((await patchAdminSettings(jsonRequest("/api/admin/settings", "PATCH", { ...settings, freeDeliveryThreshold: -1 }))).status).toBe(400);
    expect((await patchAdminSettings(jsonRequest("/api/admin/settings", "PATCH", settings))).status).toBe(200);
    expect((await (await getPublicSettings()).json()).settings.freeDeliveryThreshold).toBe(100);
    authState.role = "customer";
    const free = await createOrder(user(), request(), "COD", { verifyDelivery: delivery });
    expect(free.deliveryFee).toBe(0);
    await KitchenSettings.updateOne({ key: "primary" }, { freeDeliveryThreshold: 1000 });
    const paid = await createOrder(user(), request(), "COD", { verifyDelivery: delivery });
    expect(paid.deliveryFee).toBe(20);
  });

  it("creates custom and random codes in admin, without revealing them publicly", async () => {
    const form = { code: "LUNCH15", type: "percent", value: 15, maxDiscount: 50, minSubtotal: 100 };
    expect((await createAdminPromo(jsonRequest("/api/admin/promos", "POST", form))).status).toBe(403);
    authState.role = "admin";
    expect((await createAdminPromo(jsonRequest("/api/admin/promos", "POST", form))).status).toBe(201);
    expect((await createAdminPromo(jsonRequest("/api/admin/promos", "POST", form))).status).toBe(409);
    const random = await createAdminPromo(jsonRequest("/api/admin/promos", "POST", { ...form, code: "", generateRandom: true }));
    expect(random.status).toBe(201);
    expect((await random.json()).promo.code).toMatch(/^GKB-[A-F0-9]{10}$/);
    const listing = await getAdminPromos();
    expect((await listing.json()).promos.map((item) => item.code)).toContain("LUNCH15");
    authState.role = "customer";
    expect((await getAdminPromos()).status).toBe(403);
  });

  it("validates a code per account, discounts once and preserves checkout retries", async () => {
    authState.role = "admin";
    await createAdminPromo(jsonRequest("/api/admin/promos", "POST", { code: "SAVE20", type: "fixed", value: 20, minSubtotal: 0 }));
    authState.role = "customer";
    const buyer = user(); authState.id = String(buyer);
    const quote = await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "save20", subtotal: 119 }));
    expect((await quote.json()).promo).toMatchObject({ valid: true, code: "SAVE20", discount: 20 });
    const body = { ...request(), promoCode: "save20" };
    const order = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    expect(order).toMatchObject({ promoCode: "SAVE20", discount: 20 });
    expect((await createOrder(buyer, body, "COD", { verifyDelivery: delivery })).orderNumber).toBe(order.orderNumber);
    const used = await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "SAVE20", subtotal: 119 }));
    expect((await used.json()).promo).toMatchObject({ valid: false, discount: 0 });
    await expect(createOrder(buyer, { ...request(), promoCode: "SAVE20" }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 400 });
    const another = await createOrder(user(), { ...request(), promoCode: "SAVE20" }, "COD", { verifyDelivery: delivery });
    expect(another.discount).toBe(20);
  });

  it("rejects insufficient subtotal and a disabled code, while preserving WELCOME10", async () => {
    authState.role = "admin";
    await createAdminPromo(jsonRequest("/api/admin/promos", "POST", { code: "MIN200", type: "fixed", value: 50, minSubtotal: 200 }));
    authState.role = "customer";
    const buyer = user(); authState.id = String(buyer);
    await expect(createOrder(buyer, { ...request(), promoCode: "MIN200" }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 400 });
    authState.role = "admin";
    expect((await updateAdminPromo(jsonRequest("/api/admin/promos", "PATCH", { code: "MIN200", active: false }))).status).toBe(200);
    authState.role = "customer";
    expect((await (await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "MIN200", subtotal: 500 }))).json()).promo.valid).toBe(false);
    const welcome = await createOrder(buyer, { ...request(), promoCode: "WELCOME10" }, "COD", { verifyDelivery: delivery });
    expect(welcome.discount).toBeGreaterThan(0);
  });

  it("caps percentage discounts and reprices online orders on the server", async () => {
    authState.role = "admin";
    await createAdminPromo(jsonRequest("/api/admin/promos", "POST", { code: "HALFOFF", type: "percent", value: 50, maxDiscount: 25, minSubtotal: 0 }));
    await KitchenSettings.create({ key: "primary", onlinePaymentEnabled: true, upiId: "kitchen@upi" });
    authState.role = "customer";
    const buyer = user(); authState.id = String(buyer);
    const quote = await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "HALFOFF", subtotal: 119 }));
    expect((await quote.json()).promo.discount).toBe(25);
    const order = await createOrder(buyer, { ...request(), promoCode: "HALFOFF", paymentChannel: "upi_id" }, "manual_online", { verifyDelivery: delivery });
    expect(order).toMatchObject({ promoCode: "HALFOFF", discount: 25, paymentStatus: "pending" });
    expect(order.total).toBe(order.subtotal - order.discount + order.deliveryFee);
  });

  it("allows only one concurrent redemption of the same code by one account", async () => {
    authState.role = "admin";
    await createAdminPromo(jsonRequest("/api/admin/promos", "POST", { code: "RACE20", type: "fixed", value: 20, minSubtotal: 0 }));
    authState.role = "customer";
    const buyer = user();
    const attempts = await Promise.allSettled([
      createOrder(buyer, { ...request(), promoCode: "RACE20" }, "COD", { verifyDelivery: delivery }),
      createOrder(buyer, { ...request(), promoCode: "RACE20" }, "COD", { verifyDelivery: delivery }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await Order.countDocuments({ user: buyer, promoCode: "RACE20" })).toBe(1);
  });

  it("recognizes a WELCOME10 redemption from older orders without a saved promo code", async () => {
    const buyer = user(); authState.id = String(buyer);
    const oldOrder = await createOrder(buyer, request(), "COD", { verifyDelivery: delivery });
    await Order.updateOne({ _id: oldOrder._id }, { $set: { discount: 12, total: oldOrder.total - 12 }, $unset: { promoCode: 1 } });
    const quote = await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "WELCOME10", subtotal: 119 }));
    expect((await quote.json()).promo).toMatchObject({ valid: false, message: "You have already used this promo code." });
  });

  it("lets only the owner delete a code without losing order history or allowing reuse", async () => {
    authState.role = "admin";
    const form = { code: "DELETE20", type: "fixed", value: 20, minSubtotal: 0 };
    expect((await createAdminPromo(jsonRequest("/api/admin/promos", "POST", form))).status).toBe(201);
    authState.role = "customer";
    const buyer = user(); authState.id = String(buyer);
    const order = await createOrder(buyer, { ...request(), promoCode: "DELETE20" }, "COD", { verifyDelivery: delivery });
    const remove = () => deleteAdminPromo(jsonRequest("/api/admin/promos", "DELETE", { code: "DELETE20" }));
    expect((await remove()).status).toBe(403);
    authState.role = "admin";
    expect((await remove()).status).toBe(200);
    expect((await remove()).status).toBe(404);
    const stored = await PromoCode.findOne({ code: "DELETE20" });
    expect(stored).toMatchObject({ active: false });
    expect(stored.deletedAt).toBeTruthy();
    expect((await (await getAdminPromos()).json()).promos.map((item) => item.code)).not.toContain("DELETE20");
    expect((await createAdminPromo(jsonRequest("/api/admin/promos", "POST", form))).status).toBe(409);
    expect((await Order.findById(order._id)).promoCode).toBe("DELETE20");
    authState.role = "customer";
    expect((await (await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "DELETE20", subtotal: 119 }))).json()).promo.valid).toBe(false);
    await expect(createOrder(user(), { ...request(), promoCode: "DELETE20" }, "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 400 });
  });

  it("does not recreate a deleted WELCOME10 code", async () => {
    authState.role = "admin";
    expect((await getAdminPromos()).status).toBe(200);
    expect((await deleteAdminPromo(jsonRequest("/api/admin/promos", "DELETE", { code: "WELCOME10" }))).status).toBe(200);
    const listed = await getAdminPromos();
    expect((await listed.json()).promos.map((item) => item.code)).not.toContain("WELCOME10");
    authState.role = "customer";
    authState.id = String(user());
    const quote = await validateCustomerPromo(jsonRequest("/api/promos/validate", "POST", { code: "WELCOME10", subtotal: 119 }));
    expect((await quote.json()).promo.valid).toBe(false);
  });
});

describe("manual online payment", () => {
  async function setupOrder() {
    const buyer = user(); authState.id = String(buyer);
    await KitchenSettings.create({ key: "primary", onlinePaymentEnabled: true, upiId: "kitchen@upi", businessWhatsApp: "919876543210", codEnabled: true });
    const order = await createOrder(buyer, { ...request(), paymentChannel: "upi_id" }, "manual_online", { verifyDelivery: delivery });
    return order;
  }
  function proof(orderNumber, method = "whatsapp") {
    return submitPaymentProof(new Request(`http://localhost/api/orders/${orderNumber}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) }), { params: Promise.resolve({ orderId: orderNumber }) });
  }
  function verify(orderNumber, action, reason) {
    return verifyPayment(new Request(`http://localhost/api/orders/${orderNumber}/payment-verification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) }), { params: Promise.resolve({ orderId: orderNumber }) });
  }
  it("creates an unpaid order and blocks kitchen progress until admin verification", async () => {
    const order = await setupOrder();
    expect(order).toMatchObject({ paymentMethod: "manual_online", paymentStatus: "pending", orderStatus: "payment_pending", paymentChannel: "upi_id", paymentDetails: { upiId: "kitchen@upi" } });
    await expect(updateOrderStatus(order.orderNumber, "confirmed")).rejects.toMatchObject({ status: 409 });
    expect((await proof(order.orderNumber)).status).toBe(200);
    expect((await Order.findById(order._id)).paymentStatus).toBe("verification_pending");
    expect((await verify(order.orderNumber, "confirm")).status).toBe(403);
    authState.role = "admin";
    const confirmed = await verify(order.orderNumber, "confirm");
    expect(confirmed.status).toBe(200);
    expect((await Order.findById(order._id)).toObject()).toMatchObject({ paymentStatus: "paid", orderStatus: "confirmed", paymentProofMethod: "whatsapp" });
    expect((await verify(order.orderNumber, "confirm")).status).toBe(409);
  });
  it("lets a rejected payment be resubmitted on the same order", async () => {
    const order = await setupOrder();
    await proof(order.orderNumber);
    authState.role = "admin";
    expect((await verify(order.orderNumber, "reject", "Transaction not found")).status).toBe(200);
    expect((await Order.findById(order._id)).paymentStatus).toBe("rejected");
    authState.role = "customer";
    expect((await proof(order.orderNumber)).status).toBe(200);
    expect((await Order.findById(order._id)).paymentStatus).toBe("verification_pending");
    expect(await Order.countDocuments()).toBe(1);
  });
  it("rejects an unavailable online method and disabled COD", async () => {
    const buyer = user();
    await KitchenSettings.create({ key: "primary", onlinePaymentEnabled: false, codEnabled: false });
    await expect(createOrder(buyer, { ...request(), paymentChannel: "qr" }, "manual_online", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
    await expect(createOrder(buyer, request(), "COD", { verifyDelivery: delivery })).rejects.toMatchObject({ status: 409 });
  });
  it("restricts payment configuration to admins and exposes only checkout fields", async () => {
    authState.id = String(user());
    const body = { upiDisplayName: "GharKaBite", upiId: "kitchen@upi", upiPhoneNumber: "9876543210", businessWhatsApp: "919876543210", onlinePaymentEnabled: true, codEnabled: true };
    const save = () => patchAdminPaymentSettings(new Request("http://localhost/api/admin/payment-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect((await save()).status).toBe(403);
    authState.role = "admin";
    expect((await save()).status).toBe(200);
    const payment = (await (await getPublicPaymentSettings()).json()).payment;
    expect(payment).toMatchObject({ upiDisplayName: "GharKaBite", upiId: "kitchen@upi", upiPhoneNumber: "9876543210", onlinePaymentEnabled: true, codEnabled: true });
    expect(payment).not.toHaveProperty("dailyMaximum");
    expect(payment).not.toHaveProperty("_id");
  });
  it("accepts website proof only with a screenshot and rejects a reused UTR", async () => {
    const first = await setupOrder();
    const second = await createOrder(new mongoose.Types.ObjectId(authState.id), { ...request(), paymentChannel: "upi_id" }, "manual_online", { verifyDelivery: delivery });
    const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud"; process.env.CLOUDINARY_API_KEY = "testkey"; process.env.CLOUDINARY_API_SECRET = "testsecret";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ secure_url: "https://res.cloudinary.com/testcloud/image/authenticated/v1/gharkabite/payment-proofs/proof.png" })));
    const makeProof = (orderNumber, reference) => {
      const form = new FormData(); form.set("paymentReference", reference); form.set("screenshot", new File([Uint8Array.from([137,80,78,71,13,10,26,10])], "proof.png", { type: "image/png" }));
      return submitPaymentProof(new Request(`http://localhost/api/orders/${orderNumber}/payment-proof`, { method: "POST", body: form }), { params: Promise.resolve({ orderId: orderNumber }) });
    };
    try {
      expect((await makeProof(first.orderNumber, "UTR123456")).status).toBe(200);
      expect((await Order.findById(first._id)).paymentScreenshotUrl).toContain("payment-proofs");
      const duplicate = await makeProof(second.orderNumber, "UTR123456");
      expect(duplicate.status).toBe(409);
      expect((await duplicate.json()).message).toMatch(/already associated/);
      expect((await Order.findById(second._id)).paymentStatus).toBe("pending");
    } finally {
      vi.unstubAllGlobals();
      for (const [envKey, value] of [["CLOUDINARY_CLOUD_NAME", previous.cloud], ["CLOUDINARY_API_KEY", previous.key], ["CLOUDINARY_API_SECRET", previous.secret]]) { if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; }
    }
  });
  it("issues an order-bound authenticated upload signature and accepts its resulting URL", async () => {
    const order = await setupOrder();
    const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud"; process.env.CLOUDINARY_API_KEY = "testkey"; process.env.CLOUDINARY_API_SECRET = "testsecret";
    try {
      const context = { params: Promise.resolve({ orderId: order.orderNumber }) };
      const signedResponse = await signPaymentProof(new Request(`http://localhost/api/orders/${order.orderNumber}/payment-proof`), context);
      expect(signedResponse.status).toBe(200);
      const signed = await signedResponse.json();
      expect(signed.publicId).toContain(String(order._id));
      expect(signed.type).toBe("authenticated");
      expect(signed).not.toHaveProperty("secret");
      const screenshotUrl = `https://res.cloudinary.com/testcloud/image/authenticated/v1/${signed.publicId}.png`;
      let metadataBytes = 5 * 1024 * 1024 + 1;
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ secure_url: screenshotUrl, bytes: metadataBytes, format: "png" })));
      const submit = (url) => submitPaymentProof(new Request(`http://localhost/api/orders/${order.orderNumber}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "website", paymentReference: "UTR987654", screenshotUrl: url }) }), context);
      expect((await submit("https://evil.example/proof.png")).status).toBe(400);
      expect((await submit(screenshotUrl)).status).toBe(400);
      metadataBytes = 1024;
      expect((await submit(screenshotUrl)).status).toBe(200);
      expect((await Order.findById(order._id)).paymentScreenshotUrl).toBe(screenshotUrl);
    } finally {
      vi.unstubAllGlobals();
      for (const [envKey, value] of [["CLOUDINARY_CLOUD_NAME", previous.cloud], ["CLOUDINARY_API_KEY", previous.key], ["CLOUDINARY_API_SECRET", previous.secret]]) { if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; }
    }
  });
  it("serves authenticated proof only to the order owner or admin", async () => {
    const order = await setupOrder();
    const proofUrl = "https://res.cloudinary.com/testcloud/image/authenticated/v1/gharkabite/payment-proofs/proof.png";
    await Order.updateOne({ _id: order._id }, { paymentScreenshotUrl: proofUrl });
    const signedUrl = signedProofDownloadUrl(proofUrl, { cloud: "testcloud", key: "testkey", secret: "testsecret", timestamp: 1000 });
    expect(signedUrl).toContain("/image/download?");
    expect(signedUrl).toContain("type=authenticated");
    expect(signedUrl).not.toContain("testsecret");
    const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud"; process.env.CLOUDINARY_API_KEY = "testkey"; process.env.CLOUDINARY_API_SECRET = "testsecret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Uint8Array.from([137,80,78,71,13,10,26,10]), { headers: { "content-type": "image/png" } })));
    const retrieve = () => getPaymentScreenshot(new Request(`http://localhost/api/orders/${order.orderNumber}/payment-screenshot`), { params: Promise.resolve({ orderId: order.orderNumber }) });
    try {
      authState.id = String(user());
      expect((await retrieve()).status).toBe(404);
      authState.id = String(order.user);
      expect((await retrieve()).status).toBe(200);
      authState.role = "admin";
      authState.id = String(user());
      expect((await retrieve()).status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      for (const [envKey, value] of [["CLOUDINARY_CLOUD_NAME", previous.cloud], ["CLOUDINARY_API_KEY", previous.key], ["CLOUDINARY_API_SECRET", previous.secret]]) { if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; }
    }
  });
});

describe("owner profile photo", () => {
  it("keeps the initials fallback until an owner uploads a valid photo", async () => {
    const owner = await User.create({ name: "Test Owner", email: "owner@example.com", phone: "9876543211", passwordHash: "test", role: "admin" });
    authState.id = String(owner._id);
    authState.role = "admin";
    expect((await getAdminAvatar()).status).toBe(200);
    expect((await (await getAdminAvatar()).json()).avatarUrl).toBe("");

    const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
    process.env.CLOUDINARY_API_KEY = "testkey";
    process.env.CLOUDINARY_API_SECRET = "testsecret";
    const photoUrl = `https://res.cloudinary.com/testcloud/image/upload/v1/gharkabite/avatars/${owner._id}.png`;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ public_id: `gharkabite/avatars/${owner._id}`, secure_url: photoUrl })));
    const upload = (file) => { const form = new FormData(); form.set("file", file); return uploadAdminAvatar(new Request("http://localhost/api/admin/avatar", { method: "POST", body: form })); };
    try {
      const invalid = new File(["not an image"], "photo.png", { type: "image/png" });
      expect((await upload(invalid)).status).toBe(400);
      expect(await User.findById(owner._id).then((record) => record.avatarUrl)).toBe("");

      const valid = new File([Uint8Array.from([137,80,78,71,13,10,26,10,1])], "photo.png", { type: "image/png" });
      expect((await upload(valid)).status).toBe(200);
      expect((await (await getAdminAvatar()).json()).avatarUrl).toBe(photoUrl);
      expect(await User.findById(owner._id).then((record) => record.avatarUrl)).toBe(photoUrl);
      authState.role = "customer";
      expect((await getAdminAvatar()).status).toBe(403);
      expect((await upload(valid)).status).toBe(403);
    } finally {
      vi.unstubAllGlobals();
      for (const [envKey, value] of [["CLOUDINARY_CLOUD_NAME", previous.cloud], ["CLOUDINARY_API_KEY", previous.key], ["CLOUDINARY_API_SECRET", previous.secret]]) { if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; }
    }
  });
});

describe("customer profile photo", () => {
  it("uploads a verified image and returns it with the customer profile", async () => {
    const customer = await User.create({ name: "Test Customer", email: "customer-photo@example.com", phone: "9876543212", passwordHash: "test" });
    authState.id = String(customer._id);
    const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
    process.env.CLOUDINARY_API_KEY = "testkey";
    process.env.CLOUDINARY_API_SECRET = "testsecret";
    const photoUrl = `https://res.cloudinary.com/testcloud/image/upload/v2/gharkabite/avatars/${customer._id}.png`;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ public_id: `gharkabite/avatars/${customer._id}`, secure_url: photoUrl })));
    const upload = (file) => { const form = new FormData(); form.set("file", file); return uploadCustomerAvatar(new Request("http://localhost/api/profile/avatar", { method: "POST", body: form })); };
    try {
      expect((await upload(new File(["fake"], "fake.png", { type: "image/png" }))).status).toBe(400);
      expect((await upload(new File([Uint8Array.from([137,80,78,71,13,10,26,10,1])], "photo.png", { type: "image/png" }))).status).toBe(200);
      const profile = await (await getCustomerProfile()).json();
      expect(profile.user.avatarUrl).toBe(photoUrl);
    } finally {
      vi.unstubAllGlobals();
      for (const [envKey, value] of [["CLOUDINARY_CLOUD_NAME", previous.cloud], ["CLOUDINARY_API_KEY", previous.key], ["CLOUDINARY_API_SECRET", previous.secret]]) { if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; }
    }
  });
});
