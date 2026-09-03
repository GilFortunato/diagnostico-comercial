import "server-only";
import { Prisma } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { getPrisma } from "@/lib/db/prisma";
import { applyCandidateQualityGate, buildHrCandidateRecallInput, findOwnedHrHuntingSearch, normalizeCandidates, rankCandidates } from "@/lib/hr-hunting/service";
import type { EvidenceState, HrCandidate, HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";

type LoadMoreInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
  batchSize: number;
};

export async function loadMoreHrHuntingCandidates(id: string, ownerId: string, input: LoadMoreInput): Promise<HrHuntingSearchSnapshot | null> {
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;

  const batchSize = Math.min(25, Math.max(5, input.batchSize));
  const existingUrls = new Set(search.candidates.map((candidate) => normalizeUrl(candidate.profileUrl)).filter(Boolean));
  const discoveryQuantity = Math.min(50, Math.max(input.quantity, search.candidates.length + batchSize));
  const searchInput = { ...input, quantity: discoveryQuantity };
  const warnings = [...search.connectorWarnings];

  let rawItems: unknown[] = [];
  try {
    rawItems = await runApifyActor("linkedinProfileSearch", buildHrCandidateRecallInput(searchInput, search.jobDna.title || search.title));
  } catch {
    warnings.push("Não foi possível buscar o próximo lote agora. Os candidatos já encontrados foram preservados.");
    await updateWarnings(id, warnings);
    return findOwnedHrHuntingSearch(id, ownerId);
  }

  const normalized = normalizeCandidates(rawItems);
  const unseen = normalized.filter((candidate) => {
    const url = normalizeUrl(candidate.profileUrl);
    return Boolean(url) && !existingUrls.has(url);
  });

  let enriched = unseen;
  const enrichmentUrls = unseen.map((candidate) => candidate.profileUrl).filter((url): url is string => Boolean(url)).slice(0, Math.min(20, batchSize));
  if (enrichmentUrls.length) {
    try {
      const details = normalizeCandidates(await runApifyActor("linkedinProfile", { urls: enrichmentUrls }));
      enriched = mergeByLinkedIn(unseen, details);
    } catch {
      warnings.push("O enriquecimento do novo lote ficou indisponível; somente evidências já retornadas pela descoberta foram consideradas.");
    }
  }

  const quality = applyCandidateQualityGate(enriched, search.jobDna, searchInput);
  const rankedNew = rankCandidates(quality.eligible, search.jobDna, searchInput).slice(0, batchSize);

  if (!rankedNew.length) {
    warnings.push("Não encontramos novos perfis elegíveis sem repetir os candidatos já exibidos. Amplie os critérios se quiser aumentar a cobertura.");
    await getPrisma().hrHuntingSearch.update({ where: { id }, data: { connectorWarnings: unique(warnings), status: search.candidates.length ? "results_ready" : "no_results" } });
    return findOwnedHrHuntingSearch(id, ownerId);
  }

  await getPrisma().$transaction(async (tx) => {
    for (const candidate of rankedNew) {
      const duplicate = candidate.profileUrl
        ? await tx.hrHuntingCandidate.findFirst({ where: { searchId: id, profileUrl: candidate.profileUrl }, select: { id: true } })
        : null;
      if (duplicate) continue;

      await tx.hrHuntingCandidate.create({ data: {
        id: candidate.id,
        searchId: id,
        sourcePersonId: candidate.id,
        name: candidate.name,
        currentTitle: candidate.currentTitle || null,
        currentCompany: candidate.currentCompany || null,
        location: candidate.location || null,
        profileUrl: candidate.profileUrl || null,
        professionalSummary: candidate.professionalSummary || null,
        fitScore: candidate.fitScore,
        fitClassification: candidate.fitClassification,
        mainSignal: candidate.mainSignal || null,
        pointsToValidate: candidate.pointsToValidate,
        sourceName: candidate.sourceName,
        confidence: toPrismaConfidence(candidate.confidence),
        rawSnapshot: candidate as unknown as Prisma.InputJsonValue,
      } });

      if (candidate.evidence.length) await tx.hrHuntingCandidateEvidence.createMany({ data: candidate.evidence.map((evidence) => ({
        candidateId: candidate.id,
        criterion: evidence.criterion,
        criterionType: evidence.criterionType,
        result: evidence.result,
        evidence: evidence.evidence || null,
        source: evidence.source,
        confidence: toPrismaConfidence(evidence.confidence),
      })) });
      if (candidate.contacts.length) await tx.hrHuntingCandidateContact.createMany({ data: candidate.contacts.map((contact) => ({
        candidateId: candidate.id,
        value: contact.value,
        type: contact.type,
        source: contact.source,
        confidence: toPrismaConfidence(contact.confidence),
        obtainedAt: contact.obtainedAt ? new Date(contact.obtainedAt) : null,
      })) });
    }

    await tx.hrHuntingSearch.update({
      where: { id },
      data: {
        status: "results_ready",
        connectorWarnings: unique([
          ...warnings,
          `${rankedNew.length} novo(s) perfil(is) foram adicionados sem repetir os resultados anteriores.`,
          ...(quality.rejected.length ? [`${quality.rejected.length} perfil(is) do novo lote ficaram fora do ranking por evidência, cargo ou localização.`] : []),
        ]),
        sourceSnapshot: { mode: "load_more", rawCount: rawItems.length, newEligibleCount: rankedNew.length, previousCount: search.candidates.length } as Prisma.InputJsonValue,
      },
    });
  });

  return findOwnedHrHuntingSearch(id, ownerId);
}

function mergeByLinkedIn(base: HrCandidate[], details: HrCandidate[]) {
  const detailByUrl = new Map(details.map((candidate) => [normalizeUrl(candidate.profileUrl), candidate]).filter(([url]) => Boolean(url)) as Array<[string, HrCandidate]>);
  return base.map((candidate) => {
    const detail = detailByUrl.get(normalizeUrl(candidate.profileUrl));
    if (!detail) return candidate;
    return {
      ...candidate,
      currentTitle: detail.currentTitle || candidate.currentTitle,
      currentCompany: detail.currentCompany || candidate.currentCompany,
      location: detail.location || candidate.location,
      professionalSummary: detail.professionalSummary || candidate.professionalSummary,
      contacts: uniqueContacts([...candidate.contacts, ...detail.contacts]),
      sourceName: "Apify · lote adicional + enriquecimento",
      confidence: "confirmado" as const,
    };
  });
}

function normalizeUrl(value?: string) {
  return (value || "").trim().replace(/\/$/, "").toLocaleLowerCase("en-US");
}

function uniqueContacts(contacts: HrCandidate["contacts"]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.type}|${contact.value.trim().toLocaleLowerCase("pt-BR")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function updateWarnings(id: string, warnings: string[]) {
  await getPrisma().hrHuntingSearch.update({ where: { id }, data: { connectorWarnings: unique(warnings) } });
}

function toPrismaConfidence(value: EvidenceState): "CONFIRMED" | "LIKELY" | "INFERENCE" | "UNVERIFIED" {
  if (value === "confirmado") return "CONFIRMED";
  if (value === "provável") return "LIKELY";
  if (value === "inferência") return "INFERENCE";
  return "UNVERIFIED";
}
