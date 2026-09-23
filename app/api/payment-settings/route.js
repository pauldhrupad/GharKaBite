import dbConnect from "@/lib/dbConnect";
import KitchenSettings from "@/models/KitchenSettings";
import { publicPaymentSettings } from "@/lib/payment-settings";

export async function GET() {
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOne({ key: "primary" }).select("upiDisplayName upiId upiPhoneNumber upiQrImage businessWhatsApp onlinePaymentEnabled codEnabled").lean();
    return Response.json({ payment: publicPaymentSettings(settings) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Payment options are temporarily unavailable." }, { status: 503 });
  }
}
