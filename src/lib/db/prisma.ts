import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { shareAiPrisma?: PrismaClient };

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("A persistência da plataforma está temporariamente indisponível.");
  }

  if (!globalForPrisma.shareAiPrisma) {
    const adapter = new PrismaNeon({ connectionString });
    globalForPrisma.shareAiPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.shareAiPrisma;
}
