import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY or NEXTAUTH_SECRET is required before storing connector credentials.");
  }

  if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
    return createHash("sha256").update(raw).digest();
  }

  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be a 32-byte base64 value or a 64-character hex value.");
  }
  return key;
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptCredential(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted credential payload.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
}
