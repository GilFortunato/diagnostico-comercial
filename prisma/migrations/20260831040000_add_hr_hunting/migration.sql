DO $$
BEGIN
    CREATE TYPE "ConfidenceLevel" AS ENUM ('CONFIRMED', 'LIKELY', 'INFERENCE', 'UNVERIFIED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "HrHuntingSearch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "jobUrl" TEXT,
    "companyName" TEXT,
    "recruiterName" TEXT,
    "jobDna" JSONB NOT NULL,
    "searchTerms" TEXT[] NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'job_dna_ready',
    "sourceSnapshot" JSONB,
    "connectorWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrHuntingSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrHuntingCandidate" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "sourcePersonId" TEXT,
    "name" TEXT NOT NULL,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "location" TEXT,
    "profileUrl" TEXT,
    "professionalSummary" TEXT,
    "fitScore" INTEGER NOT NULL,
    "fitClassification" TEXT NOT NULL,
    "mainSignal" TEXT,
    "pointsToValidate" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceName" TEXT NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "rawSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrHuntingCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrHuntingCandidateEvidence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "criterionType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "evidence" TEXT,
    "source" TEXT NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrHuntingCandidateEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrHuntingCandidateContact" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "obtainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrHuntingCandidateContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrHuntingShortlist" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "nextStep" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrHuntingShortlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HrHuntingCandidate_searchId_profileUrl_key" ON "HrHuntingCandidate"("searchId", "profileUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "HrHuntingShortlist_candidateId_key" ON "HrHuntingShortlist"("candidateId");
CREATE INDEX IF NOT EXISTS "HrHuntingSearch_ownerId_updatedAt_idx" ON "HrHuntingSearch"("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "HrHuntingCandidate_searchId_fitScore_idx" ON "HrHuntingCandidate"("searchId", "fitScore");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrHuntingSearch_ownerId_fkey') THEN
        ALTER TABLE "HrHuntingSearch" ADD CONSTRAINT "HrHuntingSearch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrHuntingCandidate_searchId_fkey') THEN
        ALTER TABLE "HrHuntingCandidate" ADD CONSTRAINT "HrHuntingCandidate_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "HrHuntingSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrHuntingCandidateEvidence_candidateId_fkey') THEN
        ALTER TABLE "HrHuntingCandidateEvidence" ADD CONSTRAINT "HrHuntingCandidateEvidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrHuntingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrHuntingCandidateContact_candidateId_fkey') THEN
        ALTER TABLE "HrHuntingCandidateContact" ADD CONSTRAINT "HrHuntingCandidateContact_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrHuntingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrHuntingShortlist_candidateId_fkey') THEN
        ALTER TABLE "HrHuntingShortlist" ADD CONSTRAINT "HrHuntingShortlist_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrHuntingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
