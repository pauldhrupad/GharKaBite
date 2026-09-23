import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { ensureWelcomePromo, quotePromo } from "@/lib/promotions";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Sign in to use a promo code." }, { status: 401 });
  try {
    await enforceRateLimit(request, "validate-promo", 60, 3600);
    const body = await request.json();
    const subtotal = Number(body.subtotal);
    if (!Number.isInteger(subtotal) || subtotal < 0 || subtotal > 100000 || typeof body.code !== "string" || body.code.length > 30) return Response.json({ message: "Invalid promo request." }, { status: 400 });
    await dbConnect();
    await ensureWelcomePromo();
    const promo = await quotePromo(session.user.id, body.code, subtotal);
    return Response.json({ promo }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many attempts. Please try later." : "Promo codes are temporarily unavailable." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
