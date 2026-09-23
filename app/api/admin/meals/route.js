import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { normalizeMeal, seedCatalog } from "@/lib/catalog";
import Meal from "@/models/Meal";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try { await seedCatalog(); return Response.json({ meals: await Meal.find({ archivedAt: null }).sort({ createdAt: -1 }).lean() }); }
  catch { return Response.json({ message: "Menu items are unavailable." }, { status: 503 }); }
}

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    await dbConnect();
    const meal = await Meal.create(normalizeMeal(await request.json()));
    return Response.json({ meal }, { status: 201 });
  } catch (error) {
    if (error.message === "INVALID_MEAL" || error.name === "ValidationError") return Response.json({ message: "Please check all menu item fields, choices and add-ons." }, { status: 400 });
    if (error.code === 11000) return Response.json({ message: "A menu item with this slug already exists." }, { status: 409 });
    return Response.json({ message: "Unable to create menu item." }, { status: 503 });
  }
}
