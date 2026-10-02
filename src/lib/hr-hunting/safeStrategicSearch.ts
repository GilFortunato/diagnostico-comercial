import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { runManusStructuredTask } from "@/lib/connectors/manusClient";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyCandidateQualityGate,
  findOwnedHrHuntingSearch,
  normalizeCandidates,
  rankCandidates,
  buildTitleFamily,
} from "@/lib/hr-hunting/service";
import type { EvidenceState, HrCandidate, HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";
import { candidateKey, collectHrDiscovery, readDiscoveryState, type HrDiscoveryState } from "@/lib/hr-hunting/pagedDiscovery";
import { findReusableCandidateProfiles, profileKeyForCandidate, upsertCandidateProfiles } from "@/lib/hr-hunting/candidateMemory";
import { collectionMessage } from "@/lib/hunting/pagination";

type SearchInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
};

type SourcingPlan = {
  primaryTitle: string;
  equivalentTitles: string[];
  adjacentTitles: string[];
  mustHaveKeywords: string[];
  supportingKeywords: string[];
  preciseLocation: string;
  expandedLocation: string;
  discoveryLocation: string;
  rationale: string;
};

type Round = {
  label: "precisa" | "ampliada" | "descoberta";
  titles: string[];
  keywords: string[];
  location?: string;
};

export async function executeSafeStrategicHrHuntingSearch(id: string, ownerId: string, input: SearchInput, options: { append?: boolean } = {}) {
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;

  const fingerprint = createHash("sha256").update(JSON.stringify({ currentTitle: input.currentTitle, seniority: input.seniority, location: input.location, keywords: input.keywords, dna: search.jobDna })).digest("hex");
  const previous = options.append ? await getPrisma().hrHuntingSearch.findFirst({ where: { id }, select: { sourceSnapshot: true } }) : null;
  let state = readDiscoveryState(previous?.sourceSnapshot, fingerprint);
  const warnings: string[] = [];
  const evalInput = evaluationInput(search, input);

  const knownKeys = new Set(options.append ? search.candidates.map(candidateKey) : []);
  const reusable = (await findReusableCandidateProfiles())
    .filter((candidate) => !knownKeys.has(candidateKey(candidate)));
  const reusableQuality = applyCandidateQualityGate(reusable, search.jobDna, evalInput);
  const cachedPool = reusableQuality.eligible;
  const cachedRanked = rankCandidates(cachedPool, search.jobDna, evalInput).slice(0, input.quantity);
  if (cachedRanked.length) {
    warnings.push(`${cachedRanked.length} perfil(is) compatível(is) foram reaproveitados do banco Share antes de consultar fontes externas.`);
  }

  const externalTarget = Math.max(0, input.quantity - cachedRanked.length);
  if (!state && externalTarget > 0) {
    const manus = await createPlanWithManus(search, input, fallbackPlan(search, input));
    warnings.push(...manus.warnings);
    const rounds = buildRounds(search, input, manus.plan).map((round) => compact({
      profileScraperMode: "Short", currentJobTitles: round.titles, locations: round.location ? [round.location] : [],
    }));
    state = {
      version: 1, fingerprint, pending: [],
      rounds: [...new Map(rounds.map((actorInput) => [JSON.stringify(actorInput), actorInput])).values()]
        .map((actorInput) => ({ input: actorInput, nextPage: 1, exhausted: false })),
    };
  }
  if (!state) {
    state = { version: 1, fingerprint, pending: [], rounds: [], fallbackComplete: true };
  }

  const excludedKeys = new Set([...knownKeys, ...cachedPool.map(candidateKey)]);
  const collected = externalTarget > 0
    ? await collectHrDiscovery({
        state, target: externalTarget,
        excludedKeys,
        normalize: normalizeCandidates,
        fetchPage: (actorInput, page) => runApifyActor("linkedinProfileSearch", {
          ...actorInput, startPage: page.startPage, takePages: page.takePages, maxItems: page.maxItems,
        }, { timeoutMs: page.timeoutMs, allowFallback: false }),
      })
    : {
        items: [] as HrCandidate[],
        state,
        summary: { requested: 0, unique: 0, requests: 0, duplicates: 0, stopReason: "target_reached" as const, nextPage: 1 },
      };

  let externalPool = collected.items;
  if (externalPool.length < externalTarget && !collected.state.fallbackComplete) {
    try {
      const raw = await runApifyActor("linkedinProfileSearchFallback", compact({
        searchQuery: input.currentTitle?.trim() || search.jobDna.title || search.title,
        locations: (input.location?.trim() || search.jobDna.location) ? [input.location?.trim() || search.jobDna.location] : [],
        maxItems: 50,
      }), { timeoutMs: 15_000 });
      const existing = new Set([...excludedKeys, ...externalPool.map(candidateKey)]);
      externalPool = [...new Map([...externalPool, ...normalizeCandidates(raw)].filter((candidate) => !existing.has(candidateKey(candidate))).map((candidate) => [candidateKey(candidate), candidate])).values()];
      collected.state.fallbackComplete = true;
    } catch {
      warnings.push("A fonte complementar Apify ficou indisponível; os perfis já encontrados foram preservados.");
    }
  }
  collected.summary.unique = externalPool.length;
  if (externalPool.length >= externalTarget) collected.summary.stopReason = "target_reached";
  warnings.push(collectionMessage(collected.summary));
  console.info("[hr-hunting] collection completed", { ...collected.summary });
  if (externalPool.length) externalPool = await enrich(externalPool, input, warnings);

  const pool = dedupe([...cachedPool, ...externalPool]);
  const quality = applyCandidateQualityGate(pool, search.jobDna, evalInput);
  const strictRanked = rankCandidates(quality.eligible, search.jobDna, evalInput);
  const expandedRanked = rankCandidates(quality.rejected, search.jobDna, evalInput);
  const candidates = dedupe([...strictRanked, ...expandedRanked]).slice(0, input.quantity);

  if (quality.rejected.length) {
    warnings.push(`${quality.rejected.length} perfil(is) vieram da expansão e permaneceram visíveis com aderência calculada contra a vaga original.`);
  }
  const selected = new Set(candidates.map(candidateKey));
  const nextState = { ...collected.state, pending: pool.filter((candidate) => !selected.has(candidateKey(candidate))) };

  await persistResult({
    id,
    ownerId,
    candidates,
    discoveryState: nextState,
    warnings,
    status: candidates.length || search.candidates.length ? "results_ready" : collected.summary.stopReason === "provider_error" ? "connector_error" : "no_results",
  });

  return findOwnedHrHuntingSearch(id, ownerId);
}

async function createPlanWithManus(search: HrHuntingSearchSnapshot, input: SearchInput, fallback: SourcingPlan) {
  const targetTitle = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const targetLocation = input.location?.trim() || search.jobDna.location || "";
  const prompt = [
    "Você é um especialista sênior de Talent Sourcing.",
    "Analise a vaga e crie somente uma estratégia de sourcing. Não busque candidatos e não use ferramentas nesta etapa.",
    "Amplie descoberta sem alterar os critérios finais de aderência.",
    "Sugira títulos equivalentes em português/inglês, cargos adjacentes plausíveis, palavras-chave profissionais e expansão geográfica razoável.",
    `Cargo: ${targetTitle}`,
    `Localização: ${targetLocation || "não informada"}`,
    `Empresa: ${search.companyName || "não informada"}`,
    `Resumo: ${search.jobDna.shortSummary}`,
    `Responsabilidades: ${search.jobDna.responsibilities.join(" | ") || "não detalhadas"}`,
    `Critérios: ${search.jobDna.criteria.filter((item) => item.kind !== "não relevante").map((item) => `${item.kind}: ${item.label}`).join(" | ") || "não detalhados"}`,
    `Palavras-chave informadas: ${input.keywords.join(", ") || "nenhuma"}`,
    "Não use atributos pessoais ou protegidos. Responda somente no schema solicitado.",
  ].join("\n");

  const result = await runManusStructuredTask<SourcingPlan>({
    timeoutMs: 30_000,
    prompt,
    schema: sourcingPlanSchema,
    title: "Share AI · HR Hunting · Estratégia de sourcing",
    countResults: (value) => 1 + value.equivalentTitles.length + value.adjacentTitles.length,
  });

  if (result.status !== "success_with_results" || !result.value) {
    return {
      plan: fallback,
      warnings: [...result.warnings, "O Manus não concluiu o planejamento; a busca aplicou a expansão conservadora local."],
    };
  }

  return { plan: sanitizePlan(result.value, fallback), warnings: result.warnings };
}

function buildRounds(search: HrHuntingSearchSnapshot, input: SearchInput, plan: SourcingPlan): Round[] {
  const original = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const precise = unique([original, plan.primaryTitle, ...buildTitleFamily(original), ...plan.equivalentTitles]).slice(0, 20);
  const expanded = unique([...precise, ...plan.adjacentTitles.slice(0, 3)]).slice(0, 30);
  const discovery = unique([...expanded, ...plan.adjacentTitles]).slice(0, 40);
  const originalLocation = input.location?.trim() || search.jobDna.location || "";
  return [
    { label: "precisa", titles: precise, keywords: [], location: originalLocation || undefined },
    { label: "ampliada", titles: expanded, keywords: [], location: originalLocation || undefined },
    { label: "descoberta", titles: discovery, keywords: [], location: originalLocation || undefined },
  ];
}

async function enrich(candidates: HrCandidate[], input: SearchInput, warnings: string[]) {
  const urls = candidates.map((candidate) => candidate.profileUrl).filter((url): url is string => Boolean(url)).slice(0, Math.min(10, Math.max(5, input.quantity)));
  if (!urls.length) return candidates;
  try {
    const raw = await runApifyActor("linkedinProfile", { urls }, { timeoutMs: 20_000 });
    const details = normalizeCandidates(raw);
    const byUrl = new Map(details.filter((item) => item.profileUrl).map((item) => [item.profileUrl!, item]));
    warnings.push(`A Share AI enriqueceu ${details.length} perfil(is) prioritário(s) antes do ranking final.`);
    return candidates.map((candidate) => {
      const detail = candidate.profileUrl ? byUrl.get(candidate.profileUrl) : undefined;
      if (!detail) return candidate;
      return {
        ...candidate,
        currentTitle: detail.currentTitle || candidate.currentTitle,
        currentCompany: detail.currentCompany || candidate.currentCompany,
        location: detail.location || candidate.location,
        professionalSummary: detail.professionalSummary || candidate.professionalSummary,
        contacts: dedupeContacts([...candidate.contacts, ...detail.contacts]),
        confidence: stronger(candidate.confidence, detail.confidence),
      };
    });
  } catch {
    warnings.push("O enriquecimento de perfil ficou indisponível; o ranking usou os dados da descoberta.");
    return candidates;
  }
}

async function persistResult({ id, ownerId, candidates, discoveryState, warnings, status }: {
  id: string;
  ownerId: string;
  candidates: HrCandidate[];
  discoveryState: HrDiscoveryState;
  warnings: string[];
  status: string;
}) {
  await getPrisma().$transaction(async (tx) => {
    const profileIds = await upsertCandidateProfiles(tx, candidates);
    const existing = await tx.hrHuntingCandidate.findMany({ where: { searchId: id }, select: { id: true, profileUrl: true } });
    const knownUrls = new Set(existing.map((row) => row.profileUrl?.split("?")[0].replace(/\/$/, "").toLowerCase()).filter(Boolean));
    const persisted = candidates.filter((candidate) => !knownUrls.has(candidateKey(candidate)))
      .map((candidate) => ({ candidate, rowId: candidateRecordId(id, candidate.id) }))
      .filter(({ rowId }) => !existing.some((row) => row.id === rowId));
    let insertedIds = new Set<string>();
    if (persisted.length) {
      const inserted = await tx.hrHuntingCandidate.createManyAndReturn({
        select: { id: true },
        data: persisted.map(({ candidate, rowId }) => ({
          id: rowId,
          searchId: id,
          profileId: profileIds.get(profileKeyForCandidate(candidate)) || null,
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
        })),
        skipDuplicates: true,
      });
      insertedIds = new Set(inserted.map((row) => row.id));
    }

    const inserted = persisted.filter(({ rowId }) => insertedIds.has(rowId));
    const evidenceData = inserted.flatMap(({ candidate, rowId }) => candidate.evidence.map((evidence) => ({
            candidateId: rowId,
            criterion: evidence.criterion,
            criterionType: evidence.criterionType,
            result: evidence.result,
            evidence: evidence.evidence || null,
            source: evidence.source,
            confidence: toPrismaConfidence(evidence.confidence),
          })));
    const contactData = inserted.flatMap(({ candidate, rowId }) => candidate.contacts.map((contact) => ({
            candidateId: rowId,
            value: contact.value,
            type: contact.type,
            source: contact.source,
            confidence: toPrismaConfidence(contact.confidence),
            obtainedAt: contact.obtainedAt ? new Date(contact.obtainedAt) : null,
          })));
    if (evidenceData.length) await tx.hrHuntingCandidateEvidence.createMany({ data: evidenceData });
    if (contactData.length) await tx.hrHuntingCandidateContact.createMany({ data: contactData });

    await tx.hrHuntingSearch.updateMany({
      where: { id },
      data: {
        status,
        sourceSnapshot: discoveryState as unknown as Prisma.InputJsonValue,
        connectorWarnings: unique(warnings).slice(0, 20),
      },
    });
  });
}

export function candidateRecordId(searchId: string, sourcePersonId: string) {
  return `${sourcePersonId}_${searchId}`;
}

function evaluationInput(search: HrHuntingSearchSnapshot, input: SearchInput): SearchInput {
  return { ...input, currentTitle: input.currentTitle?.trim() || search.jobDna.title || search.title, location: input.location?.trim() || search.jobDna.location || undefined };
}

function fallbackPlan(search: HrHuntingSearchSnapshot, input: SearchInput): SourcingPlan {
  const title = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const functional = simplifyTitle(title);
  const location = input.location?.trim() || search.jobDna.location || "";
  return {
    primaryTitle: title,
    equivalentTitles: functional && normalize(functional) !== normalize(title) ? [functional] : [],
    adjacentTitles: [],
    mustHaveKeywords: unique(input.keywords).slice(0, 8),
    supportingKeywords: [],
    preciseLocation: location,
    expandedLocation: broaderLocation(location),
    discoveryLocation: "",
    rationale: "Expansão conservadora baseada no título e no DNA original da vaga.",
  };
}

function sanitizePlan(value: SourcingPlan, fallback: SourcingPlan): SourcingPlan {
  return {
    primaryTitle: clean(value.primaryTitle) || fallback.primaryTitle,
    equivalentTitles: safeList(value.equivalentTitles, 6),
    adjacentTitles: safeList(value.adjacentTitles, 6),
    mustHaveKeywords: safeList(value.mustHaveKeywords, 8),
    supportingKeywords: safeList(value.supportingKeywords, 8),
    preciseLocation: clean(value.preciseLocation) || fallback.preciseLocation,
    expandedLocation: clean(value.expandedLocation) || fallback.expandedLocation,
    discoveryLocation: clean(value.discoveryLocation),
    rationale: clean(value.rationale) || fallback.rationale,
  };
}

function dedupe(candidates: HrCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.profileUrl || `${normalize(candidate.name)}|${normalize(candidate.currentTitle || "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeContacts(contacts: HrCandidate["contacts"]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.type}|${normalize(contact.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stronger(a: EvidenceState, b: EvidenceState): EvidenceState {
  const order: EvidenceState[] = ["não verificado", "inferência", "provável", "confirmado"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function toPrismaConfidence(value: EvidenceState): ConfidenceLevel {
  if (value === "confirmado") return "CONFIRMED";
  if (value === "provável") return "LIKELY";
  if (value === "inferência") return "INFERENCE";
  return "UNVERIFIED";
}

function simplifyTitle(title: string) {
  const cleaned = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(analista|analyst|assistente|assistant|gerente|manager|coordenador|coordinator|especialista|specialist|senior|sênior|sr|junior|júnior|jr|pleno|trainee|estagi[aá]ri[oa]|intern)\b/gi, " ")
    .replace(/\b(de|do|da|dos|das|em|na|no|para|the|of|and)\b/gi, " ")
    .replace(/\b[ivx]+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 ? cleaned : title.trim();
}

function broaderLocation(location: string) {
  if (!location) return "";
  const parts = location.split(/[,/-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  return location;
}

function safeList(value: unknown, limit: number) {
  return unique(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []).slice(0, limit);
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.map(clean).filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 220) : "";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function compact(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

const sourcingPlanSchema = {
  type: "object",
  properties: {
    primaryTitle: { type: "string" },
    equivalentTitles: { type: "array", items: { type: "string" } },
    adjacentTitles: { type: "array", items: { type: "string" } },
    mustHaveKeywords: { type: "array", items: { type: "string" } },
    supportingKeywords: { type: "array", items: { type: "string" } },
    preciseLocation: { type: "string" },
    expandedLocation: { type: "string" },
    discoveryLocation: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["primaryTitle", "equivalentTitles", "adjacentTitles", "mustHaveKeywords", "supportingKeywords", "preciseLocation", "expandedLocation", "discoveryLocation", "rationale"],
  additionalProperties: false,
} as const;
