import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { createOrder, CheckoutError } from "@/lib/order-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";
import { orderResponse, privateOrderJson as json } from "@/lib/order-response";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const filter = session.user.role === "admin" ? {} : { user: session.user.id };
    if (session.user.role === "admin") {
      const payment = new URL(request.url).searchParams.get("paymentStatus");
      if (payment === "COD") filter.paymentMethod = "COD";
      else if (["pending", "verification_pending", "paid", "rejected"].includes(payment)) filter.paymentStatus = payment;
    }
    const orders = await Order.find(filter).select("-paymentScreenshotUrl -paymentDetails").sort({ createdAt: -1 }).limit(session.user.role === "admin" ? 500 : 100).lean();
    return json({ orders });
  } catch { return json({ message: "Order history is temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to place an order." }, { status: 401 });
  try {
    const body = await request.json();
    const method = body.paymentMethod === "manual_online" ? "manual_online" : body.paymentMethod === "COD" ? "COD" : null;
    if (!method) return json({ message: "Choose an available payment method." }, { status: 400 });
    const order = await createOrder(session.user.id, body, method, { requirePricingReview: true, beforeCreate: () => enforceRateLimit(request, "create-order", 12, 3600) });
    return json({ order: orderResponse(order) }, { status: 201 });
  } catch (error) { return json({ message: error instanceof CheckoutError ? error.message : error.message === "RATE_LIMITED" ? "Too many orders. Try later." : "Unable to place the order right now.", ...error.review }, { status: error.status || (error.message === "RATE_LIMITED" ? 429 : 503) }); }
}
