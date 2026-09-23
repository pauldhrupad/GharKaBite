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
    if (!current) return Response.json({ message: "Thali not found." }, { status: 404 });
    const body = await request.json();
    const normalized = normalizeMeal({ ...current.toObject(), ...body, slug: id });
    Object.assign(current, normalized);
    await current.save();
    return Response.json({ meal: current });
  } catch (error) {
    if (error.message === "INVALID_MEAL" || error.name === "ValidationError") return Response.json({ message: "Please check all Thali fields, choices and add-ons." }, { status: 400 });
    return Response.json({ message: "Unable to update Thali." }, { status: 503 });
  }
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    await dbConnect();
    const meal = await Meal.findOneAndUpdate({ slug: id, archivedAt: null }, { active: false, archivedAt: new Date() }, { returnDocument: "after" });
    if (!meal) return Response.json({ message: "Thali not found." }, { status: 404 });
    return Response.json({ message: "Thali archived." });
  } catch { return Response.json({ message: "Unable to archive Thali." }, { status: 503 }); }
}
