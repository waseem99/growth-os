import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { findAllowedUser } from "@/lib/user-repository";
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

type GrowthToken = {
  email?: string | null;
  growthUserId?: string;
  growthRole?: GrowthRole;
  growthStatus?: GrowthUserStatus;
} & Record<string, unknown>;

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
      const growthToken = token as GrowthToken;
      if (!growthToken.email) return token;
      const allowed = await findAllowedUser(growthToken.email);
      if (!allowed) {
        growthToken.growthUserId = undefined;
        growthToken.growthRole = undefined;
        growthToken.growthStatus = "disabled";
        return token;
      }
      growthToken.growthUserId = allowed.id;
      growthToken.growthRole = allowed.role;
      growthToken.growthStatus = allowed.status;
      return token;
    },
    async session({ session, token }) {
      const growthToken = token as GrowthToken;
      if (session.user) {
        session.user.id = growthToken.growthUserId ?? "";
        session.user.role = growthToken.growthRole ?? "analyst";
        session.user.status = growthToken.growthStatus ?? "disabled";
      }
      return session;
    }
  }
});
