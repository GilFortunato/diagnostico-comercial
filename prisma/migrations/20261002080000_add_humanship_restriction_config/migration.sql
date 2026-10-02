CREATE TABLE IF NOT EXISTS "HumanshipRestrictionConfig" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "companyGroups" JSONB NOT NULL,
  "roleReferences" JSONB NOT NULL,
  "updatedByName" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanshipRestrictionConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HumanshipRestrictionConfig_version_key"
ON "HumanshipRestrictionConfig"("version");

CREATE UNIQUE INDEX IF NOT EXISTS "HumanshipRestrictionConfig_single_current_idx"
ON "HumanshipRestrictionConfig"("isCurrent")
WHERE "isCurrent" = true;

CREATE INDEX IF NOT EXISTS "HumanshipRestrictionConfig_createdAt_idx"
ON "HumanshipRestrictionConfig"("createdAt");
