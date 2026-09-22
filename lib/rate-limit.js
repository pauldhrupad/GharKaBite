import crypto from "node:crypto";
import dbConnect from "./dbConnect";
import RateLimit from "@/models/RateLimit";

export async function enforceRateLimit(request, action, limit, windowSeconds) {
  await dbConnect();
  const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = crypto.createHash("sha256").update(`${action}:${ip}:${bucket}`).digest("hex");
  const expiresAt = new Date((bucket + 2) * windowSeconds * 1000);
  const entry = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { new: true, upsert: true }).lean();
  if (entry.count > limit) throw new Error("RATE_LIMITED");
}
