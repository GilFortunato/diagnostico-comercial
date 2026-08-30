import "server-only";
import { decryptCredential } from "@/lib/security/credentials";
import { findPlatformCredential } from "@/lib/connectors/platformCredentialRepository";
import { resolveCredentialCore, type PlatformCredentialResolution, type PlatformProvider } from "@/lib/connectors/platformCredentialCore";

export async function resolveGeminiCredential() {
  return resolvePlatformCredential("gemini");
}

export async function resolveApifyCredential() {
  return resolvePlatformCredential("apify");
}

export async function resolvePlatformCredential(provider: PlatformProvider): Promise<PlatformCredentialResolution> {
  let stored = null;
  try {
    stored = await findPlatformCredential(provider);
  } catch {
    // Database incidents fall through to the emergency environment credential.
  }

  return resolveCredentialCore({
    stored,
    environmentCredential: getEnvironmentCredential(provider),
    decrypt: decryptCredential,
  });
}

function getEnvironmentCredential(provider: PlatformProvider) {
  if (provider === "gemini") return process.env.GEMINI_API_KEY;
  return process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN;
}
