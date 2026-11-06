import dbConnect from "@/lib/dbConnect";
import KitchenSettings from "@/models/KitchenSettings";
import { publicPaymentSettings, validBusinessWhatsApp } from "@/lib/payment-settings";

export async function GET() {
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOne({ key: "primary" }).select("upiDisplayName upiId upiPhoneNumber upiQrImage businessWhatsApp onlinePaymentEnabled codEnabled").lean();
    const { onlinePaymentEnabled, codEnabled, upiQrImage, upiId, upiPhoneNumber, businessWhatsApp } = publicPaymentSettings(settings);
    const channels = onlinePaymentEnabled ? [upiQrImage && "qr", upiId && "upi_id", upiPhoneNumber && "phone"].filter(Boolean) : [];
    return Response.json({ payment: { onlinePaymentEnabled, codEnabled, channels, businessWhatsApp: validBusinessWhatsApp(businessWhatsApp) ? businessWhatsApp : "" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Payment options are temporarily unavailable." }, { status: 503 });
  }
}
