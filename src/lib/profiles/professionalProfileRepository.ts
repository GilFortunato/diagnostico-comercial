import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { NormalizedLinkedInSnapshot } from "@/lib/connectors/linkedinNormalization";

const importMetadataKey = "_shareLinkedInImport";

type ImportMetadata = {
  source: "linkedin_archive";
  importedAt: string;
  filesUsed: string[];
};

export async function getProfessionalProfile(userId: string) {
  return getPrisma().professionalProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      linkedinUrl: true,
      linkedinUpdatedAt: true,
      lastAuthorityAnalysisAt: true,
      latestLinkedinSnapshot: true,
    },
  });
}

export async function saveProfessionalLinkedInUrl(userId: string, linkedinUrl: string) {
  const normalized = linkedinUrl.trim();
  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: { userId, linkedinUrl: normalized, linkedinUpdatedAt: new Date() },
    update: { linkedinUrl: normalized, linkedinUpdatedAt: new Date() },
    select: { id: true, linkedinUrl: true, linkedinUpdatedAt: true, lastAuthorityAnalysisAt: true, latestLinkedinSnapshot: true },
  });
}

export async function saveImportedLinkedInSnapshot(
  userId: string,
  linkedinUrl: string,
  snapshot: NormalizedLinkedInSnapshot,
  filesUsed: string[] = [],
) {
  const normalizedUrl = linkedinUrl.trim();
  const metadata: ImportMetadata = {
    source: "linkedin_archive",
    importedAt: snapshot.collectedAt,
    filesUsed,
  };
  const snapshotWithMetadata = {
    ...snapshot,
    [importMetadataKey]: metadata,
  } as unknown as Prisma.InputJsonValue;

  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      linkedinUrl: normalizedUrl,
      linkedinUpdatedAt: new Date(snapshot.collectedAt),
      latestLinkedinSnapshot: snapshotWithMetadata,
    },
    update: {
      linkedinUrl: normalizedUrl,
      linkedinUpdatedAt: new Date(snapshot.collectedAt),
      latestLinkedinSnapshot: snapshotWithMetadata,
    },
    select: { id: true, linkedinUrl: true, linkedinUpdatedAt: true, lastAuthorityAnalysisAt: true, latestLinkedinSnapshot: true },
  });
}

export async function recordAuthorityProfileSnapshot(userId: string, linkedinUrl: string | null, snapshot: unknown) {
  const existing = await getPrisma().professionalProfile.findUnique({
    where: { userId },
    select: { latestLinkedinSnapshot: true },
  });
  const importMetadata = readImportMetadata(existing?.latestLinkedinSnapshot);
  const persistedSnapshot = attachImportMetadata(snapshot, importMetadata);
  const snapshotForCreate = persistedSnapshot == null ? Prisma.DbNull : persistedSnapshot as Prisma.InputJsonValue;
  const snapshotForUpdate = persistedSnapshot == null ? undefined : persistedSnapshot as Prisma.InputJsonValue;

  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      linkedinUrl,
      linkedinUpdatedAt: linkedinUrl ? new Date() : null,
      lastAuthorityAnalysisAt: new Date(),
      latestLinkedinSnapshot: snapshotForCreate,
    },
    update: {
      linkedinUrl: linkedinUrl || undefined,
      lastAuthorityAnalysisAt: new Date(),
      latestLinkedinSnapshot: snapshotForUpdate,
    },
  });
}

export function readLinkedInImportMetadata(value: unknown) {
  return readImportMetadata(value);
}

function attachImportMetadata(snapshot: unknown, metadata: ImportMetadata | null) {
  if (!metadata || !isRecord(snapshot)) return snapshot;
  return { ...snapshot, [importMetadataKey]: metadata };
}

function readImportMetadata(value: unknown): ImportMetadata | null {
  if (!isRecord(value)) return null;
  const metadata = value[importMetadataKey];
  if (!isRecord(metadata) || metadata.source !== "linkedin_archive" || typeof metadata.importedAt !== "string") return null;
  return {
    source: "linkedin_archive",
    importedAt: metadata.importedAt,
    filesUsed: Array.isArray(metadata.filesUsed) ? metadata.filesUsed.filter((item): item is string => typeof item === "string") : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
