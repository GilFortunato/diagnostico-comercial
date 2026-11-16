CREATE TABLE "CrmChatSettings" (
    "senderId" TEXT NOT NULL,
    "credential" TEXT,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmChatSettings_pkey" PRIMARY KEY ("senderId"),
    CONSTRAINT "CrmChatSettings_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
