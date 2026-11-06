import { auth } from "@/auth";
import { quoteOrder, CheckoutError } from "@/lib/order-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { privateOrderJson as json } from "@/lib/order-response";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to review your order." }, { status: 401 });
  try {
    await enforceRateLimit(request, "order-quote", 120, 3600);
    const body = await request.json();
    const quote = await quoteOrder(session.user.id, body, body.paymentMethod);
    return json({ quote });
  } catch (error) {
    return json({ message: error instanceof CheckoutError ? error.message : error.message === "RATE_LIMITED" ? "Too many price checks. Try again later." : "Unable to validate this order. Please try again." }, { status: error.status || (error.message === "RATE_LIMITED" ? 429 : 503) });
  }
}
