import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { enforceRateLimit } from "@/lib/rate-limit";

const indianMobilePattern = /^[6-9]\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    await enforceRateLimit(request, "register", 5, 3600);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const password = String(body.password || "");

    if (name.length < 2 || name.length > 80 || /<[^>]*>/.test(name)) return Response.json({ message: "Please enter your full name." }, { status: 400 });
    if (email.length > 254 || !emailPattern.test(email)) return Response.json({ message: "Please enter a valid email address." }, { status: 400 });
    if (!indianMobilePattern.test(phone)) return Response.json({ message: "Please enter a valid 10-digit Indian mobile number." }, { status: 400 });
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) return Response.json({ message: "Password must be 8 to 72 bytes long." }, { status: 400 });

    await dbConnect();
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] }).lean();
    if (existingUser) return Response.json({ message: "An account already exists with this email or phone." }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, phone, passwordHash });
    return Response.json({ user: { id: user._id.toString(), name: user.name, email: user.email } }, { status: 201 });
  } catch (error) {
    if (error.message === "RATE_LIMITED") return Response.json({ message: "Too many registrations. Try again later." }, { status: 429 });
    const message = error.message === "MONGODB_URI is not configured."
      ? "Database is not configured yet. Add MONGODB_URI to .env.local."
      : "Unable to create the account right now.";
    return Response.json({ message }, { status: 503 });
  }
}
