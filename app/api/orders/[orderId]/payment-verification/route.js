import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";

const reasons = ["Transaction not found", "Wrong amount paid", "Invalid payment proof", "Screenshot unclear", "Duplicate transaction ID", "Other"];

export async function PATCH(request, { params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    await enforceRateLimit(request, "verify-payment", 60, 3600);
    const { orderId } = await params;
    const { action, reason } = await request.json();
    if (!["confirm", "reject"].includes(action)) return Response.json({ message: "Choose a payment action." }, { status: 400 });
    if (action === "reject" && !reasons.includes(reason)) return Response.json({ message: "Choose a rejection reason." }, { status: 400 });
    await dbConnect();
    const current = await Order.findOne({ orderNumber: orderId, paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending" }).lean();
    if (!current) return Response.json({ message: "This payment is no longer awaiting verification." }, { status: 409 });
    if (action === "confirm" && current.paymentReference) {
      const duplicate = await Order.exists({ _id: { $ne: current._id }, paymentReference: current.paymentReference, paymentStatus: "paid" });
      if (duplicate) return Response.json({ message: "This Transaction ID is already paid on another order. Investigate before confirming." }, { status: 409 });
    }
    const now = new Date();
    const set = action === "confirm" ? { paymentStatus: "paid", orderStatus: "confirmed", paymentVerifiedAt: now, paymentVerifiedBy: session.user.id, paymentReceivedAt: now, paymentRejectionReason: "" } : { paymentStatus: "rejected", paymentRejectionReason: reason };
    const update = action === "confirm" ? { $set: set, $push: { statusHistory: { status: "confirmed", timestamp: now } } } : { $set: set };
    const order = await Order.findOneAndUpdate({ _id: current._id, paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending" }, update, { returnDocument: "after", runValidators: true }).select("-paymentScreenshotUrl").lean();
    if (!order) return Response.json({ message: "Payment state changed. Refresh and try again." }, { status: 409 });
    return Response.json({ order, message: action === "confirm" ? "Payment verified. Order confirmed." : "Payment rejected. Customer may resubmit proof." });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many attempts. Try later." : "Payment could not be updated." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
