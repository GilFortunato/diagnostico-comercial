-- Establish the Google-authenticated user base when this database started from
-- the earlier incremental migrations, then extend existing installations safely.
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "ProfessionalProfile" (
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

CREATE TABLE IF NOT EXISTS "UserModulePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserModulePermission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuthorityAssessmentSnapshot"
ADD COLUMN IF NOT EXISTS "profileUrl" TEXT,
ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "sourceSnapshot" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserModulePermission_userId_moduleKey_key" ON "UserModulePermission"("userId", "moduleKey");
CREATE INDEX IF NOT EXISTS "UserModulePermission_moduleKey_enabled_idx" ON "UserModulePermission"("moduleKey", "enabled");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfessionalProfile_userId_fkey') THEN
        ALTER TABLE "ProfessionalProfile"
        ADD CONSTRAINT "ProfessionalProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserModulePermission_userId_fkey') THEN
        ALTER TABLE "UserModulePermission"
        ADD CONSTRAINT "UserModulePermission_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
