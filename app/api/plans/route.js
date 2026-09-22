import { seedCatalog } from "@/lib/catalog";
import SubscriptionPlan from "@/models/SubscriptionPlan";

export async function GET() {
  try { await seedCatalog(); return Response.json({ plans: await SubscriptionPlan.find({ active: true }).sort({ mealCount: 1 }).lean() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Plans are temporarily unavailable." }, { status: 503 }); }
}
