import { checkDelivery } from "@/lib/delivery";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    await enforceRateLimit(request, "delivery-check", 20, 60);
    const { address } = await request.json();
    const result = await checkDelivery(address);
    return Response.json(result, { status: result.unavailable ? 503 : 200 });
  } catch (error) { return Response.json({ serviceable: false, reason: error.message === "RATE_LIMITED" ? "Too many checks. Try again shortly." : "We couldn't verify this address. Please contact us for delivery confirmation." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
