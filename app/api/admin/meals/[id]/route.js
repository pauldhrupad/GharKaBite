import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { normalizeMeal } from "@/lib/catalog";
import Meal from "@/models/Meal";

export async function PATCH(request, { params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    await dbConnect();
    const current = await Meal.findOne({ slug: id, archivedAt: null });
    if (!current) return Response.json({ message: "Meal not found." }, { status: 404 });
    const body = await request.json();
    const normalized = normalizeMeal({ ...current.toObject(), ...body, slug: id });
    Object.assign(current, normalized);
    await current.save();
    return Response.json({ meal: current });
  } catch (error) {
    if (error.message === "INVALID_MEAL" || error.name === "ValidationError") return Response.json({ message: "Please check all meal fields." }, { status: 400 });
    return Response.json({ message: "Unable to update meal." }, { status: 503 });
  }
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    await dbConnect();
    const meal = await Meal.findOneAndUpdate({ slug: id, archivedAt: null }, { active: false, archivedAt: new Date() }, { new: true });
    if (!meal) return Response.json({ message: "Meal not found." }, { status: 404 });
    return Response.json({ message: "Meal archived." });
  } catch { return Response.json({ message: "Unable to delete meal." }, { status: 503 }); }
}
