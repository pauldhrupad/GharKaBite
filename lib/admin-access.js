import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function currentSessionRole(token) {
  if (token?.role !== "admin" || !/^[a-f\d]{24}$/i.test(token.id || "")) return "customer";
  try {
    await dbConnect();
    return await User.exists({ _id: token.id, role: "admin" }) ? "admin" : "customer";
  } catch {
    return "customer";
  }
}
