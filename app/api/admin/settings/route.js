import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";
import KitchenSettings from "@/models/KitchenSettings";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOneAndUpdate(
      { key: "primary" },
      { $setOnInsert: { key: "primary", ...defaultKitchenSettings } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    return Response.json({ settings });
  } catch {
    return Response.json({ message: "Kitchen settings are unavailable." }, { status: 503 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const freeDeliveryThreshold = Number(body.freeDeliveryThreshold);
    if (!Number.isInteger(freeDeliveryThreshold) || freeDeliveryThreshold < 0 || freeDeliveryThreshold > 100000) return Response.json({ message: "Enter a valid free-delivery minimum between ₹0 and ₹100,000." }, { status: 400 });
    if (!["acceptingOrders", "lunchEnabled", "dinnerEnabled"].every((field) => typeof body[field] === "boolean")) return Response.json({ message: "Choose valid ordering switches." }, { status: 400 });
    const validCutoff = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!validCutoff.test(body.lunchCutoff) || !validCutoff.test(body.dinnerCutoff)) return Response.json({ message: "Choose valid lunch and dinner cutoff times." }, { status: 400 });
    const settings = {
      acceptingOrders: body.acceptingOrders,
      lunchEnabled: body.lunchEnabled,
      dinnerEnabled: body.dinnerEnabled,
      lunchCutoff: body.lunchCutoff,
      dinnerCutoff: body.dinnerCutoff,
      freeDeliveryThreshold,
    };
    await dbConnect();
    const updated = await KitchenSettings.findOneAndUpdate({ key: "primary" }, { $set: settings }, { upsert: true, returnDocument: "after", runValidators: true }).lean();
    return Response.json({ settings: updated, message: "Kitchen settings updated." });
  } catch {
    return Response.json({ message: "Unable to save kitchen settings." }, { status: 503 });
  }
}
