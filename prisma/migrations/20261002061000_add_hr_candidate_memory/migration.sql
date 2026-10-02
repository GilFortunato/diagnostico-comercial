ALTER TABLE "HrHuntingCandidate" ADD COLUMN IF NOT EXISTS "profileId" TEXT;

CREATE TABLE IF NOT EXISTS "HrCandidateProfile" (
  "id" TEXT NOT NULL,
  "profileKey" TEXT NOT NULL,
  "linkedinUrl" TEXT,
  "sourcePersonId" TEXT,
  "name" TEXT NOT NULL,
  "currentTitle" TEXT,
  "currentCompany" TEXT,
  "location" TEXT,
  "professionalSummary" TEXT,
  "sourceName" TEXT,
  "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'UNVERIFIED',
  "rawSnapshot" JSONB NOT NULL DEFAULT '{}',
  "lastExternalLookupAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrCandidateProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrCandidateReview" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "reviewerName" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "note" TEXT,
  "searchId" TEXT,
  "searchTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrCandidateReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HrCandidateProfile_profileKey_key" ON "HrCandidateProfile"("profileKey");
CREATE UNIQUE INDEX IF NOT EXISTS "HrCandidateProfile_linkedinUrl_key" ON "HrCandidateProfile"("linkedinUrl");
CREATE INDEX IF NOT EXISTS "HrCandidateProfile_currentTitle_idx" ON "HrCandidateProfile"("currentTitle");
CREATE INDEX IF NOT EXISTS "HrCandidateProfile_currentCompany_idx" ON "HrCandidateProfile"("currentCompany");
CREATE INDEX IF NOT EXISTS "HrCandidateProfile_lastExternalLookupAt_idx" ON "HrCandidateProfile"("lastExternalLookupAt");
CREATE INDEX IF NOT EXISTS "HrCandidateReview_profileId_createdAt_idx" ON "HrCandidateReview"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "HrCandidateReview_reviewerId_createdAt_idx" ON "HrCandidateReview"("reviewerId", "createdAt");
CREATE INDEX IF NOT EXISTS "HrHuntingCandidate_profileId_idx" ON "HrHuntingCandidate"("profileId");

ALTER TABLE "HrCandidateReview"
  ADD CONSTRAINT "HrCandidateReview_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "HrCandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrCandidateReview"
  ADD CONSTRAINT "HrCandidateReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrCandidateReview"
  ADD CONSTRAINT "HrCandidateReview_searchId_fkey"
  FOREIGN KEY ("searchId") REFERENCES "HrHuntingSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
