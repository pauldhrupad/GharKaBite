import dbConnect from "@/lib/dbConnect";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";
import KitchenSettings from "@/models/KitchenSettings";

export async function GET() {
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOne({ key: "primary" }).lean();
    return Response.json({ settings: { acceptingOrders: settings?.acceptingOrders ?? true, lunchEnabled: settings?.lunchEnabled ?? true, dinnerEnabled: settings?.dinnerEnabled ?? true, lunchCutoff: settings?.lunchCutoff || defaultKitchenSettings.lunchCutoff, dinnerCutoff: settings?.dinnerCutoff || defaultKitchenSettings.dinnerCutoff, freeDeliveryThreshold: settings?.freeDeliveryThreshold ?? defaultKitchenSettings.freeDeliveryThreshold } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Kitchen availability is temporarily unavailable." }, { status: 503 });
  }
}
