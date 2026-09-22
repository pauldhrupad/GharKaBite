import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { enforceRateLimit } from "@/lib/rate-limit";

if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured.");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email or phone",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        await enforceRateLimit(request, "login", 8, 300);
        const identifier = String(credentials?.identifier || "").trim();
        const password = String(credentials?.password || "");
        if (!identifier || identifier.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72 || !process.env.MONGODB_URI) return null;

        await dbConnect();
        const query = identifier.includes("@")
          ? { email: identifier.toLowerCase() }
          : { phone: identifier.replace(/\D/g, "") };
        const user = await User.findOne(query).select("+passwordHash");
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;

        return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role || "customer";
        session.user.phone = token.phone || "";
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith("/admin")) return session?.user?.role === "admin";
      if (pathname.startsWith("/profile") || pathname === "/orders" || pathname.startsWith("/subscriptions")) return Boolean(session?.user);
      return true;
    },
  },
});
