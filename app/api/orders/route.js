import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { createOrder, CheckoutError } from "@/lib/order-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const filter = session.user.role === "admin" ? {} : { user: session.user.id };
    if (session.user.role === "admin") {
      const payment = new URL(request.url).searchParams.get("paymentStatus");
      if (payment === "COD") filter.paymentMethod = "COD";
      else if (["pending", "verification_pending", "paid", "rejected"].includes(payment)) filter.paymentStatus = payment;
    }
    const orders = await Order.find(filter).select("-paymentScreenshotUrl").sort({ createdAt: -1 }).limit(session.user.role === "admin" ? 500 : 100).lean();
    return Response.json({ orders });
  } catch { return Response.json({ message: "Order history is temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to place an order." }, { status: 401 });
  try {
    await enforceRateLimit(request, "create-order", 12, 3600);
    const body = await request.json();
    const method = body.paymentMethod === "manual_online" ? "manual_online" : body.paymentMethod === "COD" ? "COD" : null;
    if (!method) return Response.json({ message: "Choose an available payment method." }, { status: 400 });
    const order = await createOrder(session.user.id, body, method);
    return Response.json({ order }, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof CheckoutError ? error.message : error.message === "RATE_LIMITED" ? "Too many orders. Try later." : "Unable to place the order right now." }, { status: error.status || (error.message === "RATE_LIMITED" ? 429 : 503) }); }
}
