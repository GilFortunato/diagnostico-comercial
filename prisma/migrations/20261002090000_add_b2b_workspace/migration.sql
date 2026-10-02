CREATE TABLE IF NOT EXISTS "B2BWorkspaceSearch" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "queryHash" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "resultSnapshot" JSONB NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "reusedFromSearchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BWorkspaceSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "B2BLead" (
  "id" TEXT NOT NULL,
  "leadKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "title" TEXT,
  "linkedinUrl" TEXT,
  "domain" TEXT,
  "website" TEXT,
  "location" TEXT,
  "firstSeenById" TEXT NOT NULL,
  "firstSeenByName" TEXT NOT NULL,
  "firstSeenSearchId" TEXT,
  "payload" JSONB NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "B2BSearchLead" (
  "id" TEXT NOT NULL,
  "searchId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BSearchLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "B2BLeadList" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "shared" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BLeadList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "B2BLeadListItem" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "addedById" TEXT NOT NULL,
  "addedByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BLeadListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "B2BLead_leadKey_key" ON "B2BLead"("leadKey");
CREATE INDEX IF NOT EXISTS "B2BWorkspaceSearch_queryHash_updatedAt_idx" ON "B2BWorkspaceSearch"("queryHash", "updatedAt");
CREATE INDEX IF NOT EXISTS "B2BWorkspaceSearch_ownerId_updatedAt_idx" ON "B2BWorkspaceSearch"("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "B2BWorkspaceSearch_mode_updatedAt_idx" ON "B2BWorkspaceSearch"("mode", "updatedAt");
CREATE INDEX IF NOT EXISTS "B2BLead_kind_updatedAt_idx" ON "B2BLead"("kind", "updatedAt");
CREATE INDEX IF NOT EXISTS "B2BLead_firstSeenById_updatedAt_idx" ON "B2BLead"("firstSeenById", "updatedAt");
CREATE INDEX IF NOT EXISTS "B2BLead_linkedinUrl_idx" ON "B2BLead"("linkedinUrl");
CREATE INDEX IF NOT EXISTS "B2BLead_domain_idx" ON "B2BLead"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BSearchLead_searchId_leadId_key" ON "B2BSearchLead"("searchId", "leadId");
CREATE INDEX IF NOT EXISTS "B2BSearchLead_leadId_idx" ON "B2BSearchLead"("leadId");
CREATE INDEX IF NOT EXISTS "B2BLeadList_ownerId_updatedAt_idx" ON "B2BLeadList"("ownerId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BLeadListItem_listId_leadId_key" ON "B2BLeadListItem"("listId", "leadId");
CREATE INDEX IF NOT EXISTS "B2BLeadListItem_leadId_idx" ON "B2BLeadListItem"("leadId");

ALTER TABLE "B2BSearchLead"
  ADD CONSTRAINT "B2BSearchLead_searchId_fkey"
  FOREIGN KEY ("searchId") REFERENCES "B2BWorkspaceSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "B2BSearchLead"
  ADD CONSTRAINT "B2BSearchLead_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "B2BLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "B2BLeadListItem"
  ADD CONSTRAINT "B2BLeadListItem_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "B2BLeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "B2BLeadListItem"
  ADD CONSTRAINT "B2BLeadListItem_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "B2BLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
