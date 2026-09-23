import crypto from "node:crypto";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

export function signedProofDownloadUrl(storedUrl, { cloud, key, secret, timestamp = Math.floor(Date.now() / 1000) }) {
  if (!cloud || !key || !secret) throw new Error("CLOUDINARY_UNAVAILABLE");
  const url = new URL(storedUrl);
  const prefix = `/${cloud}/image/authenticated/`;
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(prefix) || url.search) throw new Error("INVALID_PROOF_URL");
  const assetPath = url.pathname.slice(prefix.length).replace(/^v\d+\//, "");
  const match = /^(gharkabite\/payment-proofs\/[a-zA-Z0-9_/-]+)\.(jpg|jpeg|png|webp)$/.exec(assetPath);
  if (!match) throw new Error("INVALID_PROOF_URL");
  const [, publicId, format] = match;
  const expiresAt = timestamp + 60;
  const signedParams = { expires_at: expiresAt, format, public_id: publicId, timestamp, type: "authenticated" };
  const signatureBase = Object.entries(signedParams).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}=${value}`).join("&");
  const signature = crypto.createHash("sha1").update(signatureBase + secret).digest("hex");
  const query = new URLSearchParams({ ...signedParams, signature, api_key: key });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/download?${query}`;
}

export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { orderId } = await params;
  try {
    await dbConnect();
    const order = await Order.findOne(session.user.role === "admin" ? { orderNumber: orderId } : { orderNumber: orderId, user: session.user.id }).select("paymentScreenshotUrl").lean();
    if (!order?.paymentScreenshotUrl) return new Response("Not found", { status: 404 });
    const signedUrl = signedProofDownloadUrl(order.paymentScreenshotUrl, { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET });
    const image = await fetch(signedUrl, { cache: "no-store" });
    if (!image.ok) return new Response("Image unavailable", { status: 502 });
    const type = image.headers.get("content-type") || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return new Response("Invalid image", { status: 502 });
    return new Response(image.body, { headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}
