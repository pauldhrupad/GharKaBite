import { checkLocation } from "@/lib/delivery";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    await enforceRateLimit(request, "resolve-location", 30, 60);
    const { location } = await request.json();
    const result = await checkLocation(location);
    return Response.json(result, { status: result.unavailable ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ serviceable: false, reason: error.message === "RATE_LIMITED" ? "Too many checks. Try again shortly." : "Location verification is unavailable." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 });
  }
}
