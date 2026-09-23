import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });

  try {
    await dbConnect();
    const count = await Order.countDocuments({
      $or: [
        { orderStatus: { $in: ["received", "confirmed"] } },
        { orderStatus: "payment_pending", paymentStatus: "verification_pending" },
      ],
    });
    return Response.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "Order alerts are temporarily unavailable." }, { status: 503 });
  }
}
