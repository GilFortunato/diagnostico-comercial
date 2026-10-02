import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type {
  HumanshipAgendaEvent,
  HumanshipAgendaEventFormat,
  HumanshipAgendaEventStatus,
} from "@/lib/humanship/agendaTypes";

type AgendaRow = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  format: string;
  eventUrl: string | null;
  coverUrl: string | null;
  status: string;
  featured: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function listHumanshipAgendaEvents(): Promise<HumanshipAgendaEvent[]> {
  const rows = await getPrisma().$queryRaw<AgendaRow[]>(Prisma.sql`
    SELECT "id", "title", "description", "startAt", "endAt", "location", "format", "eventUrl", "coverUrl",
           "status", "featured", "createdById", "createdAt", "updatedAt"
    FROM "HumanshipAgendaEvent"
    WHERE "status" <> 'archived'
    ORDER BY
      CASE WHEN "startAt" >= CURRENT_TIMESTAMP THEN 0 ELSE 1 END,
      "startAt" ASC,
      "updatedAt" DESC
  `);
  return rows.map(serializeAgendaEvent);
}

export async function getNextHumanshipAgendaEvent(): Promise<HumanshipAgendaEvent | null> {
  const rows = await getPrisma().$queryRaw<AgendaRow[]>(Prisma.sql`
    SELECT "id", "title", "description", "startAt", "endAt", "location", "format", "eventUrl", "coverUrl",
           "status", "featured", "createdById", "createdAt", "updatedAt"
    FROM "HumanshipAgendaEvent"
    WHERE "status" = 'published' AND COALESCE("endAt", "startAt") >= CURRENT_TIMESTAMP
    ORDER BY "featured" DESC, "startAt" ASC
    LIMIT 1
  `);
  return rows[0] ? serializeAgendaEvent(rows[0]) : null;
}

export async function createHumanshipAgendaEvent(input: {
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date | null;
  location?: string;
  format: HumanshipAgendaEventFormat;
  eventUrl?: string;
  coverUrl?: string;
  status: HumanshipAgendaEventStatus;
  featured?: boolean;
  createdById: string;
}): Promise<HumanshipAgendaEvent | null> {
  const id = `hsa_${randomUUID()}`;
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    if (input.featured) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "HumanshipAgendaEvent" SET "featured" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "featured" = true
      `);
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "HumanshipAgendaEvent" (
        "id", "title", "description", "startAt", "endAt", "location", "format", "eventUrl", "coverUrl",
        "status", "featured", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.title.trim()}, ${input.description?.trim() || null}, ${input.startAt}, ${input.endAt || null},
        ${input.location?.trim() || null}, ${input.format}, ${input.eventUrl?.trim() || null}, ${input.coverUrl?.trim() || null},
        ${input.status}, ${Boolean(input.featured)}, ${input.createdById}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  });

  return getHumanshipAgendaEvent(id);
}

export async function updateHumanshipAgendaEvent(id: string, input: {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  location?: string | null;
  format?: HumanshipAgendaEventFormat;
  eventUrl?: string | null;
  coverUrl?: string | null;
  status?: HumanshipAgendaEventStatus;
  featured?: boolean;
}): Promise<HumanshipAgendaEvent | null> {
  const current = await getHumanshipAgendaEvent(id);
  if (!current) return null;

  const next = {
    title: input.title?.trim() || current.title,
    description: input.description === undefined ? current.description : input.description?.trim() || null,
    startAt: input.startAt || new Date(current.startAt),
    endAt: input.endAt === undefined ? (current.endAt ? new Date(current.endAt) : null) : input.endAt,
    location: input.location === undefined ? current.location : input.location?.trim() || null,
    format: input.format || current.format,
    eventUrl: input.eventUrl === undefined ? current.eventUrl : input.eventUrl?.trim() || null,
    coverUrl: input.coverUrl === undefined ? current.coverUrl : input.coverUrl?.trim() || null,
    status: input.status || current.status,
    featured: input.featured ?? current.featured,
  };

  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    if (next.featured) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "HumanshipAgendaEvent" SET "featured" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" <> ${id} AND "featured" = true
      `);
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "HumanshipAgendaEvent" SET
        "title" = ${next.title},
        "description" = ${next.description},
        "startAt" = ${next.startAt},
        "endAt" = ${next.endAt},
        "location" = ${next.location},
        "format" = ${next.format},
        "eventUrl" = ${next.eventUrl},
        "coverUrl" = ${next.coverUrl},
        "status" = ${next.status},
        "featured" = ${next.featured},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `);
  });

  return getHumanshipAgendaEvent(id);
}

export async function deleteHumanshipAgendaEvent(id: string): Promise<boolean> {
  const count = await getPrisma().$executeRaw(Prisma.sql`
    DELETE FROM "HumanshipAgendaEvent" WHERE "id" = ${id}
  `);
  return Number(count) > 0;
}

async function getHumanshipAgendaEvent(id: string): Promise<HumanshipAgendaEvent | null> {
  const rows = await getPrisma().$queryRaw<AgendaRow[]>(Prisma.sql`
    SELECT "id", "title", "description", "startAt", "endAt", "location", "format", "eventUrl", "coverUrl",
           "status", "featured", "createdById", "createdAt", "updatedAt"
    FROM "HumanshipAgendaEvent"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeAgendaEvent(rows[0]) : null;
}

function serializeAgendaEvent(row: AgendaRow): HumanshipAgendaEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString(),
    location: row.location || undefined,
    format: row.format as HumanshipAgendaEventFormat,
    eventUrl: row.eventUrl || undefined,
    coverUrl: row.coverUrl || undefined,
    status: row.status as HumanshipAgendaEventStatus,
    featured: row.featured,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
