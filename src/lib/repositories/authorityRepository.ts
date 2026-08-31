import "server-only";
import { Prisma } from "@prisma/client";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import type { AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { getPrisma } from "@/lib/db/prisma";
import { sanitizePrismaJson, stripUnsupportedText } from "@/lib/repositories/prismaJson";

export type AuthorityAssessmentOwner = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AuthorityAssessmentSnapshotRecord = {
  id: string;
  ownerId: string;
  ownerEmail: string | null;
  subjectName: string | null;
  businessUnitId: string;
  profileUrl: string | null;
  schemaVersion: number;
  sourceSnapshot: unknown | null;
  assessment: AuthorityAssessment;
  plan30Days: AuthorityThirtyDayPlan | null;
  createdAt: Date;
};

export async function saveAuthorityAssessment(assessment: AuthorityAssessment, owner: AuthorityAssessmentOwner) {
  const createdAt = new Date(assessment.createdAt);
  const sanitizedAssessment = sanitizePrismaJson(assessment) as Prisma.InputJsonValue;
  const sanitizedSourceSnapshot = assessment.input.linkedinSnapshot == null
    ? Prisma.DbNull
    : sanitizePrismaJson(assessment.input.linkedinSnapshot) as Prisma.InputJsonValue;
  const ownerEmail = owner.email ? stripUnsupportedText(owner.email) : null;
  const subjectName = assessment.analyzedProfileName ? stripUnsupportedText(assessment.analyzedProfileName) : null;
  const profileUrl = assessment.input.profileUrl ? stripUnsupportedText(assessment.input.profileUrl) : null;
  const businessUnitId = stripUnsupportedText(assessment.input.businessUnitId);

  await getPrisma().authorityAssessmentSnapshot.upsert({
    where: { id: assessment.id },
    create: {
      id: stripUnsupportedText(assessment.id),
      ownerId: stripUnsupportedText(owner.id),
      ownerEmail,
      subjectName,
      businessUnitId,
      profileUrl,
      schemaVersion: assessment.schemaVersion,
      sourceSnapshot: sanitizedSourceSnapshot,
      assessment: sanitizedAssessment,
      createdAt,
      updatedAt: createdAt,
    },
    update: {
      ownerEmail,
      subjectName,
      profileUrl,
      schemaVersion: assessment.schemaVersion,
      sourceSnapshot: sanitizedSourceSnapshot,
      assessment: sanitizedAssessment,
    },
  });
  return assessment;
}

export async function listAuthorityAssessments(businessUnitId: string, ownerId: string) {
  const rows = await getPrisma().authorityAssessmentSnapshot.findMany({
    where: { businessUnitId, ownerId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { assessment: true },
  });

  return rows.map((row) => row.assessment as unknown as AuthorityAssessment);
}

export async function findAuthorityAssessmentSnapshot(id: string): Promise<AuthorityAssessmentSnapshotRecord | null> {
  const row = await getPrisma().authorityAssessmentSnapshot.findUnique({ where: { id } });
  if (!row) return null;

  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerEmail: row.ownerEmail,
    subjectName: row.subjectName,
    businessUnitId: row.businessUnitId,
    profileUrl: row.profileUrl,
    schemaVersion: row.schemaVersion,
    sourceSnapshot: row.sourceSnapshot,
    assessment: row.assessment as unknown as AuthorityAssessment,
    plan30Days: row.plan30Days as unknown as AuthorityThirtyDayPlan | null,
    createdAt: row.createdAt,
  };
}

export async function findOwnedAuthorityAssessmentSnapshot(id: string, ownerId: string) {
  const snapshot = await findAuthorityAssessmentSnapshot(id);
  return snapshot?.ownerId === ownerId ? snapshot : null;
}

export async function saveAuthorityPlanSnapshot(assessmentId: string, ownerId: string, plan: AuthorityThirtyDayPlan) {
  const result = await getPrisma().authorityAssessmentSnapshot.updateMany({
    where: { id: assessmentId, ownerId },
    data: { plan30Days: sanitizePrismaJson(plan) as Prisma.InputJsonValue },
  });
  return result.count > 0;
}
