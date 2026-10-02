-- Additive MKT Scout storage. Review and apply separately; never run automatically here.
CREATE TABLE "MktScoutRecord" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL DEFAULT '',
  "cacheKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "MktScoutRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MktScoutRecord_kind_ownerId_updatedAt_idx" ON "MktScoutRecord"("kind", "ownerId", "updatedAt");
CREATE INDEX "MktScoutRecord_expiresAt_idx" ON "MktScoutRecord"("expiresAt");
