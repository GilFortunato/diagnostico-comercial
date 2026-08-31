-- Extend Google-authenticated users without changing the authentication method.
ALTER TABLE "User"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "linkedinUpdatedAt" TIMESTAMP(3),
    "lastAuthorityAnalysisAt" TIMESTAMP(3),
    "latestLinkedinSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserModulePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserModulePermission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuthorityAssessmentSnapshot"
ADD COLUMN "profileUrl" TEXT,
ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sourceSnapshot" JSONB;

CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");
CREATE UNIQUE INDEX "UserModulePermission_userId_moduleKey_key" ON "UserModulePermission"("userId", "moduleKey");
CREATE INDEX "UserModulePermission_moduleKey_enabled_idx" ON "UserModulePermission"("moduleKey", "enabled");

ALTER TABLE "ProfessionalProfile"
ADD CONSTRAINT "ProfessionalProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserModulePermission"
ADD CONSTRAINT "UserModulePermission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
