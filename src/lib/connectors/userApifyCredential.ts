import "server-only";
import { cookies } from "next/headers";
import { decryptCredential, encryptCredential } from "@/lib/security/credentials";

const cookieName = "share_ai_apify_credential";

export async function getUserApifyToken() {
  const cookieStore = await cookies();
  const encrypted = cookieStore.get(cookieName)?.value;
  if (!encrypted) return null;

  try {
    return decryptCredential(encrypted);
  } catch {
    return null;
  }
}

export async function saveUserApifyToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encryptCredential(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearUserApifyToken() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}
