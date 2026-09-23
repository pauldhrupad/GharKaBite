import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const authState = vi.hoisted(() => ({ id: null, role: "customer" }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: authState.id, role: authState.role } }) }));
vi.mock("@/lib/delivery", () => ({ checkDelivery: async () => ({ serviceable: true }), validLocation: (location) => typeof location?.lat === "number" && typeof location?.lon === "number" && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180 }));

let replica, mongoose, Meal, DailyMenu, DailyCapacity, Order, Subscription, SubscriptionPlan, KitchenSettings, DemoPayment;
let getMenu, seedCatalog, kolkataDate, createOrder, updateOrderStatus, markCodPaymentReceived, purchaseSubscription, setSubscriptionStatus;
let createDemoPayment, completeDemoPayment, submitPaymentProof, signPaymentProof, verifyPayment, getPaymentScreenshot, signedProofDownloadUrl;
let patchOrder;
let getPublicPaymentSettings, patchAdminPaymentSettings;
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
  const { default: dbConnect } = await import("@/lib/dbConnect");
  await dbConnect();
  await Promise.all([Meal.init(), DailyMenu.init(), DailyCapacity.init(), Order.init(), Subscription.init(), SubscriptionPlan.init(), KitchenSettings.init(), DemoPayment.init()]);
});
afterAll(async () => { if (mongoose?.connection?.readyState) await mongoose.disconnect(); if (replica) await replica.stop(); });
beforeEach(async () => { authState.role = "customer"; for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); await seedCatalog(); });

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
