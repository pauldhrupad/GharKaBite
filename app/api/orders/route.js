import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { createOrder, CheckoutError } from "@/lib/order-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const orders = await Order.find(session.user.role === "admin" ? {} : { user: session.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return Response.json({ orders });
  } catch { return Response.json({ message: "Order history is temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to place an order." }, { status: 401 });
  try {
    await enforceRateLimit(request, "cod-order", 12, 3600);
    const body = await request.json();
    const order = await createOrder(session.user.id, body, "COD");
    return Response.json({ order }, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof CheckoutError ? error.message : error.message === "RATE_LIMITED" ? "Too many orders. Try later." : "Unable to place the order right now." }, { status: error.status || (error.message === "RATE_LIMITED" ? 429 : 503) }); }
}
