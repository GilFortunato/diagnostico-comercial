-- Global, encrypted platform credentials managed exclusively by administrators.
CREATE TYPE "PlatformCredentialProvider" AS ENUM ('GEMINI', 'APIFY');

CREATE TYPE "PlatformCredentialStatus" AS ENUM ('CONNECTED', 'LIMIT_REACHED', 'ERROR');

CREATE TABLE "PlatformCredential" (
    "id" TEXT NOT NULL,
    "provider" "PlatformCredentialProvider" NOT NULL,
    "encrypted" TEXT NOT NULL,
    "masked" TEXT NOT NULL,
    "status" "PlatformCredentialStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastValidatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformCredential_provider_key" ON "PlatformCredential"("provider");
