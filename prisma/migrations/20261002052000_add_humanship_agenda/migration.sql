CREATE TABLE "HumanshipAgendaEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "location" TEXT,
  "format" TEXT NOT NULL DEFAULT 'presencial',
  "eventUrl" TEXT,
  "coverUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanshipAgendaEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HumanshipAgendaEvent_status_startAt_idx"
  ON "HumanshipAgendaEvent"("status", "startAt");

CREATE INDEX "HumanshipAgendaEvent_featured_startAt_idx"
  ON "HumanshipAgendaEvent"("featured", "startAt");

ALTER TABLE "HumanshipAgendaEvent"
  ADD CONSTRAINT "HumanshipAgendaEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
