import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureGoogleUser } from "@/lib/auth/userRepository";
import { GOOGLE_SHEETS_SCOPE, saveHumanshipGoogleAuthorization } from "@/lib/humanship/googleAuthorization";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers:
    googleClientId && googleClientSecret
      ? [GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          authorization: {
            params: {
              scope: "openid email profile",
            },
          },
        })]
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

      if (account?.provider === "google" && account.scope?.split(/\s+/).includes(GOOGLE_SHEETS_SCOPE)) {
        await saveHumanshipGoogleAuthorization(user.id, account).catch((error) => {
          console.error("[humanship-google] failed to persist Sheets authorization", error);
        });
      }
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
  pages: { signIn: "/" },
};
