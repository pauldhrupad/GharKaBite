import { auth } from "@/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import crypto from "node:crypto";

export async function GET(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !apiKey || !secret) return Response.json({ message: "Cloudinary is not configured." }, { status: 503 });
  try {
    await enforceRateLimit(request, "qr-upload-signature", 20, 3600);
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `gharkabite/payment-qr/${crypto.randomBytes(12).toString("hex")}`;
    const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${secret}`).digest("hex");
    return Response.json({ cloud, apiKey, timestamp, publicId, signature });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many uploads. Try later." : "Unable to prepare upload." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return Response.json({ message: "QR upload is unavailable. Configure Cloudinary first." }, { status: 503 });
  try {
    await enforceRateLimit(request, "payment-qr-upload", 20, 3600);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ message: "Choose a JPG, PNG, or WebP image up to 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!((file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp))) return Response.json({ message: "The image file is invalid." }, { status: 400 });
    const upload = new FormData();
    upload.set("file", new Blob([bytes], { type: file.type }), "payment-qr");
    upload.set("folder", "gharkabite/payment-qr");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, body: upload });
    if (!response.ok) throw new Error("UPLOAD_FAILED");
    const result = await response.json();
    return Response.json({ image: result.secure_url });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many uploads. Try later." : "QR upload failed." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
