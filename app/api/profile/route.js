import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { validLocation } from "@/lib/delivery";

const indianMobilePattern = /^[6-9]\d{9}$/;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const user = await User.findById(session.user.id).select("name email phone addresses role").lean();
    if (!user) return Response.json({ message: "User not found." }, { status: 404 });
    return Response.json({ user });
  } catch {
    return Response.json({ message: "Profile data is temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, 5) : [];
    if (addresses.some((address) => address.location != null && !validLocation(address.location))) return Response.json({ message: "A saved map pin is invalid." }, { status: 400 });
    if (name.length < 2) return Response.json({ message: "Please enter a valid name." }, { status: 400 });
    if (!indianMobilePattern.test(phone)) return Response.json({ message: "Please enter a valid Indian mobile number." }, { status: 400 });

    await dbConnect();
    const duplicatePhone = await User.findOne({ phone, _id: { $ne: session.user.id } }).lean();
    if (duplicatePhone) return Response.json({ message: "That mobile number is already registered." }, { status: 409 });
    const user = await User.findByIdAndUpdate(session.user.id, { name, phone, addresses }, { returnDocument: "after", runValidators: true }).select("name email phone addresses role").lean();
    return Response.json({ user, message: "Profile updated." });
  } catch {
    return Response.json({ message: "Unable to update the profile right now." }, { status: 503 });
  }
}
