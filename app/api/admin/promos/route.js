import crypto from "node:crypto";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { ensureWelcomePromo, normalizePromoCode } from "@/lib/promotions";
import PromoCode from "@/models/PromoCode";
import Order from "@/models/Order";

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function GET() {
  if (!await isAdmin()) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    await ensureWelcomePromo();
    const [promos, uses] = await Promise.all([PromoCode.find().sort({ createdAt: -1 }).lean(), Order.aggregate([{ $match: { promoCode: { $type: "string", $gt: "" } } }, { $group: { _id: "$promoCode", count: { $sum: 1 } } }])]);
    const counts = new Map(uses.map((item) => [item._id, item.count]));
    return Response.json({ promos: promos.map((promo) => ({ ...promo, uses: counts.get(promo.code) || 0 })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ message: "Unable to load promo codes." }, { status: 503 }); }
}

export async function POST(request) {
  if (!await isAdmin()) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const type = body.type;
    const value = Number(body.value);
    const maxDiscount = Number(body.maxDiscount);
    const minSubtotal = Number(body.minSubtotal);
    const expiresAt = body.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt) ? new Date(`${body.expiresAt}T23:59:59+05:30`) : body.expiresAt ? new Date(NaN) : null;
    if (!["percent", "fixed"].includes(type) || !Number.isInteger(value) || value < 1 || value > (type === "percent" ? 100 : 100000) || !Number.isInteger(minSubtotal) || minSubtotal < 0 || minSubtotal > 100000 || (type === "percent" && (!Number.isInteger(maxDiscount) || maxDiscount < 1 || maxDiscount > 100000)) || (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()))) return Response.json({ message: "Check the discount, minimum order amount and expiry." }, { status: 400 });
    const customCode = normalizePromoCode(body.code);
    if (!body.generateRandom && !/^[A-Z0-9-]{4,20}$/.test(customCode)) return Response.json({ message: "Use 4–20 letters, numbers or hyphens for the code." }, { status: 400 });
    await dbConnect();
    await ensureWelcomePromo();
    for (let attempt = 0; attempt < (body.generateRandom ? 5 : 1); attempt++) {
      const code = body.generateRandom ? `GKB-${crypto.randomBytes(5).toString("hex").toUpperCase()}` : customCode;
      try {
        const promo = await PromoCode.create({ code, type, value, maxDiscount: type === "percent" ? maxDiscount : value, minSubtotal, expiresAt, active: true });
        return Response.json({ promo }, { status: 201 });
      } catch (error) {
        if (error.code !== 11000) throw error;
        if (!body.generateRandom) return Response.json({ message: "That promo code already exists." }, { status: 409 });
      }
    }
    return Response.json({ message: "Could not generate a unique code. Please try again." }, { status: 503 });
  } catch { return Response.json({ message: "Unable to create promo code." }, { status: 503 }); }
}

export async function PATCH(request) {
  if (!await isAdmin()) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const code = normalizePromoCode(body.code);
    if (!/^[A-Z0-9-]{4,20}$/.test(code) || typeof body.active !== "boolean") return Response.json({ message: "Invalid promo update." }, { status: 400 });
    await dbConnect();
    const promo = await PromoCode.findOneAndUpdate({ code }, { $set: { active: body.active } }, { returnDocument: "after", runValidators: true }).lean();
    if (!promo) return Response.json({ message: "Promo code not found." }, { status: 404 });
    return Response.json({ promo });
  } catch { return Response.json({ message: "Unable to update promo code." }, { status: 503 }); }
}
