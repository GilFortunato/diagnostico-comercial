import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureGoogleUser } from "@/lib/auth/userRepository";
import { GOOGLE_SHEETS_SCOPE, saveHumanshipGoogleAuthorization } from "@/lib/humanship/googleAuthorization";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { isAdminUser } from "@/lib/auth/admin";
import { crmChatPath, chatScopes, isCrmChatSender } from "@/lib/crm/googleChatConfig";
import { saveCrmChatAuthorization } from "@/lib/crm/googleChatAuthorization";

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
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google" || !chatScopes.some((scope) => account.scope?.split(/\s+/).includes(scope))) return true;
      return isCrmChatSender(user.email) && profile && "email_verified" in profile && profile.email_verified === true
        ? true : `${crmChatPath}?google=conta`;
    },
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

      if (account) {
        await writeAppAuditLog({
          actor: { id: user.id, name: user.name, email: user.email },
          moduleKey: "auth",
          action: "login",
          entityType: "session",
          severity: "info",
          retentionDays: 7,
          metadata: { provider: account.provider },
        });
      }

      if (account?.provider === "google" && account.scope?.split(/\s+/).includes(GOOGLE_SHEETS_SCOPE)) {
        await saveHumanshipGoogleAuthorization(user.id, account).catch((error) => {
          console.error("[humanship-google] failed to persist Sheets authorization", error);
        });
      }

      if (account?.provider === "google" && user.active && isAdminUser(user) && isCrmChatSender(user.email)) {
        await saveCrmChatAuthorization(user.id, account).catch(() => {
          console.error("[crm-chat] failed to store Google authorization");
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
