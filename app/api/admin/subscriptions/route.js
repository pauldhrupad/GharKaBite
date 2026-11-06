import { privateOrderJson as json } from "@/lib/order-response";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { effectiveSubscriptionStatus, setSubscriptionStatus } from "@/lib/subscription-service";
import Subscription from "@/models/Subscription";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    const subscriptions = await Subscription.find({}).populate("user", "name email phone").sort({ createdAt: -1 }).limit(200).lean();
    return json({ subscriptions: subscriptions.map((item) => ({ ...item, status: effectiveSubscriptionStatus(item) })) });
  } catch { return json({ message: "Subscriptions are unavailable." }, { status: 503 }); }
}

export async function PATCH(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    const { id, status } = await request.json();
    return json({ subscription: await setSubscriptionStatus(id, status) });
  } catch (error) { return json({ message: error.status ? error.message : "Unable to update subscription." }, { status: error.status || 503 }); }
}
