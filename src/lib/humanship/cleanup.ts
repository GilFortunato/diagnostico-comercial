import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export async function deleteAllHumanshipEvents(ownerId: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "HumanshipEvent" WHERE "ownerId" = ${ownerId}
  `);
  if (!rows.length) return 0;
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "HumanshipEvent" WHERE "ownerId" = ${ownerId}
  `);
  return rows.length;
}

export async function deleteHumanshipEvent(ownerId: string, eventId: string) {
  const count = await getPrisma().$executeRaw(Prisma.sql`
    DELETE FROM "HumanshipEvent" WHERE "id" = ${eventId} AND "ownerId" = ${ownerId}
  `);
  return Number(count) > 0;
}
