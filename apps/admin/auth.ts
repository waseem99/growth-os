import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { ensureBootstrapOwner, findAllowedUser } from "@/lib/user-repository";
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

type GrowthAuthorizedUser = {
  id?: string;
  email?: string | null;
  growthRole?: GrowthRole;
  growthStatus?: GrowthUserStatus;
};

const internalAdminEmail = process.env.INTERNAL_ADMIN_EMAIL?.trim().toLowerCase();
const internalAdminPassword = process.env.INTERNAL_ADMIN_PASSWORD;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

const derivedSecret = internalAdminPassword
  ? createHash("sha256").update(`growthos-auth:${internalAdminPassword}`).digest("hex")
  : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? derivedSecret,
  trustHost: true,
  providers: [
    Credentials({
      name: "Internal credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!internalAdminEmail || !internalAdminPassword) return null;
        if (email !== internalAdminEmail || !safeEqual(password, internalAdminPassword)) return null;

        const allowed = await ensureBootstrapOwner(email);
        if (!allowed || allowed.status !== "active") return null;

        return {
          id: allowed.id,
          email: allowed.email,
          name: allowed.name ?? "GrowthOS Owner",
          growthRole: allowed.role,
          growthStatus: allowed.status
        };
      }
    }),
    ...(googleClientId && googleClientSecret
      ? [Google({ clientId: googleClientId, clientSecret: googleClientSecret })]
      : [])
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 60 * 15 },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "credentials") {
        return (user as GrowthAuthorizedUser).growthStatus === "active";
      }
      const allowed = await findAllowedUser(user.email);
      return Boolean(allowed && allowed.status === "active");
    },
    async jwt({ token, user, account }) {
      const growthToken = token as GrowthToken;

      if (account?.provider === "credentials" && user?.email) {
        const authorized = user as GrowthAuthorizedUser;
        growthToken.email = user.email;
        growthToken.growthUserId = user.id;
        growthToken.growthRole = authorized.growthRole ?? "analyst";
        growthToken.growthStatus = authorized.growthStatus ?? "disabled";
        return token;
      }

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
