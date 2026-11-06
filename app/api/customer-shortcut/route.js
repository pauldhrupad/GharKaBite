import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { privateOrderJson as json } from "@/lib/order-response";
import Order from "@/models/Order";
import User from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Unauthorized" }, { status: 401 });
  try {
    await dbConnect();
    const user = await User.findById(session.user.id).select({ role: 1, favorites: { $slice: -1 } }).lean();
    if (!user) return json({ message: "Account unavailable." }, { status: 404 });
    const favorite = user.favorites?.[0];
    if (favorite) return json({ shortcut: { type: "favorite", id: String(favorite._id), name: favorite.name, mealPeriod: favorite.preferredPeriod } });
    const order = await Order.findOne({ user: session.user.id, orderStatus: "delivered" }).sort({ createdAt: -1 }).select("orderNumber mealPeriod items.name items.quantity").lean();
    return json({ shortcut: order ? { type: "order", id: order.orderNumber, name: order.items[0]?.name || "Your delivered order", count: order.items.length, mealPeriod: order.mealPeriod } : null });
  } catch { return json({ message: "Saved meals are temporarily unavailable." }, { status: 503 }); }
}
