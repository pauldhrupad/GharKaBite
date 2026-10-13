import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 });
  return Response.json({ message: "Plan purchases are temporarily unavailable." }, { status: 410 });
}
