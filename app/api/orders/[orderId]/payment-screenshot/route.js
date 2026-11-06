import crypto from "node:crypto";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { privateOrderHeaders } from "@/lib/order-response";

export function signedProofDownloadUrl(storedUrl, { cloud, key, secret, timestamp = Math.floor(Date.now() / 1000) }) {
  if (!cloud || !key || !secret) throw new Error("CLOUDINARY_UNAVAILABLE");
  const url = new URL(storedUrl);
  const prefix = `/${cloud}/image/authenticated/`;
  if (url.origin !== "https://res.cloudinary.com" || url.username || url.password || !url.pathname.startsWith(prefix) || url.search || url.hash) throw new Error("INVALID_PROOF_URL");
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

export async function GET(request, { params }) {
  const reply = (message, status) => new Response(message, { status, headers: privateOrderHeaders });
  const session = await auth();
  if (!session?.user?.id) return reply("Unauthorized", 401);
  const { orderId } = await params;
  try {
    await dbConnect();
    const order = await Order.findOne(session.user.role === "admin" ? { orderNumber: orderId } : { orderNumber: orderId, user: session.user.id }).select("paymentScreenshotUrl paymentProofRevision").lean();
    if (!order?.paymentScreenshotUrl) return reply("Not found", 404);
    const revision = new URL(request.url).searchParams.get("proofRevision");
    if (revision !== null && revision !== (order.paymentProofRevision || "")) return reply("Payment proof changed", 409);
    const signedUrl = signedProofDownloadUrl(order.paymentScreenshotUrl, { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET });
    const image = await fetch(signedUrl, { cache: "no-store", redirect: "error" });
    if (!image.ok) return reply("Image unavailable", 502);
    const type = image.headers.get("content-type") || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return reply("Invalid image", 502);
    return new Response(image.body, { headers: { ...privateOrderHeaders, "Content-Type": type, "X-Content-Type-Options": "nosniff" } });
  } catch { return reply("Image unavailable", 503); }
}
