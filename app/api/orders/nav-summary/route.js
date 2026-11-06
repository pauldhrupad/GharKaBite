import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { kolkataDate } from "@/lib/dates";
import Order from "@/models/Order";
import { privateOrderJson as json } from "@/lib/order-response";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const filter = {
      user: session.user.id,
      serviceDate: { $gte: kolkataDate() },
      orderStatus: { $nin: ["delivered", "cancelled"] },
    };
    const [activeCount, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).select("orderNumber orderStatus paymentStatus mealPeriod serviceDate createdAt").sort({ createdAt: -1 }).limit(3).lean(),
    ]);
    return json({ activeCount, orders });
  } catch {
    return json({ message: "Order status is temporarily unavailable." }, { status: 503 });
  }
}
