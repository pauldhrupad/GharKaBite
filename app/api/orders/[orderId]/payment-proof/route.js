import crypto from "node:crypto";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import { orderResponse, privateOrderJson as json } from "@/lib/order-response";
import { canSubmitProof, validBusinessWhatsApp, validProofRevision } from "@/lib/payment-settings";
import Order from "@/models/Order";
import KitchenSettings from "@/models/KitchenSettings";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedFormats = "jpg,jpeg,png,webp";
const maxBytes = 5 * 1024 * 1024;
const conflict = () => json({ message: "The payment proof changed. Refresh and review the current submission." }, { status: 409 });
const invalidAsset = () => json({ message: "Upload a valid JPG, PNG or WebP screenshot up to 5 MB." }, { status: 400 });
const duplicateReference = () => json({ message: "Transaction ID already associated with another order. Check it or contact us for review." }, { status: 409 });
const assetPrefix = (order) => `gharkabite/payment-proofs/${order._id}-${order.paymentProofRevision || "initial"}-`;
const newAssetId = (order) => assetPrefix(order) + crypto.randomBytes(12).toString("hex");

function cloudinary() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return null;
  return { cloud, key, secret, authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` };
}

function signedFields(publicId, { key, secret }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash("sha1").update(`allowed_formats=${allowedFormats}&overwrite=false&public_id=${publicId}&timestamp=${timestamp}&type=authenticated${secret}`).digest("hex");
  return { api_key: key, timestamp, public_id: publicId, type: "authenticated", overwrite: "false", allowed_formats: allowedFormats, signature };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to upload proof." }, { status: 401 });
  try {
    await enforceRateLimit(request, "proof-upload-signature", 15, 3600);
    const { orderId } = await params;
    const order = await Order.findOne({ orderNumber: orderId, user: session.user.id }).select("paymentMethod paymentStatus orderStatus paymentProofRevision total").lean();
    if (!order) return json({ message: "Order not found." }, { status: 404 });
    if (!canSubmitProof(order)) return conflict();
    const config = cloudinary();
    if (!config) return json({ message: "Screenshot upload is unavailable. Use WhatsApp proof if configured." }, { status: 503 });
    const { api_key: apiKey, public_id: publicId, ...fields } = signedFields(newAssetId(order), config);
    return json({ cloud: config.cloud, apiKey, publicId, ...fields });
  } catch (error) { return json({ message: error.message === "RATE_LIMITED" ? "Too many upload attempts. Try later." : "Unable to prepare screenshot upload." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}

function validImage(bytes, type) {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return (type === "image/jpeg" && jpeg) || (type === "image/png" && png) || (type === "image/webp" && webp);
}

function proofAssetId(value, cloud, prefix) {
  if (typeof value !== "string" || value.length > 1024) return null;
  try {
    const url = new URL(value);
    const root = `/${cloud}/image/authenticated/`;
    if (url.origin !== "https://res.cloudinary.com" || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(root)) return null;
    const path = url.pathname.slice(root.length).replace(/^v\d+\//, "");
    if (!path.startsWith(prefix) || !/^[a-f0-9]{24}\.(?:jpe?g|png|webp)$/.test(path.slice(prefix.length))) return null;
    return path.slice(0, path.lastIndexOf("."));
  } catch { return null; }
}

function validAsset(asset, id, url) {
  return asset?.public_id === id && asset.resource_type === "image" && asset.type === "authenticated" &&
    asset.secure_url === url && url.endsWith(`.${asset.format}`) && allowedFormats.split(",").includes(asset.format) &&
    Number.isInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= maxBytes;
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to submit payment details." }, { status: 401 });
  try {
    await enforceRateLimit(request, "payment-proof", 12, 3600);
    const { orderId } = await params;
    await dbConnect();
    const order = await Order.findOne({ orderNumber: orderId, user: session.user.id }).lean();
    if (!order) return json({ message: "Order not found." }, { status: 404 });
    if (!canSubmitProof(order)) return conflict();

    const contentType = request.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const isMultipart = contentType.includes("multipart/form-data");
    if (!isJson && !isMultipart) return json({ message: "Choose a valid proof method." }, { status: 400 });
    const body = await (isJson ? request.json() : request.formData()).catch(() => null);
    if (!body) return json({ message: "Invalid payment proof request." }, { status: 400 });
    const expected = isJson ? body.expectedProofRevision : body.has("expectedProofRevision") ? body.get("expectedProofRevision") || null : undefined;
    if (!validProofRevision(expected)) return json({ message: "Load the current order before submitting proof." }, { status: 400 });
    if (expected !== (order.paymentProofRevision ?? null)) return conflict();

    const proofMethod = isJson ? body.method : "website";
    let paymentReference = null, paymentNote = "", paymentScreenshotUrl = "";
    if (proofMethod === "whatsapp") {
      const settings = await KitchenSettings.findOne({ key: "primary" }).select("businessWhatsApp").lean();
      if (!validBusinessWhatsApp(settings?.businessWhatsApp)) return json({ message: "WhatsApp proof is not configured. Submit proof on the website instead." }, { status: 409 });
    } else if (proofMethod === "website") {
      paymentReference = String((isJson ? body.paymentReference : body.get("paymentReference")) || "").trim().toUpperCase();
      paymentNote = String((isJson ? body.paymentNote : body.get("paymentNote")) || "").trim();
      if (!/^[A-Z0-9-]{6,50}$/.test(paymentReference)) return json({ message: "Enter a valid 6–50 character Transaction ID or UTR." }, { status: 400 });
      if (paymentNote.length > 500) return json({ message: "Keep the note under 500 characters." }, { status: 400 });
      if (await Order.exists({ _id: { $ne: order._id }, paymentReference, paymentStatus: { $in: ["verification_pending", "paid"] } })) return duplicateReference();
      const config = cloudinary();
      if (!config) return json({ message: "Screenshot upload is unavailable. Use WhatsApp proof if configured." }, { status: 503 });
      const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloud)}`;
      const headers = { Authorization: config.authorization };
      if (isJson) {
        paymentScreenshotUrl = body.screenshotUrl;
        const id = proofAssetId(paymentScreenshotUrl, config.cloud, assetPrefix(order));
        if (!id) return invalidAsset();
        const response = await fetch(`${endpoint}/resources/image/authenticated/${encodeURIComponent(id)}`, { headers, cache: "no-store", redirect: "error" });
        if (response.status === 404) return invalidAsset();
        if (!response.ok) return json({ message: "Screenshot verification is temporarily unavailable. Try again." }, { status: 503 });
        if (!validAsset(await response.json(), id, paymentScreenshotUrl)) return invalidAsset();
      } else {
        const file = body.get("screenshot");
        if (!(file instanceof File) || !file.size || file.size > maxBytes || !allowedTypes.includes(file.type)) return invalidAsset();
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!validImage(bytes, file.type)) return invalidAsset();
        const id = newAssetId(order);
        const upload = new FormData();
        upload.set("file", new Blob([bytes], { type: file.type }), "payment-proof");
        for (const [name, value] of Object.entries(signedFields(id, config))) upload.set(name, value);
        const response = await fetch(`${endpoint}/image/upload`, { method: "POST", body: upload, redirect: "error" });
        if (!response.ok) return json({ message: "Screenshot upload failed. Please try again." }, { status: 503 });
        const asset = await response.json();
        paymentScreenshotUrl = asset?.secure_url;
        if (proofAssetId(paymentScreenshotUrl, config.cloud, assetPrefix(order)) !== id || !validAsset(asset, id, paymentScreenshotUrl)) return invalidAsset();
      }
    } else return json({ message: "Choose a valid proof method." }, { status: 400 });

    const updated = await Order.findOneAndUpdate({ _id: order._id, user: session.user.id, paymentMethod: "manual_online", orderStatus: "payment_pending", paymentStatus: order.paymentStatus, paymentProofRevision: expected }, { $set: { paymentStatus: "verification_pending", paymentProofRevision: crypto.randomUUID(), paymentProofMethod: proofMethod, paymentReference, paymentNote, paymentScreenshotUrl, paymentSubmittedAt: new Date(), paymentRejectionReason: "" } }, { returnDocument: "after", runValidators: true }).lean();
    if (!updated) return conflict();
    return json({ order: orderResponse(updated), message: "Payment proof submitted for verification. Your order is not confirmed yet." });
  } catch (error) { return error.code === 11000 ? duplicateReference() : json({ message: error.message === "RATE_LIMITED" ? "Too many attempts. Try again later." : "Payment details could not be submitted." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
