import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureGoogleUser } from "@/lib/auth/userRepository";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers:
    googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : [],
  callbacks: {
    async jwt({ token, account }) {
      if (!token.email) return token;
      const user = await ensureGoogleUser({
        email: token.email,
        name: token.name,
        image: typeof token.picture === "string" ? token.picture : null,
        recordLogin: Boolean(account),
      });
      token.userId = user.id;
      token.accountActive = user.active;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : token.sub;
        session.user.active = token.accountActive !== false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
