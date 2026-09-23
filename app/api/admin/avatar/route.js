import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import User from "@/models/User";

async function owner() {
  const session = await auth();
  if (session?.user?.role !== "admin" || !session.user.id) return null;
  await dbConnect();
  return User.findOne({ _id: session.user.id, role: "admin" });
}

export async function GET() {
  const user = await owner();
  if (!user) return Response.json({ message: "Forbidden" }, { status: 403 });
  return Response.json({ avatarUrl: user.avatarUrl || "" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request) {
  const user = await owner();
  if (!user) return Response.json({ message: "Forbidden" }, { status: 403 });

  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return Response.json({ message: "Profile photo uploads are not configured." }, { status: 503 });

  try {
    await enforceRateLimit(request, "owner-avatar-upload", 10, 3600);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return Response.json({ message: "Choose a JPEG, PNG, or WebP photo under 2 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!((file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp))) {
      return Response.json({ message: "The photo file is invalid." }, { status: 400 });
    }

    const upload = new FormData();
    upload.set("file", new Blob([bytes], { type: file.type }), "owner-avatar");
    upload.set("folder", "gharkabite/avatars");
    upload.set("public_id", String(user._id));
    upload.set("overwrite", "true");
    upload.set("invalidate", "true");
    upload.set("unique_filename", "false");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
      body: upload,
    });
    if (!response.ok) throw new Error("UPLOAD_FAILED");
    const result = await response.json();
    if (result.public_id !== `gharkabite/avatars/${user._id}` || typeof result.secure_url !== "string" || !result.secure_url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)) throw new Error("UPLOAD_FAILED");

    user.avatarUrl = result.secure_url;
    await user.save();
    return Response.json({ avatarUrl: user.avatarUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many uploads. Try again later." : "Profile photo upload failed." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 });
  }
}
