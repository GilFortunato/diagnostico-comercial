BEGIN;

-- AlterTable
ALTER TABLE "CrmImportRow" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "opportunityId" TEXT NOT NULL,
    "meetingId" TEXT,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_status_check" CHECK ("status" IN ('Pendente', 'Concluída', 'Cancelada')),
    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmTask_requestId_key" ON "CrmTask"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTask_meetingId_key" ON "CrmTask"("meetingId");

-- CreateIndex
CREATE INDEX "CrmTask_opportunityId_status_dueDate_idx" ON "CrmTask"("opportunityId", "status", "dueDate");

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CrmActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry forward manually entered and imported next actions without changing their deadlines.
INSERT INTO "CrmTask" ("id", "opportunityId", "title", "owner", "dueDate", "updatedAt")
SELECT 'legacy:' || "id", "id", COALESCE(NULLIF(BTRIM("nextAction"), ''), 'Ação importada sem descrição'),
       "owner", "nextActionDate", CURRENT_TIMESTAMP
FROM "CrmOpportunity"
WHERE NULLIF(BTRIM("nextAction"), '') IS NOT NULL OR "nextActionDate" IS NOT NULL;

-- Link legacy reminders only when there is exactly one matching scheduled meeting.
UPDATE "CrmTask" AS task
SET "meetingId" = match.id
FROM (
  SELECT task.id AS task_id, MIN(activity.id) AS id
  FROM "CrmTask" task
  JOIN "CrmActivity" activity
    ON activity."opportunityId" = task."opportunityId" AND activity.date = task."dueDate"
  WHERE task.title = 'Participar da reunião' AND activity.kind = 'Reunião agendada'
  GROUP BY task.id HAVING COUNT(*) = 1
) AS match
WHERE task.id = match.task_id;

UPDATE "CrmOpportunity" AS opportunity
SET "nextAction" = task.title, "nextActionDate" = task."dueDate"
FROM "CrmTask" AS task
WHERE task.id = 'legacy:' || opportunity.id;

COMMIT;
