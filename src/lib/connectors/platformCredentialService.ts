import "server-only";
import { encryptCredential } from "@/lib/security/credentials";
import { validatePlatformCredential } from "@/lib/connectors/credentialValidation";
import {
  replaceCredentialCore,
  toPublicCredentialStatus,
  type CredentialValidation,
  type PlatformCredentialSource,
  type PlatformProvider,
} from "@/lib/connectors/platformCredentialCore";
import {
  deletePlatformCredential,
  savePlatformCredential,
  updatePlatformCredentialHealth,
} from "@/lib/connectors/platformCredentialRepository";
import { resolvePlatformCredential } from "@/lib/connectors/platformCredentials";

export async function getPlatformCredentialStatus(provider: PlatformProvider) {
  return toPublicCredentialStatus(await resolvePlatformCredential(provider));
}

export async function replacePlatformCredential(provider: PlatformProvider, credential: string) {
  const result = await replaceCredentialCore({
    provider,
    credential,
    validate: validatePlatformCredential,
    encrypt: encryptCredential,
    save: savePlatformCredential,
  });

  if (!result.activated) {
    return { ...result, message: `${result.message} A conexão anterior continua ativa.` };
  }

  return result;
}

export async function testPlatformCredential(provider: PlatformProvider) {
  const resolution = await resolvePlatformCredential(provider);
  if (!resolution.credential) {
    return {
      ok: false,
      status: "disconnected" as const,
      message: "Nenhuma credencial está disponível para teste.",
      source: null,
    };
  }

  const validation = await validatePlatformCredential(provider, resolution.credential);
  await persistValidation(provider, resolution.source, validation);
  return {
    ok: validation.ok,
    status: validation.status,
    message: validation.ok ? "Conexão validada com sucesso." : validation.adminMessage,
    source: resolution.source,
  };
}

export async function removePlatformCredential(provider: PlatformProvider) {
  await deletePlatformCredential(provider);
  return getPlatformCredentialStatus(provider);
}

export async function recordPlatformCredentialFailure(
  provider: PlatformProvider,
  source: PlatformCredentialSource,
  validation: CredentialValidation,
) {
  await persistValidation(provider, source, validation);
}

async function persistValidation(provider: PlatformProvider, source: PlatformCredentialSource, validation: CredentialValidation) {
  if (source !== "managed") return;
  await updatePlatformCredentialHealth(provider, {
    status: validation.status,
    lastValidatedAt: new Date(),
    lastError: validation.adminMessage,
  }).catch(() => undefined);
}
