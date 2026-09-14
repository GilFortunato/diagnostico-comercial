import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { NormalizedLinkedInSnapshot } from "@/lib/connectors/linkedinNormalization";

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

export async function saveImportedLinkedInSnapshot(userId: string, linkedinUrl: string, snapshot: NormalizedLinkedInSnapshot) {
  const normalizedUrl = linkedinUrl.trim();
  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      linkedinUrl: normalizedUrl,
      linkedinUpdatedAt: new Date(snapshot.collectedAt),
      latestLinkedinSnapshot: snapshot as Prisma.InputJsonValue,
    },
    update: {
      linkedinUrl: normalizedUrl,
      linkedinUpdatedAt: new Date(snapshot.collectedAt),
      latestLinkedinSnapshot: snapshot as Prisma.InputJsonValue,
    },
    select: { id: true, linkedinUrl: true, linkedinUpdatedAt: true, lastAuthorityAnalysisAt: true, latestLinkedinSnapshot: true },
  });
}

export async function recordAuthorityProfileSnapshot(userId: string, linkedinUrl: string | null, snapshot: unknown) {
  const snapshotForCreate = snapshot == null ? Prisma.DbNull : snapshot as Prisma.InputJsonValue;
  const snapshotForUpdate = snapshot == null ? undefined : snapshot as Prisma.InputJsonValue;

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
