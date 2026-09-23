import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import KitchenSettings from "@/models/KitchenSettings";
import { publicPaymentSettings } from "@/lib/payment-settings";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    const settings = await KitchenSettings.findOne({ key: "primary" }).lean();
    return Response.json({ payment: publicPaymentSettings(settings) });
  } catch { return Response.json({ message: "Payment settings are unavailable." }, { status: 503 }); }
}

export async function PATCH(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const upiDisplayName = String(body.upiDisplayName || "").trim();
    const upiId = String(body.upiId || "").trim().toLowerCase();
    const upiPhoneNumber = String(body.upiPhoneNumber || "").replace(/\D/g, "");
    const businessWhatsApp = String(body.businessWhatsApp || "").replace(/\D/g, "");
    const upiQrImage = String(body.upiQrImage || "").trim();
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const qrPrefix = cloud && `https://res.cloudinary.com/${cloud}/image/upload/`;
    if (upiDisplayName.length > 100 || (upiId && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(upiId)) || (upiPhoneNumber && !/^[6-9]\d{9}$/.test(upiPhoneNumber)) || (businessWhatsApp && !/^(?:91)?[6-9]\d{9}$/.test(businessWhatsApp)) || (upiQrImage && (!qrPrefix || !upiQrImage.startsWith(qrPrefix) || !upiQrImage.includes("/gharkabite/payment-qr/")))) return Response.json({ message: "Check the UPI ID, phone numbers, name, and uploaded QR." }, { status: 400 });
    if (body.onlinePaymentEnabled && !(upiQrImage || upiId || upiPhoneNumber)) return Response.json({ message: "Add at least one online payment option before enabling it." }, { status: 400 });
    if (body.onlinePaymentEnabled && !businessWhatsApp && !(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) return Response.json({ message: "Configure Cloudinary uploads or Business WhatsApp before enabling online payment proof." }, { status: 400 });
    if (!body.onlinePaymentEnabled && !body.codEnabled) return Response.json({ message: "Enable at least one payment method." }, { status: 400 });
    await dbConnect();
    const settings = await KitchenSettings.findOneAndUpdate({ key: "primary" }, { $set: { upiDisplayName, upiId, upiPhoneNumber, upiQrImage, businessWhatsApp, onlinePaymentEnabled: body.onlinePaymentEnabled === true, codEnabled: body.codEnabled === true } }, { upsert: true, returnDocument: "after", runValidators: true }).lean();
    return Response.json({ payment: publicPaymentSettings(settings), message: "Payment information saved." });
  } catch { return Response.json({ message: "Unable to save payment information." }, { status: 503 }); }
}
