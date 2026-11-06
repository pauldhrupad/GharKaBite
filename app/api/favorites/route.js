import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { privateOrderJson as json } from "@/lib/order-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { calculateThaliPrice } from "@/lib/thali";
import { favoriteSelection } from "@/lib/favorite-draft";
import { favoriteName, favoriteRecord, favoriteResponse, MAX_FAVORITES } from "@/lib/favorites";
import Meal from "@/models/Meal";
import User from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to view favorites." }, { status: 401 });
  try {
    await dbConnect();
    const user = await User.findById(session.user.id).select("favorites").lean();
    if (!user) return json({ message: "Account unavailable." }, { status: 404 });
    return json({ favorites: (user.favorites || []).slice().reverse().map(favoriteResponse) });
  } catch { return json({ message: "Couldn’t load favorites." }, { status: 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to save favorites." }, { status: 401 });
  try {
    const body = request.headers.get("content-type")?.includes("application/json") ? await request.json().catch(() => null) : null;
    const selection = favoriteSelection(body), name = favoriteName(body?.name);
    if (!selection || !name) return json({ message: "Check the name and your Thali selections." }, { status: 400 });
    await enforceRateLimit(request, "write-favorites", 30, 300);
    await dbConnect();
    const meal = await Meal.findOne({ slug: selection.mealId, active: true, archivedAt: null, kind: { $ne: "dish" } }).lean();
    if (!meal || !meal.slots.includes(selection.preferredPeriod)) return json({ message: "This Thali or meal period is no longer available." }, { status: 409 });
    let price;
    try { price = calculateThaliPrice(meal, selection.selectedChoices, selection.selectedAddOns, selection.quantity); }
    catch (error) { return json({ message: error.message }, { status: 400 }); }
    const favorite = favoriteRecord(selection, name, meal, price);
    const result = await User.updateOne({
      _id: session.user.id, [`favorites.${MAX_FAVORITES - 1}`]: { $exists: false }, "favorites.signature": { $ne: favorite.signature },
    }, { $push: { favorites: favorite } }, { runValidators: true });
    if (result.modifiedCount) return json({ favorite: favoriteResponse(favorite), duplicate: false }, { status: 201 });
    const user = await User.findById(session.user.id).select("favorites").lean();
    if (!user) return json({ message: "Account unavailable." }, { status: 404 });
    const duplicate = user.favorites?.find((item) => item.signature === favorite.signature);
    if (duplicate) return json({ favorite: favoriteResponse(duplicate), duplicate: true });
    return json({ message: `You can save up to ${MAX_FAVORITES} favorites. Remove one before saving another.` }, { status: 409 });
  } catch (error) { return json({ message: error.message === "RATE_LIMITED" ? "Too many changes. Try again later." : "Couldn’t save the favorite." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}
