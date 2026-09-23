import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { updateOrderStatus, markCodPaymentReceived, CheckoutError } from "@/lib/order-service";
import Order from "@/models/Order";

export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const { orderId } = await params;
  try {
    await dbConnect();
    const order = await Order.findOne(session.user.role === "admin" ? { orderNumber: orderId } : { orderNumber: orderId, user: session.user.id }).select("-paymentScreenshotUrl").lean();
    if (!order) return Response.json({ message: "Order not found." }, { status: 404 });
    return Response.json({ order });
  } catch { return Response.json({ message: "Order details are temporarily unavailable." }, { status: 503 }); }
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { orderId } = await params;
  try {
    const { status, action } = await request.json();
    await dbConnect();
    if (action === "confirm_cod_received") return Response.json({ order: await markCodPaymentReceived(orderId), message: "Cash received. Order completed." });
    return Response.json({ order: await updateOrderStatus(orderId, status), message: "Order status updated." });
  } catch (error) { return Response.json({ message: error instanceof CheckoutError ? error.message : "Unable to update order." }, { status: error.status || 503 }); }
}
