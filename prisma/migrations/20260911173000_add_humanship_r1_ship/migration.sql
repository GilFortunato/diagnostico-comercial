CREATE TABLE "HumanshipEvent" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sourceKind" TEXT,
  "sourceName" TEXT,
  "sourceExternalId" TEXT,
  "sourceSheetName" TEXT,
  "sourceRowCount" INTEGER NOT NULL DEFAULT 0,
  "restrictionVersion" TEXT NOT NULL,
  "restrictionSnapshot" JSONB NOT NULL,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanshipEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanshipParticipant" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceRow" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "company" TEXT,
  "jobTitle" TEXT,
  "phone" TEXT,
  "sourcePayload" JSONB NOT NULL,
  "linkedinUrl" TEXT,
  "linkedinName" TEXT,
  "linkedinTitle" TEXT,
  "linkedinCompany" TEXT,
  "linkedinLocation" TEXT,
  "rawLinkedin" JSONB,
  "searchStatus" TEXT NOT NULL DEFAULT 'pending',
  "classification" TEXT NOT NULL DEFAULT 'pending',
  "classificationReason" TEXT,
  "roleReference" TEXT,
  "roleScore" INTEGER,
  "companyRestriction" TEXT,
  "humanDecision" TEXT NOT NULL DEFAULT 'pending',
  "decisionByName" TEXT,
  "decisionAt" TIMESTAMP(3),
  "message1CopiedAt" TIMESTAMP(3),
  "message2CopiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanshipParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HumanshipParticipant_eventId_sourceKey_key" ON "HumanshipParticipant"("eventId", "sourceKey");
CREATE INDEX "HumanshipEvent_ownerId_updatedAt_idx" ON "HumanshipEvent"("ownerId", "updatedAt");
CREATE INDEX "HumanshipParticipant_eventId_classification_idx" ON "HumanshipParticipant"("eventId", "classification");
CREATE INDEX "HumanshipParticipant_eventId_humanDecision_idx" ON "HumanshipParticipant"("eventId", "humanDecision");

ALTER TABLE "HumanshipEvent"
  ADD CONSTRAINT "HumanshipEvent_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HumanshipParticipant"
  ADD CONSTRAINT "HumanshipParticipant_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "HumanshipEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
