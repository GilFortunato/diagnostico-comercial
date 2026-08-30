-- Persist the exact authority assessment used by authenticated report exports.
CREATE TABLE "AuthorityAssessmentSnapshot" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "subjectName" TEXT,
    "businessUnitId" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "plan30Days" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityAssessmentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthorityAssessmentSnapshot_ownerId_businessUnitId_createdAt_idx"
ON "AuthorityAssessmentSnapshot"("ownerId", "businessUnitId", "createdAt");
