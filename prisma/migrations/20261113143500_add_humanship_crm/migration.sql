-- CreateTable
CREATE TABLE "CrmAccount" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "segment" TEXT,
    "employeeRange" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "seniority" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunity" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT,
    "legacyId" TEXT,
    "accountId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Mapeado',
    "temperature" TEXT NOT NULL DEFAULT 'Frio',
    "priority" TEXT,
    "result" TEXT NOT NULL DEFAULT 'Em aberto',
    "contractClosed" BOOLEAN NOT NULL DEFAULT false,
    "contactStatus" TEXT,
    "relationship" TEXT,
    "owner" TEXT,
    "origin" TEXT,
    "channel" TEXT,
    "project" TEXT,
    "sponsorship" TEXT,
    "events" TEXT[],
    "nextAction" TEXT,
    "nextActionDate" DATE,
    "proposalDueDate" DATE,
    "proposedValue" DECIMAL(16,2),
    "soldValue" DECIMAL(16,2),
    "saleDate" DATE,
    "paymentMethod" TEXT,
    "downPayment" DECIMAL(16,2),
    "installmentCount" INTEGER,
    "notes" TEXT,
    "followUp" TEXT,
    "historicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityContact" (
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "CrmOpportunityContact_pkey" PRIMARY KEY ("opportunityId","contactId")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT,
    "opportunityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE,
    "channel" TEXT,
    "reaction" TEXT,
    "note" TEXT,
    "attempt" INTEGER,
    "stage" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmHuntingLink" (
    "leadId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "searchId" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmHuntingLink_pkey" PRIMARY KEY ("leadId","opportunityId")
);

-- CreateTable
CREATE TABLE "CrmImportRow" (
    "sheet" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "opportunityId" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "CrmImportRow_pkey" PRIMARY KEY ("sheet","rowNumber")
);

-- CreateTable
CREATE TABLE "CrmReportView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmReportView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmAccount_identityKey_key" ON "CrmAccount"("identityKey");

-- CreateIndex
CREATE INDEX "CrmAccount_name_idx" ON "CrmAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_accountId_identityKey_key" ON "CrmContact"("accountId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOpportunity_sourceKey_key" ON "CrmOpportunity"("sourceKey");

-- CreateIndex
CREATE INDEX "CrmOpportunity_accountId_idx" ON "CrmOpportunity"("accountId");

-- CreateIndex
CREATE INDEX "CrmOpportunity_stage_nextActionDate_idx" ON "CrmOpportunity"("stage", "nextActionDate");

-- CreateIndex
CREATE INDEX "CrmOpportunityContact_contactId_idx" ON "CrmOpportunityContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmActivity_sourceKey_key" ON "CrmActivity"("sourceKey");

-- CreateIndex
CREATE INDEX "CrmActivity_opportunityId_date_idx" ON "CrmActivity"("opportunityId", "date");

-- CreateIndex
CREATE INDEX "CrmActivity_kind_date_idx" ON "CrmActivity"("kind", "date");

-- CreateIndex
CREATE INDEX "CrmHuntingLink_opportunityId_idx" ON "CrmHuntingLink"("opportunityId");

-- CreateIndex
CREATE INDEX "CrmImportRow_opportunityId_idx" ON "CrmImportRow"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReportView_userId_name_key" ON "CrmReportView"("userId", "name");

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityContact" ADD CONSTRAINT "CrmOpportunityContact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityContact" ADD CONSTRAINT "CrmOpportunityContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmHuntingLink" ADD CONSTRAINT "CrmHuntingLink_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
