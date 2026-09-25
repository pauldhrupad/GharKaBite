import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });

  try {
    await dbConnect();
    const filter = {
      $or: [
        { orderStatus: { $in: ["received", "confirmed"] } },
        { orderStatus: "payment_pending", paymentStatus: "verification_pending" },
      ],
    };
    const [count, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).select("orderNumber orderStatus paymentStatus mealPeriod serviceDate customer.name createdAt").sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    return Response.json({ count, orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "Order alerts are temporarily unavailable." }, { status: 503 });
  }
}
