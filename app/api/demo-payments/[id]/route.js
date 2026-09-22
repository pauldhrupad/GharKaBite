import mongoose from "mongoose";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { createOrder, CheckoutError } from "@/lib/order-service";
import { purchaseSubscription } from "@/lib/subscription-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import DemoPayment from "@/models/DemoPayment";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";

export async function POST(request, { params }) {
  const authSession = await auth();
  if (!authSession?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Payment attempt not found." }, { status: 404 });
  let claimed = false;
  try {
    await enforceRateLimit(request, "demo-complete", 20, 3600);
    const { outcome } = await request.json();
    if (!["success", "failure"].includes(outcome)) return Response.json({ message: "Choose demo success or failure." }, { status: 400 });
    await dbConnect();
    const intent = await DemoPayment.findOne({ _id: id, user: authSession.user.id });
    if (!intent) return Response.json({ message: "Payment attempt not found." }, { status: 404 });
    if (intent.status === "failed") return Response.json({ message: "This demo payment failed. Start a new checkout." }, { status: 409 });
    if (intent.status === "paid") {
      const result = intent.kind === "order" ? await Order.findById(intent.resultId).lean() : await Subscription.findById(intent.resultId).lean();
      return Response.json({ result, kind: intent.kind, demo: true });
    }
    if (intent.expiresAt < new Date()) return Response.json({ message: "Demo checkout expired. Start again." }, { status: 409 });
    if (outcome === "failure") {
      const failed = await DemoPayment.findOneAndUpdate({ _id: id, status: "pending" }, { status: "failed" });
      if (!failed) return Response.json({ message: "This demo payment is already processing." }, { status: 409 });
      return Response.json({ message: "Demo payment failed. No order or plan was created.", status: "failed", demo: true });
    }
    const claimedIntent = await DemoPayment.findOneAndUpdate({ _id: id, user: authSession.user.id, $or: [{ status: "pending" }, { status: "processing", processingAt: { $lt: new Date(Date.now() - 120000) } }] }, { status: "processing", processingAt: new Date() }, { new: true });
    if (!claimedIntent) return Response.json({ message: "This demo payment is already processing." }, { status: 409 });
    claimed = true;
    const result = intent.kind === "order" ? await createOrder(authSession.user.id, intent.payload, "DEMO") : await purchaseSubscription(authSession.user.id, intent.payload);
    await DemoPayment.updateOne({ _id: id, status: "processing" }, { status: "paid", resultId: result._id });
    claimed = false;
    return Response.json({ result, kind: intent.kind, demo: true });
  } catch (error) {
    if (claimed) await DemoPayment.updateOne({ _id: id, status: "processing" }, { status: "pending", processingAt: null }).catch(() => {});
    return Response.json({ message: error instanceof CheckoutError ? error.message : error.message === "RATE_LIMITED" ? "Too many attempts. Try later." : "Demo payment could not be completed." }, { status: error.status || (error.message === "RATE_LIMITED" ? 429 : 503) });
  }
}
