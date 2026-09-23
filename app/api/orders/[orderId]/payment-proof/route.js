import { auth } from "@/auth";
import crypto from "node:crypto";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import Order from "@/models/Order";
import KitchenSettings from "@/models/KitchenSettings";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to upload proof." }, { status: 401 });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !apiKey || !secret) return Response.json({ message: "Screenshot upload is unavailable. Use WhatsApp proof if configured." }, { status: 503 });
  try {
    await enforceRateLimit(request, "proof-upload-signature", 15, 3600);
    const { orderId } = await params;
    const order = await Order.findOne({ orderNumber: orderId, user: session.user.id }).select("paymentMethod paymentStatus orderStatus").lean();
    if (!order) return Response.json({ message: "Order not found." }, { status: 404 });
    if (order.paymentMethod !== "manual_online" || order.orderStatus !== "payment_pending" || !["pending", "rejected"].includes(order.paymentStatus)) return Response.json({ message: "Proof cannot be uploaded for this order." }, { status: 409 });
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `gharkabite/payment-proofs/${order._id}-${crypto.randomBytes(12).toString("hex")}`;
    const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated${secret}`).digest("hex");
    return Response.json({ cloud, apiKey, timestamp, publicId, type: "authenticated", signature });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many upload attempts. Try later." : "Unable to prepare screenshot upload." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}

function validImage(bytes, type) {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return (type === "image/jpeg" && jpeg) || (type === "image/png" && png) || (type === "image/webp" && webp);
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to submit payment details." }, { status: 401 });
  try {
    await enforceRateLimit(request, "payment-proof", 12, 3600);
    const { orderId } = await params;
    await dbConnect();
    const order = await Order.findOne({ orderNumber: orderId, user: session.user.id });
    if (!order) return Response.json({ message: "Order not found." }, { status: 404 });
    if (order.paymentMethod !== "manual_online" || order.orderStatus === "cancelled" || !["pending", "rejected"].includes(order.paymentStatus)) return Response.json({ message: "Payment details cannot be submitted for this order." }, { status: 409 });
    let proofMethod, paymentReference = null, paymentNote = "", paymentScreenshotUrl = "";
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      if (body.method === "whatsapp") {
        const settings = await KitchenSettings.findOne({ key: "primary" }).select("businessWhatsApp").lean();
        if (!(order.paymentDetails?.businessWhatsApp || settings?.businessWhatsApp)) return Response.json({ message: "WhatsApp proof is not configured. Submit proof on the website instead." }, { status: 409 });
        proofMethod = "whatsapp";
      } else if (body.method === "website") {
        paymentReference = String(body.paymentReference || "").trim().toUpperCase();
        paymentNote = String(body.paymentNote || "").trim();
        paymentScreenshotUrl = String(body.screenshotUrl || "");
        const cloud = process.env.CLOUDINARY_CLOUD_NAME;
        if (!/^[A-Z0-9-]{6,50}$/.test(paymentReference)) return Response.json({ message: "Enter a valid 6–50 character Transaction ID or UTR." }, { status: 400 });
        if (paymentNote.length > 500) return Response.json({ message: "Keep the note under 500 characters." }, { status: 400 });
        let url;
        try { url = new URL(paymentScreenshotUrl); } catch { return Response.json({ message: "Upload a valid payment screenshot first." }, { status: 400 }); }
        const expected = `/${cloud}/image/authenticated/`;
        const path = url.pathname.startsWith(expected) ? url.pathname.slice(expected.length).replace(/^v\d+\//, "") : "";
        const matched = new RegExp(`^(gharkabite/payment-proofs/${order._id}-[a-f0-9]{24})\\.(jpg|jpeg|png|webp)$`).exec(path);
        if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.search || !matched) return Response.json({ message: "Upload a valid payment screenshot first." }, { status: 400 });
        const { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
        if (!cloud || !key || !secret) return Response.json({ message: "Screenshot verification is temporarily unavailable." }, { status: 503 });
        const metadataResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/resources/image/authenticated/${encodeURIComponent(matched[1])}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, cache: "no-store" });
        if (!metadataResponse.ok) return Response.json({ message: "Uploaded screenshot could not be found. Please upload it again." }, { status: 400 });
        const metadata = await metadataResponse.json();
        if (metadata.secure_url !== paymentScreenshotUrl || !Number.isInteger(metadata.bytes) || metadata.bytes < 1 || metadata.bytes > 5 * 1024 * 1024 || !allowedTypes.includes(`image/${metadata.format === "jpg" ? "jpeg" : metadata.format}`)) return Response.json({ message: "Uploaded screenshot is invalid or exceeds 5 MB." }, { status: 400 });
        const duplicate = await Order.exists({ _id: { $ne: order._id }, paymentReference, paymentStatus: { $in: ["verification_pending", "paid"] } });
        if (duplicate) return Response.json({ message: "Transaction ID already associated with another order. Check it or contact us for review." }, { status: 409 });
        proofMethod = "website";
      } else return Response.json({ message: "Choose a valid proof method." }, { status: 400 });
    } else {
      const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
      if (!cloud || !key || !secret) return Response.json({ message: "Screenshot upload is temporarily unavailable. You can send proof on WhatsApp if configured." }, { status: 503 });
      const form = await request.formData();
      paymentReference = String(form.get("paymentReference") || "").trim().toUpperCase();
      paymentNote = String(form.get("paymentNote") || "").trim();
      const file = form.get("screenshot");
      if (!/^[A-Z0-9-]{6,50}$/.test(paymentReference)) return Response.json({ message: "Enter a valid 6–50 character Transaction ID or UTR." }, { status: 400 });
      if (paymentNote.length > 500) return Response.json({ message: "Keep the note under 500 characters." }, { status: 400 });
      if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024 || !allowedTypes.includes(file.type)) return Response.json({ message: "Upload a JPG, PNG or WebP screenshot up to 5 MB." }, { status: 400 });
      const duplicate = await Order.exists({ _id: { $ne: order._id }, paymentReference, paymentStatus: { $in: ["verification_pending", "paid"] } });
      if (duplicate) return Response.json({ message: "Transaction ID already associated with another order. Check it or contact us for review." }, { status: 409 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validImage(bytes, file.type)) return Response.json({ message: "The screenshot file is invalid." }, { status: 400 });
      const upload = new FormData();
      upload.set("file", new Blob([bytes], { type: file.type }), "payment-proof");
      upload.set("folder", "gharkabite/payment-proofs");
      upload.set("type", "authenticated");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, body: upload });
      if (!response.ok) return Response.json({ message: "Screenshot upload failed. Please try again." }, { status: 503 });
      paymentScreenshotUrl = (await response.json()).secure_url;
      proofMethod = "website";
    }
    const updated = await Order.findOneAndUpdate({ _id: order._id, paymentMethod: "manual_online", orderStatus: "payment_pending", paymentStatus: { $in: ["pending", "rejected"] } }, { $set: { paymentStatus: "verification_pending", paymentProofMethod: proofMethod, paymentReference, paymentNote, paymentScreenshotUrl, paymentSubmittedAt: new Date(), paymentRejectionReason: "" } }, { returnDocument: "after", runValidators: true }).select("-paymentScreenshotUrl").lean();
    if (!updated) return Response.json({ message: "This payment was already submitted or the order changed. Refresh the page." }, { status: 409 });
    return Response.json({ order: updated, message: "Payment submitted for verification. Your order is not confirmed yet." });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many attempts. Try again later." : error.code === 11000 ? "Transaction ID already associated with another order. Check it or contact us for review." : "Payment details could not be submitted." }, { status: error.message === "RATE_LIMITED" ? 429 : error.code === 11000 ? 409 : 503 }); }
}
