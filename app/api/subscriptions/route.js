import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { effectiveSubscriptionStatus } from "@/lib/subscription-service";
import Subscription from "@/models/Subscription";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const subscriptions = await Subscription.find({ user: session.user.id }).sort({ createdAt: -1 }).lean();
    return Response.json({ subscriptions: subscriptions.map((item) => ({ ...item, status: effectiveSubscriptionStatus(item) })) });
  } catch { return Response.json({ message: "Subscriptions are unavailable." }, { status: 503 }); }
}
