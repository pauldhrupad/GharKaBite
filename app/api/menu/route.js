import { getMenu } from "@/lib/catalog";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";

export async function GET(request) {
  const date = new URL(request.url).searchParams.get("date") || kolkataDate();
  if (!allowedOrderDate(date)) return Response.json({ message: "Choose today or tomorrow." }, { status: 400 });
  try { return Response.json({ date, meals: await getMenu(date) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Menu is temporarily unavailable." }, { status: 503 }); }
}
