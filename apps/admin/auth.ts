import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { findAllowedUser } from "@/lib/user-access";
import type { GrowthRole, GrowthUserStatus } from "@/lib/authz";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: GrowthRole;
      status: GrowthUserStatus;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    growthUserId?: string;
    growthRole?: GrowthRole;
    growthStatus?: GrowthUserStatus;
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "missing-google-client-id";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "missing-google-client-secret";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [Google({ clientId: googleClientId, clientSecret: googleClientSecret })],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 60 * 15 },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await findAllowedUser(user.email);
      return Boolean(allowed && allowed.status === "active");
    },
    async jwt({ token }) {
      if (!token.email) return token;
      const allowed = await findAllowedUser(token.email);
      if (!allowed) {
        token.growthUserId = undefined;
        token.growthRole = undefined;
        token.growthStatus = "disabled";
        return token;
      }
      token.growthUserId = allowed.id;
      token.growthRole = allowed.role;
      token.growthStatus = allowed.status;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.growthUserId ?? "";
        session.user.role = token.growthRole ?? "analyst";
        session.user.status = token.growthStatus ?? "disabled";
      }
      return session;
    }
  }
});
