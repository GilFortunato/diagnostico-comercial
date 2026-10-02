CREATE TABLE IF NOT EXISTS "WhatsCampaign" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "baseText" TEXT NOT NULL,
  "tone" TEXT NOT NULL DEFAULT 'Profissional e acolhedor',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sourceFileName" TEXT,
  "mapping" JSONB NOT NULL DEFAULT '{}',
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "generatedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "rawData" JSONB NOT NULL DEFAULT '{}',
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "generatedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsCampaign_ownerId_updatedAt_idx" ON "WhatsCampaign"("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "WhatsCampaign_status_updatedAt_idx" ON "WhatsCampaign"("status", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsRecipient_campaignId_rowNumber_key" ON "WhatsRecipient"("campaignId", "rowNumber");
CREATE INDEX IF NOT EXISTS "WhatsRecipient_campaignId_status_idx" ON "WhatsRecipient"("campaignId", "status");

ALTER TABLE "WhatsRecipient"
  ADD CONSTRAINT "WhatsRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "WhatsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
