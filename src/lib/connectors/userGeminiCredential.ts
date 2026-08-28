import "server-only";
import { cookies } from "next/headers";
import { decryptCredential, encryptCredential } from "@/lib/security/credentials";

const cookieName = "share_ai_gemini_credential";

export async function getUserGeminiApiKey() {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(cookieName)?.value;
  if (!encrypted) return null;

  try {
    return decryptCredential(encrypted);
  } catch {
    return null;
  }
}

export async function saveUserGeminiApiKey(apiKey: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encryptCredential(apiKey), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearUserGeminiApiKey() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}
