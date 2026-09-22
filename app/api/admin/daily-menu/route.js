import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { allowedOrderDate } from "@/lib/dates";
import Meal from "@/models/Meal";
import DailyMenu from "@/models/DailyMenu";

export async function GET(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const date = new URL(request.url).searchParams.get("date");
  if (!allowedOrderDate(date)) return Response.json({ message: "Choose today or tomorrow." }, { status: 400 });
  await dbConnect();
  return Response.json({ overrides: await DailyMenu.find({ date }).lean() });
}

export async function PATCH(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    if (!allowedOrderDate(body.date) || !/^[a-z0-9-]+$/.test(body.mealId || "")) return Response.json({ message: "Invalid meal or date." }, { status: 400 });
    await dbConnect();
    const meal = await Meal.findOne({ slug: body.mealId, archivedAt: null });
    if (!meal) return Response.json({ message: "Meal not found." }, { status: 404 });
    const patch = {};
    if (Object.hasOwn(body, "availableOverride")) {
      if (body.availableOverride !== null && typeof body.availableOverride !== "boolean") return Response.json({ message: "Invalid availability." }, { status: 400 });
      patch.availableOverride = body.availableOverride;
    }
    if (Object.hasOwn(body, "soldOut")) {
      if (typeof body.soldOut !== "boolean") return Response.json({ message: "Invalid sold-out flag." }, { status: 400 });
      patch.soldOut = body.soldOut;
    }
    if (Object.hasOwn(body, "remaining")) {
      if (!Number.isInteger(body.remaining) || body.remaining < 0 || body.remaining > meal.stockLimit) return Response.json({ message: "Stock must be between zero and the daily limit." }, { status: 400 });
      patch.remaining = body.remaining;
    }
    const daily = await DailyMenu.findOneAndUpdate({ meal: meal._id, date: body.date }, { $setOnInsert: { meal: meal._id, date: body.date, ...(!Object.hasOwn(patch, "remaining") ? { remaining: meal.stockLimit } : {}), stockLimitSnapshot: meal.stockLimit }, $set: patch }, { upsert: true, new: true, runValidators: true });
    return Response.json({ daily });
  } catch (error) {
    if (error.code === 40) return Response.json({ message: "Stock update conflicted; retry." }, { status: 409 });
    return Response.json({ message: "Unable to update daily menu." }, { status: 503 });
  }
}
