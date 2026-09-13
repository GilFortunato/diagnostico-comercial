import "server-only";
import { Prisma } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { getPrisma } from "@/lib/db/prisma";
import { normalizeCandidates } from "@/lib/hr-hunting/service";
import type { HrCandidate } from "@/lib/hr-hunting/types";
import { chooseHumanshipLinkedinMatch } from "@/lib/humanship/linkedinMatch";
import { runHumanshipManusDeepSearch } from "@/lib/humanship/manusDeepSearch";
import { classifyHumanshipParticipant, normalizeHumanshipRoleTitle } from "@/lib/humanship/restrictions";
import type { HumanshipEvent, HumanshipParticipant } from "@/lib/humanship/types";

export async function enhanceHumanshipEventWithDeepSearch(ownerId: string, event: HumanshipEvent) {
  const unresolved = event.participants.filter((participant) => ["not_found", "probable", "error"].includes(participant.searchStatus));
  if (!unresolved.length) return { attempted: 0, improved: 0, warnings: [] as string[] };

  const roleRules = new Map((event.roleRules ?? []).map((rule) => [rule.normalizedTitle, rule.decision]));
  const batches = chunk(unresolved.slice(0, 32), 8);
  const warnings: string[] = [];
  let improved = 0;

  await concurrentMap(batches, 2, async (batch) => {
    const deep = await runHumanshipManusDeepSearch(batch);
    warnings.push(...deep.warnings);
    if (deep.status !== "success") {
      if (deep.status === "empty") await markDeepSearchMisses(batch);
      return;
    }

    const candidateMap = new Map<string, HrCandidate[]>();
    for (const participant of batch) {
      const candidates = deep.candidatesByParticipant.get(participant.id) ?? [];
      const current = currentCandidate(participant);
      candidateMap.set(participant.id, dedupeCandidates(current ? [current, ...candidates] : candidates));
    }

    const urls = [...new Set(
      [...candidateMap.values()]
        .flatMap((candidates) => candidates.slice(0, 3))
        .map((candidate) => candidate.profileUrl)
        .filter((url): url is string => Boolean(url)),
    )].slice(0, 24);

    let enriched: HrCandidate[] = [];
    if (urls.length) {
      try {
        enriched = normalizeCandidates(await runApifyActor("linkedinProfile", { urls }));
      } catch {
        warnings.push("A busca profunda encontrou URLs, mas o enriquecimento final do LinkedIn ficou indisponível nesta execução.");
      }
    }
    const enrichedByUrl = new Map(enriched.filter((candidate) => candidate.profileUrl).map((candidate) => [normalizeUrl(candidate.profileUrl!), candidate]));

    for (const participant of batch) {
      const rawCandidates = candidateMap.get(participant.id) ?? [];
      const mergedCandidates = rawCandidates.map((candidate) => {
        const detail = candidate.profileUrl ? enrichedByUrl.get(normalizeUrl(candidate.profileUrl)) : undefined;
        return detail ? mergeCandidate(candidate, detail) : candidate;
      });
      const match = chooseHumanshipLinkedinMatch(participant, mergedCandidates);
      if (!match?.candidate.profileUrl) {
        await markDeepSearchMiss(participant);
        continue;
      }

      const previousScore = currentCandidate(participant)
        ? chooseHumanshipLinkedinMatch(participant, [currentCandidate(participant)!])?.score ?? 0
        : 0;
      const isBetter = !participant.linkedinUrl
        || match.confidence === "confirmed"
        || match.score > previousScore + 0.04;
      if (!isBetter) continue;

      const best = match.candidate;
      const roleTitle = best.currentTitle || participant.jobTitle;
      const classification = classifyHumanshipParticipant({
        sourceCompany: participant.company,
        sourceTitle: participant.jobTitle,
        linkedinCompany: best.currentCompany,
        linkedinTitle: best.currentTitle,
        linkedinFound: true,
        roleRuleDecision: roleRules.get(normalizeHumanshipRoleTitle(roleTitle)) ?? null,
      });
      const probable = match.confidence === "probable";
      const finalClassification = probable && classification.classification === "eligible" ? "validate" : classification.classification;
      const connectorNote = deep.connectorNames.length ? ` via ${deep.connectorNames.join(", ")}` : "";
      const classificationReason = probable
        ? `Correspondência provável localizada pela busca profunda Manus${connectorNote}; valide o perfil antes da decisão final. ${classification.reason}`
        : `Perfil localizado pela busca profunda Manus${connectorNote} e corroborado por sinais profissionais. ${classification.reason}`;
      const rawSnapshot = {
        ...best,
        humanshipMatch: {
          confidence: match.confidence,
          score: match.score,
          nameScore: match.nameScore,
          companyScore: match.companyScore,
          titleScore: match.titleScore,
          source: "manus_deep_search",
          taskId: deep.taskId,
          connectors: deep.connectorNames,
          enrichedByApify: Boolean(best.profileUrl && enrichedByUrl.has(normalizeUrl(best.profileUrl))),
        },
      };

      await getPrisma().$executeRaw(Prisma.sql`
        UPDATE "HumanshipParticipant" SET
          "linkedinUrl" = ${best.profileUrl},
          "linkedinName" = ${best.name || null},
          "linkedinTitle" = ${best.currentTitle || null},
          "linkedinCompany" = ${best.currentCompany || null},
          "linkedinLocation" = ${best.location || null},
          "rawLinkedin" = CAST(${JSON.stringify(rawSnapshot)} AS jsonb),
          "searchStatus" = ${probable ? "probable" : "found"},
          "classification" = ${finalClassification},
          "classificationReason" = ${classificationReason},
          "roleReference" = ${classification.roleAssessment.reference},
          "roleScore" = ${classification.roleAssessment.score},
          "companyRestriction" = ${classification.companyAssessment.restricted ? classification.companyAssessment.reason : null},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${participant.id}
          AND EXISTS (SELECT 1 FROM "HumanshipEvent" e WHERE e."id" = "HumanshipParticipant"."eventId" AND e."ownerId" = ${ownerId})
      `);
      improved += 1;
    }
  });

  return { attempted: unresolved.length, improved, warnings: unique(warnings).slice(0, 10) };
}

async function markDeepSearchMisses(participants: HumanshipParticipant[]) {
  for (const participant of participants) await markDeepSearchMiss(participant);
}

async function markDeepSearchMiss(participant: HumanshipParticipant) {
  if (participant.searchStatus !== "not_found" && participant.searchStatus !== "error") return;
  const reason = participant.classificationReason
    ? `${participant.classificationReason} A busca profunda Manus também não encontrou uma correspondência profissional suficientemente sustentada.`
    : "A busca direta e a busca profunda Manus não encontraram uma correspondência profissional suficientemente sustentada.";
  await getPrisma().$executeRaw(Prisma.sql`
    UPDATE "HumanshipParticipant" SET
      "searchStatus" = 'not_found',
      "classificationReason" = ${reason},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${participant.id}
  `);
}

function currentCandidate(participant: HumanshipParticipant): HrCandidate | null {
  if (!participant.linkedinUrl || !participant.linkedinName) return null;
  return {
    id: `current_${participant.id}`,
    name: participant.linkedinName,
    currentTitle: participant.linkedinTitle,
    currentCompany: participant.linkedinCompany,
    location: participant.linkedinLocation,
    profileUrl: participant.linkedinUrl,
    fitScore: 0,
    fitClassification: "Parcial",
    pointsToValidate: [],
    sourceName: "Humanship current match",
    confidence: participant.searchStatus === "found" ? "confirmado" : "provável",
    evidence: [],
    contacts: [],
    shortlisted: false,
  };
}

function mergeCandidate(base: HrCandidate, detail: HrCandidate): HrCandidate {
  return {
    ...base,
    name: detail.name || base.name,
    currentTitle: detail.currentTitle || base.currentTitle,
    currentCompany: detail.currentCompany || base.currentCompany,
    location: detail.location || base.location,
    profileUrl: detail.profileUrl || base.profileUrl,
    professionalSummary: detail.professionalSummary || base.professionalSummary,
    sourceName: `${base.sourceName} + LinkedIn detail`,
    confidence: detail.confidence === "confirmado" ? "confirmado" : base.confidence,
  };
}

function dedupeCandidates(candidates: HrCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.profileUrl ? normalizeUrl(candidate.profileUrl) : `${candidate.name}|${candidate.currentCompany || ""}`.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrl(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\/$/, "");
}

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
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

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
