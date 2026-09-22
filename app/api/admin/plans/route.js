import { auth } from "@/auth";
import { seedCatalog } from "@/lib/catalog";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { MEAL_TYPES } from "@/models/Meal";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try { await seedCatalog(); return Response.json({ plans: await SubscriptionPlan.find({}).sort({ mealCount: 1 }).lean() }); }
  catch { return Response.json({ message: "Plans are unavailable." }, { status: 503 }); }
}

export async function PATCH(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const fields = { name: String(body.name || "").trim(), description: String(body.description || "").trim(), mealCount: Number(body.mealCount), price: Number(body.price), validityDays: Number(body.validityDays), allowedMealTypes: body.allowedMealTypes, lunchAllowed: Boolean(body.lunchAllowed), dinnerAllowed: Boolean(body.dinnerAllowed), mixedAllowed: Boolean(body.mixedAllowed), active: Boolean(body.active) };
    if (!fields.name || fields.name.length > 80 || !fields.description || fields.description.length > 300 || /<[^>]*>/.test(`${fields.name} ${fields.description}`) || !Number.isInteger(fields.mealCount) || fields.mealCount < 1 || !Number.isInteger(fields.price) || fields.price < 1 || !Number.isInteger(fields.validityDays) || fields.validityDays < 1 || !Array.isArray(fields.allowedMealTypes) || !fields.allowedMealTypes.length || fields.allowedMealTypes.some((type) => !MEAL_TYPES.includes(type)) || ![fields.lunchAllowed, fields.dinnerAllowed, fields.mixedAllowed].some(Boolean)) return Response.json({ message: "Check the plan fields." }, { status: 400 });
    await seedCatalog();
    const plan = await SubscriptionPlan.findByIdAndUpdate(body.id, fields, { new: true, runValidators: true });
    if (!plan) return Response.json({ message: "Plan not found." }, { status: 404 });
    return Response.json({ plan });
  } catch { return Response.json({ message: "Unable to update plan." }, { status: 503 }); }
}
