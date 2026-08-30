import "server-only";
import { Prisma } from "@prisma/client";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import type { AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { getPrisma } from "@/lib/db/prisma";

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
  assessment: AuthorityAssessment;
  plan30Days: AuthorityThirtyDayPlan | null;
  createdAt: Date;
};

export async function saveAuthorityAssessment(assessment: AuthorityAssessment, owner: AuthorityAssessmentOwner) {
  const createdAt = new Date(assessment.createdAt);
  await getPrisma().authorityAssessmentSnapshot.upsert({
    where: { id: assessment.id },
    create: {
      id: assessment.id,
      ownerId: owner.id,
      ownerEmail: owner.email,
      subjectName: owner.name,
      businessUnitId: assessment.input.businessUnitId,
      assessment: assessment as unknown as Prisma.InputJsonValue,
      createdAt,
      updatedAt: createdAt,
    },
    update: {
      ownerEmail: owner.email,
      subjectName: owner.name,
      assessment: assessment as unknown as Prisma.InputJsonValue,
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
    assessment: row.assessment as unknown as AuthorityAssessment,
    plan30Days: row.plan30Days as unknown as AuthorityThirtyDayPlan | null,
    createdAt: row.createdAt,
  };
}

export async function saveAuthorityPlanSnapshot(assessmentId: string, ownerId: string, plan: AuthorityThirtyDayPlan) {
  const result = await getPrisma().authorityAssessmentSnapshot.updateMany({
    where: { id: assessmentId, ownerId },
    data: { plan30Days: plan as unknown as Prisma.InputJsonValue },
  });
  return result.count > 0;
}
