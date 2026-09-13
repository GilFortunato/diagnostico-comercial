import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { getPrisma } from "@/lib/db/prisma";
import { normalizeCandidates } from "@/lib/hr-hunting/service";
import { buildHumanshipLinkedinQueries, chooseHumanshipLinkedinMatch, type HumanshipLinkedinMatch } from "@/lib/humanship/linkedinMatch";
import { classifyHumanshipParticipant, currentRestrictionSnapshot, humanshipRestrictionVersion, normalizeHumanshipRoleTitle } from "@/lib/humanship/restrictions";
import type { HumanshipDecision, HumanshipEvent, HumanshipParticipant, HumanshipRoleRule, HumanshipRoleRuleDecision, ImportedHumanshipRow } from "@/lib/humanship/types";

type EventRow = {
  id: string; ownerId: string; name: string; status: string; sourceKind: string | null; sourceName: string | null; sourceExternalId: string | null;
  sourceSheetName: string | null; sourceRowCount: number; restrictionVersion: string; lastSyncedAt: Date | null; createdAt: Date; updatedAt: Date;
};

type ParticipantRow = {
  id: string; eventId: string; sourceKey: string; sourceRow: number | null; active: boolean; fullName: string; email: string | null; company: string | null;
  jobTitle: string | null; phone: string | null; linkedinUrl: string | null; linkedinName: string | null; linkedinTitle: string | null; linkedinCompany: string | null;
  linkedinLocation: string | null; searchStatus: string; classification: string; classificationReason: string | null; roleReference: string | null; roleScore: number | null;
  companyRestriction: string | null; humanDecision: string; decisionByName: string | null; decisionAt: Date | null; message1CopiedAt: Date | null; message2CopiedAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

type RoleRuleRow = {
  id: string; ownerId: string; normalizedTitle: string; title: string; decision: string; decidedByName: string | null; createdAt: Date; updatedAt: Date;
};

export async function createHumanshipEvent(ownerId: string, name: string) {
  const id = `hse_${randomUUID()}`;
  const snapshot = currentRestrictionSnapshot();
  await getPrisma().$executeRaw(Prisma.sql`
    INSERT INTO "HumanshipEvent" ("id", "ownerId", "name", "restrictionVersion", "restrictionSnapshot", "createdAt", "updatedAt")
    VALUES (${id}, ${ownerId}, ${name.trim()}, ${humanshipRestrictionVersion}, CAST(${JSON.stringify(snapshot)} AS jsonb), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  return getHumanshipEvent(ownerId, id);
}

export async function listHumanshipEvents(ownerId: string) {
  const rows = await getPrisma().$queryRaw<EventRow[]>(Prisma.sql`
    SELECT "id", "ownerId", "name", "status", "sourceKind", "sourceName", "sourceExternalId", "sourceSheetName", "sourceRowCount", "restrictionVersion", "lastSyncedAt", "createdAt", "updatedAt"
    FROM "HumanshipEvent"
    WHERE "ownerId" = ${ownerId}
    ORDER BY "updatedAt" DESC
  `);
  return rows.map((row) => serializeEvent(row, []));
}

export async function getHumanshipRoleRules(ownerId: string): Promise<HumanshipRoleRule[]> {
  const rows = await getPrisma().$queryRaw<RoleRuleRow[]>(Prisma.sql`
    SELECT "id", "ownerId", "normalizedTitle", "title", "decision", "decidedByName", "createdAt", "updatedAt"
    FROM "HumanshipRoleRule"
    WHERE "ownerId" = ${ownerId}
    ORDER BY "decision" ASC, "title" ASC
  `);
  return rows.map(serializeRoleRule);
}

export async function getHumanshipEvent(ownerId: string, id: string): Promise<HumanshipEvent | null> {
  const events = await getPrisma().$queryRaw<EventRow[]>(Prisma.sql`
    SELECT "id", "ownerId", "name", "status", "sourceKind", "sourceName", "sourceExternalId", "sourceSheetName", "sourceRowCount", "restrictionVersion", "lastSyncedAt", "createdAt", "updatedAt"
    FROM "HumanshipEvent"
    WHERE "id" = ${id} AND "ownerId" = ${ownerId}
    LIMIT 1
  `);
  const event = events[0];
  if (!event) return null;
  const [participants, roleRules] = await Promise.all([
    getPrisma().$queryRaw<ParticipantRow[]>(Prisma.sql`
      SELECT "id", "eventId", "sourceKey", "sourceRow", "active", "fullName", "email", "company", "jobTitle", "phone", "linkedinUrl", "linkedinName", "linkedinTitle", "linkedinCompany", "linkedinLocation", "searchStatus", "classification", "classificationReason", "roleReference", "roleScore", "companyRestriction", "humanDecision", "decisionByName", "decisionAt", "message1CopiedAt", "message2CopiedAt", "createdAt", "updatedAt"
      FROM "HumanshipParticipant"
      WHERE "eventId" = ${id} AND "active" = true
      ORDER BY CASE "classification" WHEN 'eligible' THEN 1 WHEN 'validate' THEN 2 WHEN 'possible_rejected' THEN 3 ELSE 4 END, "fullName" ASC
    `),
    getHumanshipRoleRules(ownerId),
  ]);
  return serializeEvent(event, participants.map(serializeParticipant), roleRules);
}

export async function syncHumanshipRows(input: {
  ownerId: string;
  eventId: string;
  rows: ImportedHumanshipRow[];
  sourceKind: "excel" | "google_sheets";
  sourceName: string;
  sourceExternalId?: string;
  sourceSheetName?: string;
}) {
  const event = await getHumanshipEvent(input.ownerId, input.eventId);
  if (!event) return null;
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`UPDATE "HumanshipParticipant" SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "eventId" = ${input.eventId}`);
    for (const row of input.rows) {
      const participantId = `hsp_${randomUUID()}`;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "HumanshipParticipant" (
          "id", "eventId", "sourceKey", "sourceRow", "active", "fullName", "email", "company", "jobTitle", "phone", "sourcePayload", "createdAt", "updatedAt"
        ) VALUES (
          ${participantId}, ${input.eventId}, ${row.sourceKey}, ${row.sourceRow}, true, ${row.fullName}, ${row.email || null}, ${row.company || null}, ${row.jobTitle || null}, ${row.phone || null}, CAST(${JSON.stringify(row.sourcePayload)} AS jsonb), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("eventId", "sourceKey") DO UPDATE SET
          "sourceRow" = EXCLUDED."sourceRow",
          "active" = true,
          "fullName" = EXCLUDED."fullName",
          "email" = EXCLUDED."email",
          "company" = EXCLUDED."company",
          "jobTitle" = EXCLUDED."jobTitle",
          "phone" = EXCLUDED."phone",
          "sourcePayload" = EXCLUDED."sourcePayload",
          "updatedAt" = CURRENT_TIMESTAMP
      `);
    }
    await tx.$executeRaw(Prisma.sql`
      UPDATE "HumanshipEvent" SET
        "sourceKind" = ${input.sourceKind},
        "sourceName" = ${input.sourceName},
        "sourceExternalId" = ${input.sourceExternalId || null},
        "sourceSheetName" = ${input.sourceSheetName || null},
        "sourceRowCount" = ${input.rows.length},
        "status" = 'source_ready',
        "lastSyncedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.eventId} AND "ownerId" = ${input.ownerId}
    `);
  });
  return getHumanshipEvent(input.ownerId, input.eventId);
}

export async function runHumanshipLinkedinSearch(ownerId: string, eventId: string, options?: { rescan?: boolean }) {
  const event = await getHumanshipEvent(ownerId, eventId);
  if (!event) return null;
  const roleRules = new Map((event.roleRules ?? []).map((rule) => [rule.normalizedTitle, rule.decision]));
  await getPrisma().$executeRaw(Prisma.sql`UPDATE "HumanshipEvent" SET "status" = 'searching', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${eventId} AND "ownerId" = ${ownerId}`);
  const targets = event.participants.filter((participant) => options?.rescan || !["found", "probable"].includes(participant.searchStatus));

  await concurrentMap(targets, 4, async (participant) => {
    await updateSearchStatus(participant.id, "searching");
    try {
      const queries = buildHumanshipLinkedinQueries(participant);
      let match: HumanshipLinkedinMatch | null = null;
      const attemptedQueries: string[] = [];

      for (const query of queries) {
        attemptedQueries.push(query);
        const raw = await runApifyActor("linkedinProfileSearch", {
          profileScraperMode: "Short",
          maxItems: match ? 18 : 12,
          takePages: match ? 2 : 1,
          searchQuery: query,
        });
        const candidates = normalizeCandidates(raw);
        const current = chooseHumanshipLinkedinMatch(participant, candidates);
        if (current && (!match || match.confidence !== "confirmed" || current.confidence === "confirmed" || current.score > match.score)) match = current;
        if (match?.confidence === "confirmed") break;
      }

      const best = match?.candidate;
      const roleTitle = best?.currentTitle || participant.jobTitle;
      const classification = classifyHumanshipParticipant({
        sourceCompany: participant.company,
        sourceTitle: participant.jobTitle,
        linkedinCompany: best?.currentCompany,
        linkedinTitle: best?.currentTitle,
        linkedinFound: Boolean(best?.profileUrl),
        roleRuleDecision: roleRules.get(normalizeHumanshipRoleTitle(roleTitle)) ?? null,
      });
      const probable = match?.confidence === "probable";
      const finalClassification = probable && classification.classification === "eligible" ? "validate" : classification.classification;
      const classificationReason = probable
        ? `Correspondência provável no LinkedIn; valide o perfil antes da decisão final. ${classification.reason}`
        : classification.reason;
      const rawSnapshot = best
        ? { ...best, humanshipMatch: { confidence: match?.confidence, score: match?.score, nameScore: match?.nameScore, companyScore: match?.companyScore, titleScore: match?.titleScore, queries: attemptedQueries } }
        : null;
      const searchStatus = best?.profileUrl ? (probable ? "probable" : "found") : "not_found";

      await getPrisma().$executeRaw(Prisma.sql`
        UPDATE "HumanshipParticipant" SET
          "linkedinUrl" = ${best?.profileUrl || null},
          "linkedinName" = ${best?.name || null},
          "linkedinTitle" = ${best?.currentTitle || null},
          "linkedinCompany" = ${best?.currentCompany || null},
          "linkedinLocation" = ${best?.location || null},
          "rawLinkedin" = ${rawSnapshot ? Prisma.sql`CAST(${JSON.stringify(rawSnapshot)} AS jsonb)` : Prisma.sql`NULL`},
          "searchStatus" = ${searchStatus},
          "classification" = ${finalClassification},
          "classificationReason" = ${classificationReason},
          "roleReference" = ${classification.roleAssessment.reference},
          "roleScore" = ${classification.roleAssessment.score},
          "companyRestriction" = ${classification.companyAssessment.restricted ? classification.companyAssessment.reason : null},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${participant.id}
      `);
    } catch (error) {
      const ruleDecision = roleRules.get(normalizeHumanshipRoleTitle(participant.jobTitle)) ?? null;
      const classification = classifyHumanshipParticipant({
        sourceCompany: participant.company,
        sourceTitle: participant.jobTitle,
        linkedinFound: false,
        roleRuleDecision: ruleDecision,
      });
      await getPrisma().$executeRaw(Prisma.sql`
        UPDATE "HumanshipParticipant" SET
          "searchStatus" = 'error',
          "classification" = ${classification.classification},
          "classificationReason" = ${`Falha ao consultar a fonte LinkedIn nesta execução. ${classification.reason}`},
          "roleReference" = ${classification.roleAssessment.reference},
          "roleScore" = ${classification.roleAssessment.score},
          "companyRestriction" = ${classification.companyAssessment.restricted ? classification.companyAssessment.reason : null},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${participant.id}
      `);
      console.warn("[humanship] participant search failed", { participantId: participant.id, errorName: error instanceof Error ? error.name : "UnknownError" });
    }
  });

  await getPrisma().$executeRaw(Prisma.sql`UPDATE "HumanshipEvent" SET "status" = 'results_ready', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${eventId} AND "ownerId" = ${ownerId}`);
  return getHumanshipEvent(ownerId, eventId);
}

export async function saveHumanshipRoleRule(input: {
  ownerId: string;
  participantId: string;
  decision: HumanshipRoleRuleDecision;
  decidedByName: string;
}) {
  const participants = await getPrisma().$queryRaw<ParticipantRow[]>(Prisma.sql`
    SELECT p."id", p."eventId", p."sourceKey", p."sourceRow", p."active", p."fullName", p."email", p."company", p."jobTitle", p."phone", p."linkedinUrl", p."linkedinName", p."linkedinTitle", p."linkedinCompany", p."linkedinLocation", p."searchStatus", p."classification", p."classificationReason", p."roleReference", p."roleScore", p."companyRestriction", p."humanDecision", p."decisionByName", p."decisionAt", p."message1CopiedAt", p."message2CopiedAt", p."createdAt", p."updatedAt"
    FROM "HumanshipParticipant" p
    JOIN "HumanshipEvent" e ON e."id" = p."eventId"
    WHERE p."id" = ${input.participantId} AND e."ownerId" = ${input.ownerId}
    LIMIT 1
  `);
  const participant = participants[0];
  if (!participant) return false;
  const title = (participant.linkedinTitle || participant.jobTitle || "").trim();
  const normalizedTitle = normalizeHumanshipRoleTitle(title);
  if (!normalizedTitle) return false;

  await getPrisma().$executeRaw(Prisma.sql`
    INSERT INTO "HumanshipRoleRule" ("id", "ownerId", "normalizedTitle", "title", "decision", "decidedByName", "createdAt", "updatedAt")
    VALUES (${`hsr_${randomUUID()}`}, ${input.ownerId}, ${normalizedTitle}, ${title}, ${input.decision}, ${input.decidedByName}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("ownerId", "normalizedTitle") DO UPDATE SET
      "title" = EXCLUDED."title",
      "decision" = EXCLUDED."decision",
      "decidedByName" = EXCLUDED."decidedByName",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  const related = await getPrisma().$queryRaw<ParticipantRow[]>(Prisma.sql`
    SELECT p."id", p."eventId", p."sourceKey", p."sourceRow", p."active", p."fullName", p."email", p."company", p."jobTitle", p."phone", p."linkedinUrl", p."linkedinName", p."linkedinTitle", p."linkedinCompany", p."linkedinLocation", p."searchStatus", p."classification", p."classificationReason", p."roleReference", p."roleScore", p."companyRestriction", p."humanDecision", p."decisionByName", p."decisionAt", p."message1CopiedAt", p."message2CopiedAt", p."createdAt", p."updatedAt"
    FROM "HumanshipParticipant" p
    JOIN "HumanshipEvent" e ON e."id" = p."eventId"
    WHERE e."ownerId" = ${input.ownerId} AND p."active" = true
  `);

  for (const row of related) {
    const currentTitle = row.linkedinTitle || row.jobTitle;
    if (normalizeHumanshipRoleTitle(currentTitle) !== normalizedTitle) continue;
    const classification = classifyHumanshipParticipant({
      sourceCompany: row.company,
      sourceTitle: row.jobTitle,
      linkedinCompany: row.linkedinCompany,
      linkedinTitle: row.linkedinTitle,
      linkedinFound: Boolean(row.linkedinUrl),
      roleRuleDecision: input.decision,
    });
    const probable = row.searchStatus === "probable";
    const finalClassification = probable && classification.classification === "eligible" ? "validate" : classification.classification;
    const reason = probable
      ? `Correspondência provável no LinkedIn; valide o perfil antes da decisão final. ${classification.reason}`
      : classification.reason;
    await getPrisma().$executeRaw(Prisma.sql`
      UPDATE "HumanshipParticipant" SET
        "classification" = ${finalClassification},
        "classificationReason" = ${reason},
        "roleReference" = ${classification.roleAssessment.reference},
        "roleScore" = ${classification.roleAssessment.score},
        "companyRestriction" = ${classification.companyAssessment.restricted ? classification.companyAssessment.reason : null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id}
    `);
  }
  return true;
}

export async function updateHumanshipDecision(input: { ownerId: string; participantId: string; decision: HumanshipDecision; decisionByName: string }) {
  const allowed = ["pending", "approved", "review", "rejected"] as const;
  if (!allowed.includes(input.decision)) return false;
  const count = await getPrisma().$executeRaw(Prisma.sql`
    UPDATE "HumanshipParticipant" p SET
      "humanDecision" = ${input.decision},
      "decisionByName" = ${input.decision === "pending" ? null : input.decisionByName},
      "decisionAt" = ${input.decision === "pending" ? Prisma.sql`NULL` : Prisma.sql`CURRENT_TIMESTAMP`},
      "updatedAt" = CURRENT_TIMESTAMP
    FROM "HumanshipEvent" e
    WHERE p."eventId" = e."id" AND p."id" = ${input.participantId} AND e."ownerId" = ${input.ownerId}
  `);
  return count > 0;
}

export async function markHumanshipMessageCopied(input: { ownerId: string; participantId: string; message: 1 | 2 }) {
  const field = input.message === 1 ? Prisma.raw('"message1CopiedAt"') : Prisma.raw('"message2CopiedAt"');
  const count = await getPrisma().$executeRaw(Prisma.sql`
    UPDATE "HumanshipParticipant" p SET ${field} = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    FROM "HumanshipEvent" e
    WHERE p."eventId" = e."id" AND p."id" = ${input.participantId} AND e."ownerId" = ${input.ownerId}
  `);
  return count > 0;
}

async function updateSearchStatus(participantId: string, status: string) {
  await getPrisma().$executeRaw(Prisma.sql`UPDATE "HumanshipParticipant" SET "searchStatus" = ${status}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${participantId}`);
}

async function concurrentMap<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => worker()));
}

function serializeEvent(row: EventRow, participants: HumanshipParticipant[], roleRules?: HumanshipRoleRule[]): HumanshipEvent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    status: row.status,
    sourceKind: row.sourceKind === "excel" || row.sourceKind === "google_sheets" ? row.sourceKind : undefined,
    sourceName: row.sourceName || undefined,
    sourceExternalId: row.sourceExternalId || undefined,
    sourceSheetName: row.sourceSheetName || undefined,
    sourceRowCount: row.sourceRowCount,
    restrictionVersion: row.restrictionVersion,
    lastSyncedAt: row.lastSyncedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    participants,
    roleRules,
  };
}

function serializeParticipant(row: ParticipantRow): HumanshipParticipant {
  return {
    id: row.id,
    eventId: row.eventId,
    sourceKey: row.sourceKey,
    sourceRow: row.sourceRow || undefined,
    active: row.active,
    fullName: row.fullName,
    email: row.email || undefined,
    company: row.company || undefined,
    jobTitle: row.jobTitle || undefined,
    phone: row.phone || undefined,
    linkedinUrl: row.linkedinUrl || undefined,
    linkedinName: row.linkedinName || undefined,
    linkedinTitle: row.linkedinTitle || undefined,
    linkedinCompany: row.linkedinCompany || undefined,
    linkedinLocation: row.linkedinLocation || undefined,
    searchStatus: row.searchStatus as HumanshipParticipant["searchStatus"],
    classification: row.classification as HumanshipParticipant["classification"],
    classificationReason: row.classificationReason || undefined,
    roleReference: row.roleReference || undefined,
    roleScore: row.roleScore ?? undefined,
    companyRestriction: row.companyRestriction || undefined,
    humanDecision: row.humanDecision as HumanshipParticipant["humanDecision"],
    decisionByName: row.decisionByName || undefined,
    decisionAt: row.decisionAt?.toISOString(),
    message1CopiedAt: row.message1CopiedAt?.toISOString(),
    message2CopiedAt: row.message2CopiedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRoleRule(row: RoleRuleRow): HumanshipRoleRule {
  return {
    id: row.id,
    title: row.title,
    normalizedTitle: row.normalizedTitle,
    decision: row.decision as HumanshipRoleRuleDecision,
    decidedByName: row.decidedByName || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
