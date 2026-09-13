CREATE TABLE "HumanshipRoleRule" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "decidedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanshipRoleRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HumanshipRoleRule_decision_check" CHECK ("decision" IN ('accepted', 'rejected')),
  CONSTRAINT "HumanshipRoleRule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HumanshipRoleRule_ownerId_normalizedTitle_key"
ON "HumanshipRoleRule"("ownerId", "normalizedTitle");

CREATE INDEX "HumanshipRoleRule_ownerId_decision_idx"
ON "HumanshipRoleRule"("ownerId", "decision");
