import { auth } from "@/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return Response.json({ message: "Cloudinary is not configured. Choose a local image for now." }, { status: 503 });
  try {
    await enforceRateLimit(request, "upload", 20, 3600);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ message: "Upload a JPEG, PNG, or WebP image up to 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!((file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp))) return Response.json({ message: "The image file is invalid." }, { status: 400 });
    const upload = new FormData();
    upload.set("file", new Blob([bytes], { type: file.type }), "meal-image");
    upload.set("folder", "gharkabite/meals");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, body: upload });
    if (!response.ok) throw new Error("UPLOAD_FAILED");
    const result = await response.json();
    return Response.json({ image: result.secure_url, imagePublicId: result.public_id });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many uploads. Try later." : "Image upload failed." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
