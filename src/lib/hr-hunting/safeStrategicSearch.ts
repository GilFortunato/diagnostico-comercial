import "server-only";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { runManusStructuredTask } from "@/lib/connectors/manusClient";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyCandidateQualityGate,
  findOwnedHrHuntingSearch,
  normalizeCandidates,
  rankCandidates,
} from "@/lib/hr-hunting/service";
import type { EvidenceState, HrCandidate, HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";

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

export async function executeSafeStrategicHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;

  const fallback = fallbackPlan(search, input);
  const manus = await createPlanWithManus(search, input, fallback);
  const plan = manus.plan;
  const warnings = [...manus.warnings];
  const rounds = buildRounds(search, input, plan);
  const discovered = new Map<string, HrCandidate>();
  const rawSnapshot: unknown[] = [];
  let successfulRounds = 0;
  let connectorFailed = false;

  for (const round of rounds) {
    const query = buildQuery(round);
    if (!query) continue;
    try {
      const items = await runApifyActor("linkedinProfileSearch", compact({
        profileScraperMode: "Short",
        maxItems: Math.min(50, Math.max(25, input.quantity * 2)),
        takePages: 2,
        searchQuery: query,
        locations: round.location ? [round.location] : [],
      }));
      successfulRounds += 1;
      rawSnapshot.push(...items);
      for (const candidate of normalizeCandidates(items)) mergeCandidate(discovered, candidate);

      const strict = applyCandidateQualityGate([...discovered.values()], search.jobDna, evaluationInput(search, input));
      if (strict.eligible.length >= Math.min(input.quantity, Math.max(5, Math.ceil(input.quantity * 0.6)))) break;
    } catch (error) {
      connectorFailed = true;
      warnings.push(`A rodada ${round.label} ficou indisponível; a busca continuou com as demais rodadas quando possível.`);
      console.warn("[hr-hunting] safe strategic round failed", {
        round: round.label,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  let pool = [...discovered.values()];
  if (pool.length) pool = await enrich(pool, input, warnings);

  const evalInput = evaluationInput(search, input);
  const quality = applyCandidateQualityGate(pool, search.jobDna, evalInput);
  const strictRanked = rankCandidates(quality.eligible, search.jobDna, evalInput);
  const expandedRanked = rankCandidates(quality.rejected, search.jobDna, evalInput);
  const candidates = dedupe([...strictRanked, ...expandedRanked]).slice(0, input.quantity);

  if (quality.rejected.length) {
    warnings.push(`${quality.rejected.length} perfil(is) vieram da expansão e permaneceram visíveis com aderência calculada contra a vaga original.`);
  }
  warnings.push(`Estratégia executada em ${successfulRounds} rodada(s), com ${plan.equivalentTitles.length} título(s) equivalente(s) e ${plan.adjacentTitles.length} adjacente(s).`);
  if (plan.rationale) warnings.push(plan.rationale);

  await persistResult({
    id,
    ownerId,
    candidates,
    rawSnapshot,
    warnings,
    status: candidates.length ? "results_ready" : connectorFailed && successfulRounds === 0 ? "connector_error" : "no_results",
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
  const precise = unique([original, plan.primaryTitle, ...plan.equivalentTitles.slice(0, 2)]).slice(0, 4);
  const expanded = unique([...precise, ...plan.equivalentTitles, ...plan.adjacentTitles.slice(0, 3)]).slice(0, 8);
  const discovery = unique([...expanded, ...plan.adjacentTitles]).slice(0, 12);
  const originalLocation = input.location?.trim() || search.jobDna.location || "";
  return [
    { label: "precisa", titles: precise, keywords: plan.mustHaveKeywords.slice(0, 3), location: plan.preciseLocation || originalLocation || undefined },
    { label: "ampliada", titles: expanded, keywords: unique([...plan.mustHaveKeywords, ...plan.supportingKeywords]).slice(0, 6), location: plan.expandedLocation || originalLocation || undefined },
    { label: "descoberta", titles: discovery, keywords: unique([...plan.mustHaveKeywords, ...plan.supportingKeywords]).slice(0, 8), location: plan.discoveryLocation || undefined },
  ];
}

function buildQuery(round: Round) {
  const titles = round.titles.map(quote);
  const keywords = round.label === "descoberta" ? round.keywords.slice(0, 4).map(quote) : [];
  return [...titles, ...keywords].filter(Boolean).join(" OR ").slice(0, 520);
}

async function enrich(candidates: HrCandidate[], input: SearchInput, warnings: string[]) {
  const urls = candidates.map((candidate) => candidate.profileUrl).filter((url): url is string => Boolean(url)).slice(0, Math.min(10, Math.max(5, input.quantity)));
  if (!urls.length) return candidates;
  try {
    const raw = await runApifyActor("linkedinProfile", { urls });
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

async function persistResult({ id, ownerId, candidates, rawSnapshot, warnings, status }: {
  id: string;
  ownerId: string;
  candidates: HrCandidate[];
  rawSnapshot: unknown[];
  warnings: string[];
  status: string;
}) {
  await getPrisma().$transaction(async (tx) => {
    await tx.hrHuntingCandidate.deleteMany({ where: { searchId: id, search: { ownerId } } });

    const persisted = candidates.map((candidate) => ({ candidate, rowId: candidateRecordId(id, candidate.id) }));
    if (persisted.length) {
      await tx.hrHuntingCandidate.createMany({
        data: persisted.map(({ candidate, rowId }) => ({
          id: rowId,
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
        })),
        skipDuplicates: true,
      });
    }

    for (const { candidate, rowId } of persisted) {
      const row = await tx.hrHuntingCandidate.findUnique({ where: { id: rowId }, select: { id: true } });
      if (!row) continue;
      if (candidate.evidence.length) {
        await tx.hrHuntingCandidateEvidence.createMany({
          data: candidate.evidence.map((evidence) => ({
            candidateId: row.id,
            criterion: evidence.criterion,
            criterionType: evidence.criterionType,
            result: evidence.result,
            evidence: evidence.evidence || null,
            source: evidence.source,
            confidence: toPrismaConfidence(evidence.confidence),
          })),
        });
      }
      if (candidate.contacts.length) {
        await tx.hrHuntingCandidateContact.createMany({
          data: candidate.contacts.map((contact) => ({
            candidateId: row.id,
            value: contact.value,
            type: contact.type,
            source: contact.source,
            confidence: toPrismaConfidence(contact.confidence),
            obtainedAt: contact.obtainedAt ? new Date(contact.obtainedAt) : null,
          })),
        });
      }
    }

    await tx.hrHuntingSearch.updateMany({
      where: { id, ownerId },
      data: {
        status,
        sourceSnapshot: rawSnapshot.slice(0, 150) as Prisma.InputJsonValue,
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

function mergeCandidate(map: Map<string, HrCandidate>, candidate: HrCandidate) {
  const key = candidate.profileUrl || `${normalize(candidate.name)}|${normalize(candidate.currentTitle || "")}`;
  const previous = map.get(key);
  if (!previous) return void map.set(key, candidate);
  map.set(key, {
    ...previous,
    currentTitle: candidate.currentTitle || previous.currentTitle,
    currentCompany: candidate.currentCompany || previous.currentCompany,
    location: candidate.location || previous.location,
    profileUrl: candidate.profileUrl || previous.profileUrl,
    professionalSummary: longer(candidate.professionalSummary, previous.professionalSummary),
    contacts: dedupeContacts([...previous.contacts, ...candidate.contacts]),
    confidence: stronger(previous.confidence, candidate.confidence),
  });
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

function quote(value: string) {
  const cleaned = clean(value).replace(/"/g, "");
  return cleaned.includes(" ") ? `"${cleaned}"` : cleaned;
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

function longer(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
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
