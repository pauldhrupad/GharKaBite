import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { enforceRateLimit } from "@/lib/rate-limit";
import { privateOrderJson as json } from "@/lib/order-response";
import { favoriteId, favoriteName, favoriteResponse } from "@/lib/favorites";
import User from "@/models/User";

const notFound = () => json({ message: "Favorite not found." }, { status: 404 });

export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to view this favorite." }, { status: 401 });
  const id = favoriteId((await params).id);
  if (!id) return notFound();
  try {
    await dbConnect();
    const user = await User.findOne({ _id: session.user.id, "favorites._id": id }).select({ favorites: { $elemMatch: { _id: id } } }).lean();
    const favorite = user?.favorites?.[0];
    return favorite ? json({ favorite: favoriteResponse(favorite) }) : notFound();
  } catch { return json({ message: "Couldn’t load this favorite." }, { status: 503 }); }
}

async function changeFavorite(request, params, remove) {
  const session = await auth();
  if (!session?.user?.id) return json({ message: "Sign in to manage favorites." }, { status: 401 });
  const id = favoriteId((await params).id);
  if (!id) return notFound();
  try {
    const body = !remove && request.headers.get("content-type")?.includes("application/json") ? await request.json().catch(() => null) : null;
    const name = favoriteName(body?.name);
    if (!remove && !name) return json({ message: "Enter a favorite name up to 60 characters." }, { status: 400 });
    await enforceRateLimit(request, "write-favorites", 30, 300);
    await dbConnect();
    const updated = await User.updateOne({ _id: session.user.id, "favorites._id": id }, remove ? { $pull: { favorites: { _id: id } } } : { $set: { "favorites.$.name": name } }, { runValidators: true });
    return updated.matchedCount ? json({ message: remove ? "Favorite removed." : "Favorite renamed.", ...(remove ? {} : { name }) }) : notFound();
  } catch (error) { return json({ message: error.message === "RATE_LIMITED" ? "Too many changes. Try again later." : "Couldn’t update this favorite." }, { status: error.message === "RATE_LIMITED" ? 429 : 503 }); }
}

export function PATCH(request, { params }) { return changeFavorite(request, params, false); }
export function DELETE(request, { params }) { return changeFavorite(request, params, true); }
