import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";
import { orderResponse, privateOrderJson as json } from "@/lib/order-response";
import { validProofRevision } from "@/lib/payment-settings";

const reasons = ["Transaction not found", "Wrong amount paid", "Invalid payment proof", "Screenshot unclear", "Duplicate transaction ID", "Other"];

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return json({ message: "Forbidden" }, { status: 403 });
  try {
    await enforceRateLimit(request, "verify-payment", 60, 3600);
    const { orderId } = await params;
    const { action, reason, expectedProofRevision } = await request.json().catch(() => null) || {};
    if (!["confirm", "reject"].includes(action)) return json({ message: "Choose a payment action." }, { status: 400 });
    if (action === "reject" && !reasons.includes(reason)) return json({ message: "Choose a rejection reason." }, { status: 400 });
    if (!validProofRevision(expectedProofRevision)) return json({ message: "Load the current proof before verifying it." }, { status: 400 });
    await dbConnect();
    const filter = { orderNumber: orderId, paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending", paymentProofRevision: expectedProofRevision };
    const current = await Order.findOne(filter).lean();
    if (!current) return json({ message: "This proof changed or is no longer awaiting verification. Review the current order." }, { status: 409 });
    if (action === "confirm" && current.paymentReference) {
      const duplicate = await Order.exists({ _id: { $ne: current._id }, paymentReference: current.paymentReference, paymentStatus: "paid" });
      if (duplicate) return json({ message: "This Transaction ID is already paid on another order. Investigate before confirming." }, { status: 409 });
    }
    const now = new Date();
    const set = action === "confirm" ? { paymentStatus: "paid", orderStatus: "confirmed", paymentVerifiedAt: now, paymentVerifiedBy: session.user.id, paymentReceivedAt: now, paymentRejectionReason: "" } : { paymentStatus: "rejected", paymentRejectionReason: reason };
    const update = action === "confirm" ? { $set: set, $push: { statusHistory: { status: "confirmed", timestamp: now } } } : { $set: set };
    const order = await Order.findOneAndUpdate({ ...filter, _id: current._id }, update, { returnDocument: "after", runValidators: true }).lean();
    if (!order) return json({ message: "Payment state changed. Review the current proof before trying again." }, { status: 409 });
    return json({ order: orderResponse(order), message: action === "confirm" ? "Payment verified. Order confirmed." : "Payment rejected. Customer may resubmit proof." });
  } catch (error) { return json({ message: error.code === 11000 ? "This Transaction ID is already associated with another order. Review the evidence." : error.message === "RATE_LIMITED" ? "Too many attempts. Try later." : "Payment could not be updated." }, { status: error.code === 11000 ? 409 : error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
