import crypto from "node:crypto";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import DemoPayment from "@/models/DemoPayment";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in before continuing." }, { status: 401 });
  try {
    await enforceRateLimit(request, "demo-payment", 12, 3600);
    const { kind, key, payload } = await request.json();
    if (!["order", "subscription"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(key || "") || !payload || typeof payload !== "object" || JSON.stringify(payload).length > 20000 || (kind === "order" && payload.checkoutKey !== key) || (kind === "subscription" && payload.purchaseKey !== key)) return Response.json({ message: "Invalid demo checkout." }, { status: 400 });
    await dbConnect();
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify({ kind, payload })).digest("hex");
    let intent = await DemoPayment.findOne({ user: session.user.id, key });
    if (intent && intent.payloadHash !== payloadHash) return Response.json({ message: "This checkout key was already used for another request." }, { status: 409 });
    if (!intent) intent = await DemoPayment.create({ user: session.user.id, key, kind, payload, payloadHash, expiresAt: new Date(Date.now() + 15 * 60000) });
    return Response.json({ id: String(intent._id), status: intent.status, demo: true });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many payment attempts. Try later." : "Unable to start demo payment." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
