import dbConnect from "@/lib/dbConnect";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";
import { kolkataDate } from "@/lib/dates";
import KitchenSettings from "@/models/KitchenSettings";
import DailyCapacity from "@/models/DailyCapacity";

export async function GET() {
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOne({ key: "primary" }).lean();
    const counts = await DailyCapacity.findOne({ date: kolkataDate() }).lean();
    return Response.json({ settings: { dailyMaximum: settings?.dailyMaximum || defaultKitchenSettings.dailyMaximum, lunchMaximum: settings?.lunchMaximum || defaultKitchenSettings.lunchMaximum, dinnerMaximum: settings?.dinnerMaximum || defaultKitchenSettings.dinnerMaximum, lunchCutoff: settings?.lunchCutoff || defaultKitchenSettings.lunchCutoff, dinnerCutoff: settings?.dinnerCutoff || defaultKitchenSettings.dinnerCutoff, currentCounts: { daily: counts?.daily || 0, lunch: counts?.lunch || 0, dinner: counts?.dinner || 0 } } });
  } catch {
    return Response.json({ message: "Kitchen availability is temporarily unavailable." }, { status: 503 });
  }
}
