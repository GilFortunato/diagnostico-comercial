import "server-only";
import { PlatformCredentialProvider, PlatformCredentialStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { PlatformCredentialHealth, PlatformProvider, StoredPlatformCredential } from "@/lib/connectors/platformCredentialCore";

export async function findPlatformCredential(provider: PlatformProvider): Promise<StoredPlatformCredential | null> {
  const row = await getPrisma().platformCredential.findUnique({
    where: { provider: toDatabaseProvider(provider) },
  });
  if (!row) return null;

  return {
    encrypted: row.encrypted,
    masked: row.masked,
    status: fromDatabaseStatus(row.status),
    lastValidatedAt: row.lastValidatedAt,
    lastError: row.lastError,
  };
}

export async function savePlatformCredential(input: {
  provider: PlatformProvider;
  encrypted: string;
  masked: string;
  status: "connected";
  lastValidatedAt: Date;
  lastError: null;
}) {
  await getPrisma().platformCredential.upsert({
    where: { provider: toDatabaseProvider(input.provider) },
    create: {
      provider: toDatabaseProvider(input.provider),
      encrypted: input.encrypted,
      masked: input.masked,
      status: PlatformCredentialStatus.CONNECTED,
      lastValidatedAt: input.lastValidatedAt,
      lastError: null,
    },
    update: {
      encrypted: input.encrypted,
      masked: input.masked,
      status: PlatformCredentialStatus.CONNECTED,
      lastValidatedAt: input.lastValidatedAt,
      lastError: null,
    },
  });
}

export async function updatePlatformCredentialHealth(
  provider: PlatformProvider,
  input: { status: Exclude<PlatformCredentialHealth, "disconnected">; lastValidatedAt: Date | null; lastError: string | null },
) {
  await getPrisma().platformCredential.updateMany({
    where: { provider: toDatabaseProvider(provider) },
    data: {
      status: toDatabaseStatus(input.status),
      lastValidatedAt: input.lastValidatedAt,
      lastError: input.lastError,
    },
  });
}

export async function deletePlatformCredential(provider: PlatformProvider) {
  await getPrisma().platformCredential.deleteMany({ where: { provider: toDatabaseProvider(provider) } });
}

function toDatabaseProvider(provider: PlatformProvider) {
  if (provider === "gemini") return PlatformCredentialProvider.GEMINI;
  if (provider === "manus") return PlatformCredentialProvider.MANUS;
  return PlatformCredentialProvider.APIFY;
}

function toDatabaseStatus(status: Exclude<PlatformCredentialHealth, "disconnected">) {
  if (status === "limit_reached") return PlatformCredentialStatus.LIMIT_REACHED;
  if (status === "error") return PlatformCredentialStatus.ERROR;
  return PlatformCredentialStatus.CONNECTED;
}

function fromDatabaseStatus(status: PlatformCredentialStatus): StoredPlatformCredential["status"] {
  if (status === PlatformCredentialStatus.LIMIT_REACHED) return "limit_reached";
  if (status === PlatformCredentialStatus.ERROR) return "error";
  return "connected";
}
