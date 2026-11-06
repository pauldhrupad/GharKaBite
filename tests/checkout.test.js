import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const authState = vi.hoisted(() => ({ id: null, role: "customer" }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: authState.id, role: authState.role } }) }));
vi.mock("@/lib/delivery", () => ({ checkDelivery: async () => ({ serviceable: true }), validLocation: (location) => typeof location?.lat === "number" && typeof location?.lon === "number" && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180 }));

let replica, mongoose, Meal, DailyMenu, DailyCapacity, Order, Subscription, SubscriptionPlan, KitchenSettings, DemoPayment, PromoCode, User;
let getMenu, seedCatalog, kolkataDate, createOrder, updateOrderStatus, markCodPaymentReceived, purchaseSubscription, setSubscriptionStatus;
let createDemoPayment, completeDemoPayment, submitPaymentProof, signPaymentProof, verifyPayment, getPaymentScreenshot, signedProofDownloadUrl;
let patchOrder, getOrder, getOrders, postOrder;
let getPublicPaymentSettings, patchAdminPaymentSettings;
let getPublicSettings, patchAdminSettings, getAdminPromos, createAdminPromo, updateAdminPromo, deleteAdminPromo, validateCustomerPromo;
let getAdminAvatar, uploadAdminAvatar;
let getCustomerProfile, uploadCustomerAvatar;
let createAdminThali;
let getAdminOrderAlerts, getCustomerNavSummary;
let getFavorites, postFavorite, getFavorite, patchFavorite, deleteFavorite, getCustomerShortcut;
const user = () => new mongoose.Types.ObjectId();
const delivery = async () => ({ serviceable: true });
process.env.AUTH_SECRET ||= "isolated-quote-test-secret-not-for-production";
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
  ({ GET: getOrder, PATCH: patchOrder } = await import("@/app/api/orders/[orderId]/route"));
  ({ GET: getOrders, POST: postOrder } = await import("@/app/api/orders/route"));
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
  ({ GET: getFavorites, POST: postFavorite } = await import("@/app/api/favorites/route"));
  ({ GET: getFavorite, PATCH: patchFavorite, DELETE: deleteFavorite } = await import("@/app/api/favorites/[id]/route"));
  ({ GET: getCustomerShortcut } = await import("@/app/api/customer-shortcut/route"));
  const { default: dbConnect } = await import("@/lib/dbConnect");
  await dbConnect();
  await Promise.all([Meal.init(), DailyMenu.init(), DailyCapacity.init(), Order.init(), Subscription.init(), SubscriptionPlan.init(), KitchenSettings.init(), DemoPayment.init(), PromoCode.init()]);
});
afterAll(async () => { if (mongoose?.connection?.readyState) await mongoose.disconnect(); if (replica) await replica.stop(); });
beforeEach(async () => { authState.role = "customer"; authState.id = null; for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); await seedCatalog(); });

it("rechecks the current role even when the signed session claims owner access", async () => {
  const { currentSessionRole } = await import("@/lib/admin-access");
  const owner = await User.create({ name: "Revocable Owner", email: "revocable@example.test", phone: "9876543231", passwordHash: "test", role: "admin" });
  const existingToken = { id: String(owner._id), role: "admin" };
  expect(await currentSessionRole(existingToken)).toBe("admin");
  await User.updateOne({ _id: owner._id }, { $set: { role: "customer" } });
  expect(await currentSessionRole(existingToken)).toBe("customer");
  expect(await currentSessionRole({ id: String(user()), role: "admin" })).toBe("customer");
});

describe("private customer meals", () => {
  const jsonRequest = (method, body) => new Request("http://localhost/api/favorites", { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const favoriteBody = { name: "My usual", mealId: "veg-home-meal", preferredPeriod: "Lunch", quantity: 1, selectedChoices: { base: ["rice"] }, selectedAddOns: {} };
  const context = (id) => ({ params: Promise.resolve({ id }) });
  const account = (index) => User.create({ name: `Repeat buyer ${index}`, email: `repeat-${index}@example.test`, phone: `987654320${index}`, passwordHash: "test" });

  it("saves actual selections and the current server price, renames and removes only owned favorites", async () => {
    expect((await getFavorites()).status).toBe(401);
    expect((await postFavorite(jsonRequest("POST", favoriteBody))).status).toBe(401);
    const [owner, stranger] = await Promise.all([account(1), account(2)]);
    authState.id = String(owner._id);
    const meal = await Meal.findOne({ slug: favoriteBody.mealId }).lean();
    const extra = meal.addOns.find((item) => item.active);
    const selection = { ...favoriteBody, selectedAddOns: extra ? { [extra.id]: 1 } : {} };
    const created = await postFavorite(jsonRequest("POST", { ...selection, price: 1, user: String(stranger._id) }));
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const { favorite } = await created.json();
    expect(favorite).toMatchObject({ name: "My usual", price: meal.price + (extra?.price || 0), selectedChoices: { base: ["rice"] }, selectedAddOns: selection.selectedAddOns });
    expect(favorite.fixedItems.length).toBeGreaterThan(0);
    expect(favorite).not.toHaveProperty("signature");
    expect((await (await getCustomerShortcut()).json()).shortcut).toMatchObject({ type: "favorite", id: favorite.id });
    const repeat = await postFavorite(jsonRequest("POST", { ...selection, name: "Don’t overwrite" }));
    expect((await repeat.json())).toMatchObject({ favorite: { id: favorite.id, name: favorite.name }, duplicate: true });
    expect((await getFavorite(jsonRequest("GET"), context(favorite.id))).status).toBe(200);
    authState.id = String(stranger._id); authState.role = "admin";
    expect((await (await getFavorites()).json()).favorites).toEqual([]);
    expect((await getFavorite(jsonRequest("GET"), context(favorite.id))).status).toBe(404);
    expect((await patchFavorite(jsonRequest("PATCH", { name: "Other account" }), context(favorite.id))).status).toBe(404);
    expect((await deleteFavorite(jsonRequest("DELETE"), context(favorite.id))).status).toBe(404);
    authState.id = String(owner._id); authState.role = "customer";
    expect((await patchFavorite(jsonRequest("PATCH", { name: "Weekday lunch" }), context(favorite.id))).status).toBe(200);
    expect((await (await getFavorites()).json()).favorites).toMatchObject([{ id: favorite.id, name: "Weekday lunch" }]);
    expect((await deleteFavorite(jsonRequest("DELETE"), context(favorite.id))).status).toBe(200);
    expect((await (await getFavorites()).json()).favorites).toEqual([]);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("atomically prevents duplicates and limits concurrent writes at 20", async () => {
    authState.id = String((await account(1))._id);
    const save = (body) => postFavorite(jsonRequest("POST", body));
    const duplicate = await Promise.all([save(favoriteBody), save(favoriteBody)]);
    expect(duplicate.map((response) => response.status).sort()).toEqual([200, 201]);
    for (const period of ["Lunch", "Dinner"]) {
      for (let quantity = period === "Lunch" ? 2 : 1; quantity <= (period === "Lunch" ? 10 : 9); quantity++) {
        expect((await save({ ...favoriteBody, preferredPeriod: period, quantity })).status).toBe(201);
      }
    }
    const last = await Promise.all([save({ ...favoriteBody, preferredPeriod: "Dinner", quantity: 10 }), save({ ...favoriteBody, mealId: "chicken-home-meal" })]);
    expect(last.map((response) => response.status).sort()).toEqual([201, 409]);
    expect((await (await getFavorites()).json()).favorites).toHaveLength(20);
  });

  it("rejects invalid IDs, unavailable choices and wrong periods when saving", async () => {
    authState.id = String((await account(1))._id);
    expect((await postFavorite(jsonRequest("POST", { ...favoriteBody, selectedChoices: { base: ["not-a-base"] } }))).status).toBe(400);
    expect((await postFavorite(jsonRequest("POST", { ...favoriteBody, quantity: 11 }))).status).toBe(400);
    await Meal.updateOne({ slug: favoriteBody.mealId }, { $set: { slots: ["Dinner"] } });
    expect((await postFavorite(jsonRequest("POST", favoriteBody))).status).toBe(409);
    expect((await getFavorite(jsonRequest("GET"), context("not-an-id"))).status).toBe(404);
  });

  it("resolves owned order numbers, projects all original lines and keeps the customer history private", async () => {
    const [owner, other] = await Promise.all([account(1), account(2)]);
    const original = request();
    original.items.push({ ...original.items[0], quantity: 2, selectedChoices: { base: ["roti"] } });
    const own = await createOrder(owner._id, original, "COD", { verifyDelivery: delivery });
    const foreign = await createOrder(other._id, request(), "COD", { verifyDelivery: delivery });
    const read = (orderId) => getOrder(new Request("http://localhost/order?view=reorder"), { params: Promise.resolve({ orderId }) });
    authState.id = String(owner._id); authState.role = "admin";
    const result = await read(own.orderNumber);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const { order } = await result.json();
    expect(order.items.map((item) => item.quantity)).toEqual([1, 2]);
    expect(order.items[1].selectedChoices[0].options[0].id).toBe("roti");
    expect(order).not.toHaveProperty("deliveryAddress");
    expect((await read(String(own._id))).status).toBe(404);
    expect((await read(foreign.orderNumber)).status).toBe(404);
    const history = await getOrders(new Request("http://localhost/orders?view=mine"));
    expect((await history.json()).orders.map((item) => item.orderNumber)).toEqual([own.orderNumber]);
    expect((await (await getCustomerShortcut()).json()).shortcut).toBeNull();
    await Order.updateOne({ _id: own._id }, { $set: { orderStatus: "delivered" } });
    expect((await (await getCustomerShortcut()).json()).shortcut).toMatchObject({ type: "order", id: own.orderNumber, count: 2 });
  });

  it("reports only recorded service dates and states, with an explicit calendar cap", async () => {
    const [owner, other] = await Promise.all([account(1), account(2)]);
    const placed = await createOrder(owner._id, request(), "COD", { verifyDelivery: delivery });
    const template = await Order.findById(placed._id).lean();
    delete template._id; delete template.checkoutKey;
    const rows = [
      { ...template, orderNumber: "QA-PENDING", orderStatus: "payment_pending", paymentStatus: "pending", paymentMethod: "manual_online" },
      { ...template, orderNumber: "QA-CANCELLED", orderStatus: "cancelled" },
      { ...template, orderNumber: "QA-DELIVERED", orderStatus: "delivered" },
      { ...template, orderNumber: "QA-FOREIGN", user: other._id },
      { ...template, orderNumber: "QA-NO-DATE", serviceDate: null },
      { ...template, orderNumber: "QA-OUTSIDE", serviceDate: kolkataDate(7) },
    ];
    await Order.collection.insertMany(rows);
    authState.id = String(owner._id); authState.role = "admin";
    const read = () => getOrders(new Request("http://localhost/orders?view=calendar"));
    const result = await read();
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const calendar = await result.json();
    expect(calendar.days).toHaveLength(7);
    expect(calendar.orders.map((item) => item.orderStatus).sort()).toEqual(["cancelled", "confirmed", "delivered", "payment_pending"]);
    expect(calendar.truncated).toBe(false);
    expect(calendar.orders[0]).not.toHaveProperty("customer");
    await Order.collection.insertMany(Array.from({ length: 47 }, (_, index) => ({ ...template, orderNumber: `QA-CAP-${index}` })));
    const capped = await (await read()).json();
    expect(capped.truncated).toBe(true);
    expect(capped.orders).toHaveLength(50);
  });
});

describe("authoritative checkout quotes", () => {
  let quoteRoute, orderRoute;
  const post = (path, body) => new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const quote = async (body) => {
    const response = await quoteRoute(post("/api/orders/quote", body));
    expect(response.status).toBe(200);
    return (await response.json()).quote;
  };
  beforeAll(async () => {
    ({ POST: quoteRoute } = await import("@/app/api/orders/quote/route"));
    ({ POST: orderRoute } = await import("@/app/api/orders/route"));
  });
  it("requires authentication and never creates an order while quoting", async () => {
    const body = { ...request(), paymentMethod: "COD" };
    expect((await quoteRoute(post("/api/orders/quote", body))).status).toBe(401);
    expect((await orderRoute(post("/api/orders", body))).status).toBe(401);
    expect(await Order.countDocuments()).toBe(0);
    authState.id = String(user());
    const priced = await quote(body);
    const direct = await createOrder(authState.id, body, "COD", { verifyDelivery: delivery });
    expect(priced).toMatchObject({ subtotal: direct.subtotal, deliveryFee: direct.deliveryFee, total: direct.total });
    expect(await Order.countDocuments()).toBe(1);
  });
  it("rejects missing and tampered revisions before creating orders", async () => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    expect((await orderRoute(post("/api/orders", body))).status).toBe(409);
    const priced = await quote(body);
    expect((await orderRoute(post("/api/orders", { ...body, pricingRevision: priced.pricingRevision }))).status).toBe(409);
    const response = await orderRoute(post("/api/orders", { ...body, pricingRevision: `${priced.pricingRevision}tampered`, reviewedRevision: `${priced.pricingRevision}tampered` }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("PRICE_REVIEW_REQUIRED");
    expect(await Order.countDocuments()).toBe(0);
  });
  it.each(["customer", "quantity", "address", "contact", "slot", "period", "date", "choices", "payment", "promo", "credit"])("binds the signed quote to %s", async (field) => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    const priced = await quote(body);
    const changed = structuredClone(body);
    if (field === "customer") authState.id = String(user());
    if (field === "quantity") changed.items[0].quantity = 2;
    if (field === "address") changed.deliveryAddress.house = "99";
    if (field === "contact") changed.contact.name = "Another Customer";
    if (field === "slot") changed.deliverySlot = "1–2 PM";
    if (field === "period") { changed.mealPeriod = "Dinner"; changed.deliverySlot = "7–8 PM"; }
    if (field === "date") changed.serviceDate = "2000-01-01";
    if (field === "choices") changed.items[0].selectedChoices = { base: ["roti"] };
    if (field === "payment") changed.paymentChannel = "phone";
    if (field === "promo") changed.promoCode = "FORGED";
    if (field === "credit") changed.subscriptionId = String(user());
    const response = await orderRoute(post("/api/orders", { ...changed, pricingRevision: priced.pricingRevision, reviewedRevision: priced.pricingRevision }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await Order.countDocuments()).toBe(0);
  });
  it("requires explicit acknowledgement and a fresh quote after a price change", async () => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    const previous = await quote(body);
    await Meal.updateOne({ slug: "veg-home-meal" }, { $inc: { price: 10 } });
    const response = await orderRoute(post("/api/orders", { ...body, pricingRevision: previous.pricingRevision, reviewedRevision: previous.pricingRevision }));
    expect(response.status).toBe(409);
    const conflict = await response.json();
    expect(conflict.code).toBe("PRICE_REVIEW_REQUIRED");
    expect(conflict.previousQuote.total).toBe(previous.total);
    expect(await Order.countDocuments()).toBe(0);
    const fresh = await quote({ ...body, previousRevision: previous.pricingRevision });
    expect(fresh.requiresAcknowledgement).toBe(true);
    expect((await orderRoute(post("/api/orders", { ...body, pricingRevision: fresh.pricingRevision }))).status).toBe(409);
    expect((await orderRoute(post("/api/orders", { ...body, pricingRevision: fresh.pricingRevision, reviewedRevision: fresh.pricingRevision }))).status).toBe(201);
  });
  it("returns the same order on a lost-response retry even after pricing changes", async () => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    const priced = await quote(body);
    body.pricingRevision = priced.pricingRevision;
    body.reviewedRevision = priced.pricingRevision;
    const first = await orderRoute(post("/api/orders", body));
    expect(first.status).toBe(201);
    const created = (await first.json()).order;
    await Meal.updateOne({ slug: "veg-home-meal" }, { $inc: { price: 25 } });
    await KitchenSettings.updateOne({ key: "primary" }, { acceptingOrders: false }, { upsert: true });
    const replay = await orderRoute(post("/api/orders", body));
    expect(replay.status).toBe(201);
    expect((await replay.json()).order.orderNumber).toBe(created.orderNumber);
    for (let retry = 0; retry < 13; retry += 1) expect((await orderRoute(post("/api/orders", body))).status).toBe(201);
    expect(await Order.countDocuments()).toBe(1);
  });
  it("keeps expired signed quotes from creating an order", async () => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    const priced = await quote(body);
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    try {
      expect((await orderRoute(post("/api/orders", { ...body, pricingRevision: priced.pricingRevision, reviewedRevision: priced.pricingRevision }))).status).toBe(409);
      expect(await Order.countDocuments()).toBe(0);
    } finally { now.mockRestore(); }
  });
  it("retrieves an identical successful order after its service date has passed", async () => {
    const buyer = user(); const body = request();
    const order = await createOrder(buyer, body, "COD", { verifyDelivery: delivery });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${body.serviceDate}T23:59:59+05:30`).getTime() + 86400000);
    try {
      expect((await createOrder(buyer, body, "COD", { verifyDelivery: delivery })).orderNumber).toBe(order.orderNumber);
      expect(await Order.countDocuments()).toBe(1);
    } finally { vi.useRealTimers(); }
  });
  it("quotes credit coverage and extras without spending credits; stale quotes spend nothing", async () => {
    authState.id = String(user());
    const plan = await SubscriptionPlan.findOne({ slug: "trial" });
    const subscription = await purchaseSubscription(authState.id, { planId: String(plan._id), mode: "Mixed", purchaseKey: crypto.randomUUID() });
    const body = { ...request("egg-curry-meal"), paymentMethod: "COD", subscriptionId: String(subscription._id), coveredMealId: "egg-curry-meal" };
    body.items[0].selectedAddOns = { "extra-egg": 1 };
    const priced = await quote(body);
    expect(priced).toMatchObject({ subtotal: 159, coveredBasePrice: 139, total: 20, deliveryFee: 0 });
    expect((await Subscription.findById(subscription._id)).remainingMeals).toBe(subscription.remainingMeals);
    await Meal.updateOne({ slug: "egg-curry-meal" }, { $set: { "addOns.0.price": 30 } });
    expect((await orderRoute(post("/api/orders", { ...body, pricingRevision: priced.pricingRevision, reviewedRevision: priced.pricingRevision }))).status).toBe(409);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Subscription.findById(subscription._id)).remainingMeals).toBe(subscription.remainingMeals);
  });
  it("rejects concurrent replay duplicates and binds a key to its original payload", async () => {
    authState.id = String(user());
    const body = { ...request(), paymentMethod: "COD" };
    body.pricingRevision = (await quote(body)).pricingRevision;
    body.reviewedRevision = body.pricingRevision;
    const responses = await Promise.all([orderRoute(post("/api/orders", body)), orderRoute(post("/api/orders", body))]);
    const orders = await Promise.all(responses.map((response) => response.json()));
    expect(orders[0].order.orderNumber).toBe(orders[1].order.orderNumber);
    expect(await Order.countDocuments()).toBe(1);
    body.items[0].quantity = 2;
    expect((await orderRoute(post("/api/orders", body))).status).toBe(409);
  });
  it("still rate-limits new purchase attempts", async () => {
    authState.id = String(user());
    for (let index = 0; index < 13; index += 1) {
      const body = { ...request(), paymentMethod: "COD" };
      body.pricingRevision = (await quote(body)).pricingRevision;
      body.reviewedRevision = body.pricingRevision;
      expect((await orderRoute(post("/api/orders", body))).status).toBe(index < 12 ? 201 : 429);
    }
    expect(await Order.countDocuments()).toBe(12);
  });
  it.each(["choice", "extra", "delivery", "discount"])("requires review when %s pricing changes", async (part) => {
    authState.id = String(user());
    const body = { ...request("egg-curry-meal"), paymentMethod: "COD" };
    body.items[0].selectedAddOns = { "extra-egg": 1 };
    await PromoCode.create({ code: "TEST20", type: "fixed", value: 20, maxDiscount: 50, minSubtotal: 0, active: true });
    body.promoCode = "TEST20";
    const previous = await quote(body);
    if (part === "choice") await Meal.updateOne({ slug: "egg-curry-meal" }, { $set: { "choiceGroups.0.options.0.priceAdjustment": 5 } });
    if (part === "extra") await Meal.updateOne({ slug: "egg-curry-meal" }, { $set: { "addOns.0.price": 30 } });
    if (part === "delivery") await KitchenSettings.updateOne({ key: "primary" }, { freeDeliveryThreshold: 0 }, { upsert: true });
    if (part === "discount") await PromoCode.updateOne({ code: "TEST20" }, { value: 10 });
    const response = await orderRoute(post("/api/orders", { ...body, pricingRevision: previous.pricingRevision, reviewedRevision: previous.pricingRevision }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("PRICE_REVIEW_REQUIRED");
    expect(await Order.countDocuments()).toBe(0);
  });
});

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
    expect((await patchOrder(makeRequest(), { params: Promise.resolve({ orderId: order.orderNumber }) })).status).toBe(403);
    authState.id = String(user());
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
  async function complete(id, outcome) {
    return completeDemoPayment(new Request(`http://localhost/api/demo-payments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }), { params: Promise.resolve({ id }) });
  }
  it("refuses the legacy demo route for food orders", async () => {
    authState.id = String(user());
    const payload = request();
    const response = await createDemoPayment(new Request("http://localhost/api/demo-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "order", key: payload.checkoutKey, payload }) }));
    expect(response.status).toBe(410);
    expect(await Order.countDocuments()).toBe(0);
  });
  it("requires authentication on both retired preview routes", async () => {
    expect((await createDemoPayment()).status).toBe(401);
    expect((await completeDemoPayment()).status).toBe(401);
  });
  it("does not parse a request or create a purchase intent", async () => {
    authState.id = String(user());
    const json = vi.fn(() => { throw new Error("Must not process retired purchases"); });
    expect((await createDemoPayment({ json })).status).toBe(410);
    expect((await completeDemoPayment({ json }, { params: Promise.resolve({ id: "invalid" }) })).status).toBe(410);
    expect(json).not.toHaveBeenCalled();
    expect(await DemoPayment.countDocuments()).toBe(0);
    expect(await Subscription.countDocuments()).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
  });
  it.each(["pending", "processing", "paid"])("blocks %s preview intents without changing stored records", async (status) => {
    authState.id = String(user());
    const intent = await DemoPayment.create({ user: authState.id, key: crypto.randomUUID(), kind: "subscription", payload: {}, payloadHash: "legacy-preview", status, processingAt: new Date(Date.now() - 180000), expiresAt: new Date(Date.now() + 600000) });
    expect((await complete(String(intent._id), "success")).status).toBe(410);
    expect((await DemoPayment.findById(intent._id)).status).toBe(status);
    expect(await DemoPayment.countDocuments()).toBe(1);
    expect(await Subscription.countDocuments()).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
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
  function proof(orderNumber, expectedProofRevision = null, method = "whatsapp") {
    return submitPaymentProof(new Request(`http://localhost/api/orders/${orderNumber}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, expectedProofRevision }) }), { params: Promise.resolve({ orderId: orderNumber }) });
  }
  function verify(orderNumber, action, expectedProofRevision, reason) {
    return verifyPayment(new Request(`http://localhost/api/orders/${orderNumber}/payment-verification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason, expectedProofRevision }) }), { params: Promise.resolve({ orderId: orderNumber }) });
  }
  it("creates an unpaid order and blocks kitchen progress until admin verification", async () => {
    const order = await setupOrder();
    expect(order).toMatchObject({ paymentMethod: "manual_online", paymentStatus: "pending", orderStatus: "payment_pending", paymentChannel: "upi_id", paymentDetails: { upiId: "kitchen@upi" } });
    await expect(updateOrderStatus(order.orderNumber, "confirmed")).rejects.toMatchObject({ status: 409 });
    const submitted = await proof(order.orderNumber);
    expect(submitted.status).toBe(200);
    const revision = (await submitted.json()).order.paymentProofRevision;
    expect(revision).toMatch(/^[\da-f-]{36}$/);
    expect((await Order.findById(order._id)).paymentStatus).toBe("verification_pending");
    expect((await verify(order.orderNumber, "confirm")).status).toBe(403);
    authState.role = "admin";
    const confirmed = await verify(order.orderNumber, "confirm", revision);
    expect(confirmed.status).toBe(200);
    expect((await Order.findById(order._id)).toObject()).toMatchObject({ paymentStatus: "paid", orderStatus: "confirmed", paymentProofMethod: "whatsapp" });
    expect((await verify(order.orderNumber, "confirm", revision)).status).toBe(409);
  });
  it("lets a rejected payment be resubmitted on the same order", async () => {
    const order = await setupOrder();
    const firstRevision = (await (await proof(order.orderNumber)).json()).order.paymentProofRevision;
    authState.role = "admin";
    expect((await verify(order.orderNumber, "reject", firstRevision, "Transaction not found")).status).toBe(200);
    expect((await Order.findById(order._id)).paymentStatus).toBe("rejected");
    authState.role = "customer";
    expect((await proof(order.orderNumber)).status).toBe(409);
    const resubmitted = await proof(order.orderNumber, firstRevision);
    expect(resubmitted.status).toBe(200);
    const secondRevision = (await resubmitted.json()).order.paymentProofRevision;
    expect(secondRevision).not.toBe(firstRevision);
    authState.role = "admin";
    expect((await verify(order.orderNumber, "confirm", firstRevision)).status).toBe(409);
    const racing = await Promise.all([verify(order.orderNumber, "confirm", secondRevision), verify(order.orderNumber, "reject", secondRevision, "Wrong amount paid")]);
    expect(racing.map((response) => response.status).sort()).toEqual([200, 409]);
    const result = await Order.findById(order._id);
    expect(["paid:confirmed", "rejected:payment_pending"]).toContain(`${result.paymentStatus}:${result.orderStatus}`);
    expect(await Order.countDocuments()).toBe(1);
  });
  it("requires an explicit revision for legacy proof submission and verification", async () => {
    const order = await setupOrder();
    const context = { params: Promise.resolve({ orderId: order.orderNumber }) };
    const request = new Request("http://localhost/proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "whatsapp" }) });
    expect((await submitPaymentProof(request, context)).status).toBe(400);
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "verification_pending", paymentProofMethod: "whatsapp" }, $unset: { paymentProofRevision: 1 } });
    authState.role = "admin";
    expect((await verify(order.orderNumber, "confirm")).status).toBe(400);
    expect((await verify(order.orderNumber, "confirm", null)).status).toBe(200);
  });
  it("accepts only one concurrent submission for the same proof revision", async () => {
    const order = await setupOrder();
    const attempts = await Promise.all([proof(order.orderNumber), proof(order.orderNumber)]);
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await Order.findById(order._id).lean()).toMatchObject({ paymentStatus: "verification_pending", orderStatus: "payment_pending" });
  });
  it("projects private order reads, rejects other customers, and pauses obsolete destinations without blocking proof", async () => {
    const order = await setupOrder();
    const context = { params: Promise.resolve({ orderId: order.orderNumber }) };
    const load = (query = "") => getOrder(new Request(`http://localhost/order${query}`), context);
    expect((await (await load()).json()).payment.destinations.upiId).toBe("kitchen@upi");
    await KitchenSettings.updateOne({ key: "primary" }, { $set: { upiId: "replacement@upi" } });
    const read = await load("?view=status");
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    const result = await read.json();
    expect(result.payment).toMatchObject({ availability: "paused", destinations: {} });
    expect(result.order).not.toHaveProperty("deliveryAddress");
    expect(JSON.stringify(result)).not.toMatch(/kitchen@upi|replacement@upi/);
    expect((await proof(order.orderNumber)).status).toBe(200);
    authState.id = String(user());
    expect((await load()).status).toBe(404);
    expect((await proof(order.orderNumber)).status).toBe(404);
    authState.id = null;
    expect((await load()).status).toBe(401);
  });
  it("does not serialize proof URLs or old destinations through lists, status mutations or checkout replay", async () => {
    const order = await setupOrder();
    await Order.updateOne({ _id: order._id }, { $set: { paymentScreenshotUrl: "https://res.cloudinary.com/private-fixture", paymentStatus: "paid", orderStatus: "confirmed" } });
    const replay = await postOrder(new Request("http://localhost/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request("veg-home-meal", order.checkoutKey), paymentChannel: "upi_id", paymentMethod: "manual_online" }) }));
    expect(replay.status).toBe(201);
    const replayed = (await replay.json()).order;
    expect(replayed.orderNumber).toBe(order.orderNumber);
    expect(replayed).not.toHaveProperty("paymentScreenshotUrl");
    expect(replayed).not.toHaveProperty("paymentDetails");
    const listed = await getOrders(new Request("http://localhost/api/orders"));
    expect(listed.headers.get("cache-control")).toBe("private, no-store");
    expect((await listed.json()).orders[0]).not.toHaveProperty("paymentDetails");
    authState.role = "admin";
    const response = await patchOrder(new Request("http://localhost/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cooking" }) }), { params: Promise.resolve({ orderId: order.orderNumber }) });
    expect(response.status).toBe(200);
    expect((await response.json()).order).not.toHaveProperty("paymentScreenshotUrl");
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
    vi.stubGlobal("fetch", vi.fn(async (_url, { body }) => Response.json({ public_id: body.get("public_id"), resource_type: "image", type: "authenticated", bytes: 1024, format: "png", secure_url: `https://res.cloudinary.com/testcloud/image/authenticated/v1/${body.get("public_id")}.png` })));
    const makeProof = (orderNumber, reference, bytes = Uint8Array.from([137,80,78,71,13,10,26,10])) => {
      const form = new FormData(); form.set("expectedProofRevision", ""); form.set("paymentReference", reference); form.set("screenshot", new File([bytes], "proof.png", { type: "image/png" }));
      return submitPaymentProof(new Request(`http://localhost/api/orders/${orderNumber}/payment-proof`, { method: "POST", body: form }), { params: Promise.resolve({ orderId: orderNumber }) });
    };
    try {
      expect((await makeProof(first.orderNumber, "UTR123456", "fake PNG")).status).toBe(400);
      expect((await makeProof(first.orderNumber, "UTR123456", new Uint8Array(5 * 1024 * 1024 + 1))).status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
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
      expect(signed.overwrite).toBe("false");
      expect(signed.allowed_formats).toBe("jpg,jpeg,png,webp");
      expect(signed.signature).toBe(crypto.createHash("sha1").update(`allowed_formats=${signed.allowed_formats}&overwrite=false&public_id=${signed.publicId}&timestamp=${signed.timestamp}&type=authenticatedtestsecret`).digest("hex"));
      expect(signed).not.toHaveProperty("secret");
      const screenshotUrl = `https://res.cloudinary.com/testcloud/image/authenticated/v1/${signed.publicId}.png`;
      let metadataBytes = 5 * 1024 * 1024 + 1;
      let assetId = signed.publicId;
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ public_id: assetId, resource_type: "image", type: "authenticated", secure_url: screenshotUrl, bytes: metadataBytes, format: "png" })));
      const submit = (url) => submitPaymentProof(new Request(`http://localhost/api/orders/${order.orderNumber}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "website", expectedProofRevision: null, paymentReference: "UTR987654", screenshotUrl: url }) }), context);
      expect((await submit("https://evil.example/proof.png")).status).toBe(400);
      expect((await submit(screenshotUrl)).status).toBe(400);
      metadataBytes = 1024;
      assetId = "another-proof";
      expect((await submit(screenshotUrl)).status).toBe(400);
      assetId = signed.publicId;
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
    const retrieve = (query = "") => getPaymentScreenshot(new Request(`http://localhost/api/orders/${order.orderNumber}/payment-screenshot${query}`), { params: Promise.resolve({ orderId: order.orderNumber }) });
    try {
      authState.id = null;
      const guest = await retrieve();
      expect(guest.status).toBe(401);
      expect(guest.headers.get("cache-control")).toBe("private, no-store");
      authState.id = String(user());
      expect((await retrieve()).status).toBe(404);
      authState.id = String(order.user);
      expect((await retrieve("?proofRevision=old")).status).toBe(409);
      expect(fetch).not.toHaveBeenCalled();
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
