import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import { uploadAvatar } from "@/lib/avatar-upload";
import { enforceRateLimit } from "@/lib/rate-limit";
import User from "@/models/User";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await enforceRateLimit(request, "profile-avatar-upload", 10, 3600);
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return Response.json({ message: "User not found." }, { status: 404 });
    const form = await request.formData();
    const avatarUrl = await uploadAvatar(user, form.get("file"));
    return Response.json({ avatarUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const badFile = error.message?.startsWith("Choose a JPEG") || error.message === "The photo file is invalid.";
    return Response.json({ message: error.message === "RATE_LIMITED" ? "Too many uploads. Try again later." : badFile ? error.message : "Profile photo upload failed." }, { status: error.message === "RATE_LIMITED" ? 429 : badFile ? 400 : 503 });
  }
}
