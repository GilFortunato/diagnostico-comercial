import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export async function getProfessionalProfile(userId: string) {
  return getPrisma().professionalProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      linkedinUrl: true,
      linkedinUpdatedAt: true,
      lastAuthorityAnalysisAt: true,
    },
  });
}

export async function saveProfessionalLinkedInUrl(userId: string, linkedinUrl: string) {
  const normalized = linkedinUrl.trim();
  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: { userId, linkedinUrl: normalized, linkedinUpdatedAt: new Date() },
    update: { linkedinUrl: normalized, linkedinUpdatedAt: new Date() },
    select: { id: true, linkedinUrl: true, linkedinUpdatedAt: true, lastAuthorityAnalysisAt: true },
  });
}

export async function recordAuthorityProfileSnapshot(userId: string, linkedinUrl: string | null, snapshot: unknown) {
  return getPrisma().professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      linkedinUrl,
      linkedinUpdatedAt: linkedinUrl ? new Date() : null,
      lastAuthorityAnalysisAt: new Date(),
      latestLinkedinSnapshot: snapshot as Prisma.InputJsonValue,
    },
    update: {
      linkedinUrl: linkedinUrl || undefined,
      lastAuthorityAnalysisAt: new Date(),
      latestLinkedinSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });
}
