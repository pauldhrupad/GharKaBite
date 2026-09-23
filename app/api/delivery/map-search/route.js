import { searchMapAddresses } from "@/lib/delivery";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    await enforceRateLimit(request, "map-search", 30, 60);
    const { query } = await request.json();
    const result = await searchMapAddresses(query);
    return Response.json(result, { status: result.status === "unavailable" ? 503 : result.status === "invalid" ? 400 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many searches. Try again shortly." : "Map search is unavailable." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 });
  }
}
