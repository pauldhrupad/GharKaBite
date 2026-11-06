import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { updateOrderStatus, markCodPaymentReceived, CheckoutError } from "@/lib/order-service";
import Order from "@/models/Order";
import KitchenSettings from "@/models/KitchenSettings";
import { orderResponse, privateOrderJson as json } from "@/lib/order-response";
import { orderPaymentAvailability } from "@/lib/payment-settings";

const statusFields = "orderNumber orderStatus paymentStatus paymentMethod paymentChannel paymentDetails paymentReference paymentProofMethod paymentProofRevision paymentScreenshotUrl paymentSubmittedAt paymentVerifiedAt paymentReceivedAt paymentRejectionReason statusHistory total";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Unauthorized" }, { status: 401 });
  const { orderId } = await params;
  try {
    await dbConnect();
    const view = new URL(request.url).searchParams.get("view");
    if (view === "reorder") {
      const order = await Order.findOne({ orderNumber: orderId, user: session.user.id }).select("-_id orderNumber serviceDate mealPeriod items.mealId items.name items.quantity items.price items.fixedItems items.selectedChoices items.selectedAddOns").lean();
      return order ? json({ order }) : json({ message: "Order not found." }, { status: 404 });
    }
    const query = Order.findOne(session.user.role === "admin" ? { orderNumber: orderId } : { orderNumber: orderId, user: session.user.id });
    const order = await (view === "status" ? query.select(statusFields) : query).lean();
    if (!order) return json({ message: "Order not found." }, { status: 404 });
    const settings = order.paymentMethod === "manual_online" ? await KitchenSettings.findOne({ key: "primary" }).select("onlinePaymentEnabled upiId upiPhoneNumber upiDisplayName upiQrImage businessWhatsApp").lean().catch(() => null) : null;
    const proofUploadAvailable = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    return json({ order: orderResponse(order), payment: order.paymentMethod === "manual_online" ? orderPaymentAvailability(order, settings, proofUploadAvailable) : null });
  } catch { return json({ message: "Order details are temporarily unavailable." }, { status: 503 }); }
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return json({ message: "Forbidden" }, { status: 403 });
  const { orderId } = await params;
  try {
    const { status, action } = await request.json();
    await dbConnect();
    if (action === "confirm_cod_received") return json({ order: orderResponse(await markCodPaymentReceived(orderId)), message: "Cash received. Order completed." });
    return json({ order: orderResponse(await updateOrderStatus(orderId, status)), message: "Order status updated." });
  } catch (error) { return json({ message: error instanceof CheckoutError ? error.message : "Unable to update order." }, { status: error.status || 503 }); }
}
