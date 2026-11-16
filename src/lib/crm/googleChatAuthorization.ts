import "server-only";
import type { Account } from "next-auth";
import { getPrisma } from "@/lib/db/prisma";
import { decryptCredential, encryptCredential } from "@/lib/security/credentials";
import { chatScopes } from "./googleChatConfig";

function hasChatScopes(scopes: string | undefined) {
  const granted = new Set(scopes?.split(/\s+/));
  return chatScopes.every((scope) => granted.has(scope));
}

export async function saveCrmChatAuthorization(senderId: string, account: Account) {
  if (!hasChatScopes(account.scope) || !account.refresh_token) return false;

  const credential = encryptCredential(account.refresh_token);
  await getPrisma().crmChatSettings.upsert({
    where: { senderId },
    create: { senderId, credential },
    update: { credential },
  });
  return true;
}

export async function getCrmChatAccessToken(credential: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptCredential(credential),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const token = await response.json().catch(() => null) as { access_token?: string; scope?: string; error?: string } | null;
  if (token?.error === "invalid_grant" || (token?.scope && !hasChatScopes(token.scope))) return null;
  if (!response.ok || !token?.access_token) throw new Error(`Google OAuth token refresh failed (${response.status})`);
  return token.access_token;
}
