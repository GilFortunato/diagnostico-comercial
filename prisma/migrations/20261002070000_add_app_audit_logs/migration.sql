CREATE TABLE IF NOT EXISTS "AppAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "moduleKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "retentionDays" INTEGER NOT NULL DEFAULT 7,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppAuditLog_createdAt_idx" ON "AppAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AppAuditLog_moduleKey_createdAt_idx" ON "AppAuditLog"("moduleKey", "createdAt");
CREATE INDEX IF NOT EXISTS "AppAuditLog_actorUserId_createdAt_idx" ON "AppAuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AppAuditLog_severity_createdAt_idx" ON "AppAuditLog"("severity", "createdAt");
