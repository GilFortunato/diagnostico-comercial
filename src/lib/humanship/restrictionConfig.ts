import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import {
  currentRestrictionSnapshot,
  type HumanshipCompanyRestrictionGroup,
  type HumanshipRestrictionSnapshot,
} from "@/lib/humanship/restrictions";

type RestrictionRow = {
  version: string;
  companyGroups: unknown;
  roleReferences: unknown;
  updatedByName: string | null;
  createdAt: Date;
};

export type HumanshipRestrictionConfig = HumanshipRestrictionSnapshot & {
  updatedByName?: string;
  createdAt?: string;
};

export async function getCurrentHumanshipRestrictions(): Promise<HumanshipRestrictionConfig> {
  const rows = await getPrisma().$queryRaw<RestrictionRow[]>(Prisma.sql`
    SELECT "version", "companyGroups", "roleReferences", "updatedByName", "createdAt"
    FROM "HumanshipRestrictionConfig"
    WHERE "isCurrent" = true
    ORDER BY "createdAt" DESC
    LIMIT 1
  `).catch(() => []);

  const row = rows[0];
  if (!row) return currentRestrictionSnapshot();

  return {
    version: row.version,
    companyGroups: normalizeCompanyGroups(row.companyGroups),
    roleReferences: normalizeRoleReferences(row.roleReferences),
    updatedByName: row.updatedByName || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveHumanshipRestrictions(input: {
  companyGroups: HumanshipCompanyRestrictionGroup[];
  roleReferences: string[];
  updatedByName: string;
}) {
  const companyGroups = normalizeCompanyGroups(input.companyGroups);
  const roleReferences = normalizeRoleReferences(input.roleReferences);
  const version = await nextVersion();

  await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "HumanshipRestrictionConfig"
      SET "isCurrent" = false
      WHERE "isCurrent" = true
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "HumanshipRestrictionConfig"
        ("id", "version", "companyGroups", "roleReferences", "updatedByName", "isCurrent", "createdAt")
      VALUES (
        ${`hsrc_${randomUUID()}`},
        ${version},
        CAST(${JSON.stringify(companyGroups)} AS jsonb),
        CAST(${JSON.stringify(roleReferences)} AS jsonb),
        ${input.updatedByName},
        true,
        CURRENT_TIMESTAMP
      )
    `);
  });

  return getCurrentHumanshipRestrictions();
}

export async function applyCurrentHumanshipRestrictionsToEvent(eventId: string) {
  const current = await getCurrentHumanshipRestrictions();
  const snapshot: HumanshipRestrictionSnapshot = {
    version: current.version,
    companyGroups: current.companyGroups,
    roleReferences: current.roleReferences,
  };

  const updated = await getPrisma().$executeRaw(Prisma.sql`
    UPDATE "HumanshipEvent"
    SET
      "restrictionVersion" = ${current.version},
      "restrictionSnapshot" = CAST(${JSON.stringify(snapshot)} AS jsonb),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${eventId}
  `);

  return Number(updated) > 0 ? current : null;
}

async function nextVersion() {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await getPrisma().$queryRaw<Array<{ version: string }>>(Prisma.sql`
    SELECT "version"
    FROM "HumanshipRestrictionConfig"
    WHERE "version" LIKE ${`${day}-v%`}
  `).catch(() => []);
  const max = rows.reduce((value, row) => {
    const match = row.version.match(/-v(\d+)$/);
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 0);
  return `${day}-v${max + 1}`;
}

function normalizeCompanyGroups(value: unknown): HumanshipCompanyRestrictionGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        reference: String(record.reference || "").trim(),
        category: String(record.category || "").trim(),
        companies: Array.isArray(record.companies)
          ? record.companies.map((company) => String(company).trim()).filter(Boolean)
          : [],
      };
    })
    .filter((group) => group.reference && group.category && group.companies.length);
}

function normalizeRoleReferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}
