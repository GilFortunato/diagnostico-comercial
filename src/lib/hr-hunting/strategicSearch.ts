import "server-only";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { runManusStructuredTask, type ManusTaskResult } from "@/lib/connectors/manusClient";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyCandidateQualityGate,
  findOwnedHrHuntingSearch,
  normalizeCandidates,
  rankCandidates,
} from "@/lib/hr-hunting/service";
import type { EvidenceState, HrCandidate, HrHuntingSearchSnapshot, JobDna } from "@/lib/hr-hunting/types";

type SearchInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
};

type ManusSourcingPlan = {
  primaryTitle: string;
  equivalentTitles: string[];
  adjacentTitles: string[];
  mustHaveKeywords: string[];
  supportingKeywords: string[];
  excludedTerms: string[];
  preciseLocation: string;
  expandedLocation: string;
  discoveryLocation: string;
  rationale: string;
};

type SourcingRound = {
  level: "precise" | "expanded" | "discovery";
  titles: string[];
  keywords: string[];
  location?: string;
};

const protectedTerms = /\b(g[eê]nero|mulher(?:es)?|homem(?:ens)?|ra[çc]a|etnia|religi[aã]o|idade|estado civil|gravidez|defici[eê]ncia|orienta[çc][aã]o sexual|identidade de g[eê]nero|pol[ií]tica)\b/i;
const actorBudget = 50;

export async function executeStrategicHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  const startedAt = Date.now();
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;

  const planResult = await createSourcingPlan(search, input);
  const rounds = buildCumulativeRounds(planResult.plan, search, input);
  const targetUsefulCount = Math.min(input.quantity, Math.max(5, Math.ceil(input.quantity * 0.6)));
  const discovered = new Map<string, HrCandidate>();
  const rawSnapshot: unknown[] = [];
  const warnings = [...planResult.warnings];
  let actorFailed = false;
  let executedRounds = 0;

  for (const round of rounds) {
    if (Date.now() - startedAt > 215_000) {
      warnings.push("A expansão foi interrompida antes da próxima rodada para respeitar o tempo máximo da busca.");
      break;
    }

    const searchQuery = buildRoundQuery(round);
    if (!searchQuery) continue;

    let items: unknown[] = [];
    try {
      items = await runApifyActor("linkedinProfileSearch", compact({
        profileScraperMode: "Short",
        maxItems: Math.min(actorBudget, Math.max(25, input.quantity * 2)),
        takePages: 2,
        searchQuery,
        locations: round.location ? [round.location] : [],
      }));
    } catch {
      actorFailed = true;
      warnings.push(`A rodada ${roundLabel(round.level)} ficou indisponível no Apify; a busca continuou com as fontes/rodadas restantes quando possível.`);
      continue;
    }

    executedRounds += 1;
    rawSnapshot.push(...items);
    const normalized = normalizeCandidates(items);
    for (const candidate of normalized) mergeInto(discovered, candidate);

    const strictNow = applyCandidateQualityGate([...discovered.values()], search.jobDna, originalEvaluationInput(search, input));
    if (strictNow.eligible.length >= targetUsefulCount) break;
    if (discovered.size >= Math.min(50, Math.max(input.quantity * 2, 20)) && round.level !== "precise") break;
  }

  if (discovered.size === 0) {
    await persistStrategicResult({
      id,
      ownerId,
      candidates: [],
      rawSnapshot,
      warnings: strategyWarnings(planResult, warnings, executedRounds),
      status: actorFailed && executedRounds === 0 ? "connector_error" : "no_results",
    });
    return findOwnedHrHuntingSearch(id, ownerId);
  }

  let pool = [...discovered.values()];
  pool = await enrichBestProfiles(pool, search.jobDna, originalEvaluationInput(search, input), warnings);

  const evaluationInput = originalEvaluationInput(search, input);
  const quality = applyCandidateQualityGate(pool, search.jobDna, evaluationInput);
  const strictRanked = rankCandidates(quality.eligible, search.jobDna, evaluationInput);
  const expandedRanked = rankCandidates(quality.rejected, search.jobDna, evaluationInput);
  const candidates = deduplicateCandidates([...strictRanked, ...expandedRanked]).slice(0, input.quantity);

  if (quality.rejected.length) {
    warnings.push(`${quality.rejected.length} perfil(is) vieram das rodadas ampliadas e foram mantidos no ranking com aderência calculada contra os critérios originais da vaga.`);
  }

  await persistStrategicResult({
    id,
    ownerId,
    candidates,
    rawSnapshot,
    warnings: strategyWarnings(planResult, warnings, executedRounds),
    status: candidates.length ? "results_ready" : actorFailed ? "connector_error" : "no_results",
  });

  return findOwnedHrHuntingSearch(id, ownerId);
}

async function createSourcingPlan(search: HrHuntingSearchSnapshot, input: SearchInput) {
  const fallback = fallbackSourcingPlan(search, input);
  const targetTitle = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const targetLocation = input.location?.trim() || search.jobDna.location || "";
  const prompt = [
    "Você é um especialista sênior de Talent Sourcing da Share AI.",
    "Sua única tarefa nesta etapa é ANALISAR a vaga e desenhar os parâmetros de busca que serão enviados depois ao Apify. NÃO execute pesquisa de candidatos, NÃO chame Actors, NÃO navegue na web e NÃO invente perfis.",
    "A meta é aumentar recall sem afrouxar a avaliação final: expanda nomes de cargo e geografia apenas para DESCOBERTA; a aderência continuará sendo calculada contra a vaga original.",
    "Crie títulos equivalentes que representem a mesma função em português e inglês. Crie títulos adjacentes somente quando as responsabilidades da vaga tornarem a transição profissional plausível.",
    "mustHaveKeywords deve conter termos funcionais úteis para localizar experiência profissional; supportingKeywords pode incluir tecnologias, processos, metodologias e domínios presentes ou claramente derivados das responsabilidades da vaga.",
    "excludedTerms deve conter somente termos profissionais que aumentariam falsos positivos. Nunca use atributos pessoais ou protegidos como exclusão.",
    "Para localização: preciseLocation preserva o recorte solicitado; expandedLocation pode representar região metropolitana/entorno/estado quando isso ampliar sourcing de forma razoável; discoveryLocation pode ficar vazia para uma última rodada nacional quando a vaga/modelo permitir. Localização ampliada não é critério de aprovação.",
    "Não use gênero, raça, etnia, religião, idade, deficiência, orientação sexual, identidade de gênero, estado civil, gravidez, fotografia, opinião política ou qualquer atributo pessoal/protegido.",
    `Cargo informado: ${targetTitle}`,
    `Empresa: ${search.companyName || "não informada"}`,
    `Localização informada: ${targetLocation || "não informada"}`,
    `Modelo de trabalho: ${search.jobDna.workModel || "não informado"}`,
    `Senioridade informada: ${input.seniority.join(", ") || search.jobDna.seniority || "não informada"}`,
    `Resumo da vaga: ${search.jobDna.shortSummary}`,
    `Responsabilidades: ${search.jobDna.responsibilities.join(" | ") || "não detalhadas"}`,
    `Critérios profissionais: ${formatCriteria(search.jobDna)}`,
    `Palavras-chave já sugeridas: ${input.keywords.join(", ") || "nenhuma"}`,
    "Responda apenas no schema solicitado. Mantenha listas curtas e úteis: até 6 equivalentes, até 6 adjacentes e até 8 palavras-chave por grupo.",
  ].join("\n");

  const result = await runManusStructuredTask<ManusSourcingPlan>({
    prompt,
    schema: sourcingPlanSchema,
    title: "Share AI · HR Hunting · Estratégia de sourcing",
    countResults: (value) => 1 + value.equivalentTitles.length + value.adjacentTitles.length,
  });

  if (result.status !== "success_with_results" || !result.value) {
    return {
      plan: fallback,
      result,
      warnings: [
        ...result.warnings,
        "O Manus não concluiu a estratégia de sourcing; a Share AI aplicou uma expansão conservadora baseada no título e no DNA da vaga.",
      ],
    };
  }

  return {
    plan: sanitizePlan(result.value, fallback),
    result,
    warnings: result.warnings,
  };
}

function buildCumulativeRounds(plan: ManusSourcingPlan, search: HrHuntingSearchSnapshot, input: SearchInput): SourcingRound[] {
  const originalTitle = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const preciseTitles = unique([originalTitle, plan.primaryTitle, ...plan.equivalentTitles.slice(0, 2)]).slice(0, 4);
  const expandedTitles = unique([...preciseTitles, ...plan.equivalentTitles, ...plan.adjacentTitles.slice(0, 3)]).slice(0, 8);
  const discoveryTitles = unique([...expandedTitles, ...plan.adjacentTitles]).slice(0, 12);
  const originalLocation = input.location?.trim() || search.jobDna.location || "";

  return [
    {
      level: "precise",
      titles: preciseTitles,
      keywords: plan.mustHaveKeywords.slice(0, 3),
      location: plan.preciseLocation || originalLocation || undefined,
    },
    {
      level: "expanded",
      titles: expandedTitles,
      keywords: unique([...plan.mustHaveKeywords, ...plan.supportingKeywords]).slice(0, 6),
      location: plan.expandedLocation || originalLocation || undefined,
    },
    {
      level: "discovery",
      titles: discoveryTitles,
      keywords: unique([...plan.mustHaveKeywords, ...plan.supportingKeywords]).slice(0, 8),
      location: plan.discoveryLocation || undefined,
    },
  ];
}

function buildRoundQuery(round: SourcingRound) {
  const titleTerms = unique(round.titles).map(quoteIfNeeded);
  const keywordTerms = round.level === "discovery" ? unique(round.keywords).slice(0, 4).map(quoteIfNeeded) : [];
  return [...titleTerms, ...keywordTerms].filter(Boolean).join(" OR ").slice(0, 520);
}

function originalEvaluationInput(search: HrHuntingSearchSnapshot, input: SearchInput): SearchInput {
  return {
    ...input,
    currentTitle: input.currentTitle?.trim() || search.jobDna.title || search.title,
    location: input.location?.trim() || search.jobDna.location || undefined,
  };
}

async function enrichBestProfiles(candidates: HrCandidate[], dna: JobDna, input: SearchInput, warnings: string[]) {
  const ranked = rankCandidates(candidates, dna, input);
  const urls = ranked.slice(0, Math.min(10, Math.max(5, input.quantity))).map((candidate) => candidate.profileUrl).filter((url): url is string => Boolean(url));
  if (!urls.length) return candidates;

  try {
    const raw = await runApifyActor("linkedinProfile", { urls });
    const enriched = normalizeCandidates(raw);
    const enrichedByUrl = new Map(enriched.filter((candidate) => candidate.profileUrl).map((candidate) => [candidate.profileUrl!, candidate]));
    const merged = candidates.map((candidate) => {
      const detail = candidate.profileUrl ? enrichedByUrl.get(candidate.profileUrl) : undefined;
      return detail ? mergeCandidate(candidate, detail) : candidate;
    });
    warnings.push(`A Share AI enriqueceu ${enriched.length} perfil(is) prioritário(s) antes do ranking final.`);
    return merged;
  } catch {
    warnings.push("O enriquecimento dos perfis prioritários ficou indisponível; o ranking usou os dados da descoberta.");
    return candidates;
  }
}

async function persistStrategicResult({
  id,
  ownerId,
  candidates,
  rawSnapshot,
  warnings,
  status,
}: {
  id: string;
  ownerId: string;
  candidates: HrCandidate[];
  rawSnapshot: unknown[];
  warnings: string[];
  status: string;
}) {
  await getPrisma().$transaction(async (tx) => {
    await tx.hrHuntingCandidate.deleteMany({ where: { searchId: id, search: { ownerId } } });
    if (candidates.length) {
      await tx.hrHuntingCandidate.createMany({
        data: candidates.map((candidate) => ({
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
        })),
      });
    }

    for (const candidate of candidates) {
      const row = await tx.hrHuntingCandidate.findUnique({ where: { id: candidate.id }, select: { id: true } });
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

function strategyWarnings(
  planResult: { plan: ManusSourcingPlan; result: ManusTaskResult<ManusSourcingPlan>; warnings: string[] },
  warnings: string[],
  executedRounds: number,
) {
  const { plan, result } = planResult;
  const strategy = `Estratégia de sourcing: ${unique([plan.primaryTitle, ...plan.equivalentTitles]).length} título(s) principal/equivalente(s), ${plan.adjacentTitles.length} adjacente(s) e ${executedRounds} rodada(s) executada(s).`;
  const geography = plan.expandedLocation
    ? `Expansão geográfica sugerida: ${plan.preciseLocation || "recorte original"} → ${plan.expandedLocation}${plan.discoveryLocation ? ` → ${plan.discoveryLocation}` : " → busca aberta na rodada de descoberta"}.`
    : "A estratégia preservou o recorte geográfico original e abriu a localização somente na rodada de descoberta, se necessária.";
  const credits = result.creditUsage == null ? [] : [`Consumo Manus para planejar o sourcing: ${result.creditUsage} créditos.`];
  return unique([...warnings, strategy, geography, plan.rationale, ...credits]).filter(Boolean);
}

function fallbackSourcingPlan(search: HrHuntingSearchSnapshot, input: SearchInput): ManusSourcingPlan {
  const title = input.currentTitle?.trim() || search.jobDna.title || search.title;
  const functional = simplifyFunctionalTitle(title);
  const location = input.location?.trim() || search.jobDna.location || "";
  return {
    primaryTitle: title,
    equivalentTitles: functional && normalize(functional) !== normalize(title) ? [functional] : [],
    adjacentTitles: [],
    mustHaveKeywords: unique(input.keywords).slice(0, 8),
    supportingKeywords: [],
    excludedTerms: [],
    preciseLocation: location,
    expandedLocation: broaderLocation(location),
    discoveryLocation: "",
    rationale: "Estratégia conservadora gerada localmente porque o planejamento Manus não estava disponível.",
  };
}

function sanitizePlan(value: ManusSourcingPlan, fallback: ManusSourcingPlan): ManusSourcingPlan {
  const safe = (items: unknown, limit: number) => unique(Array.isArray(items) ? items.filter((item): item is string => typeof item === "string").filter((item) => !protectedTerms.test(item)) : []).slice(0, limit);
  return {
    primaryTitle: clean(value.primaryTitle) || fallback.primaryTitle,
    equivalentTitles: safe(value.equivalentTitles, 6),
    adjacentTitles: safe(value.adjacentTitles, 6),
    mustHaveKeywords: safe(value.mustHaveKeywords, 8),
    supportingKeywords: safe(value.supportingKeywords, 8),
    excludedTerms: safe(value.excludedTerms, 8),
    preciseLocation: clean(value.preciseLocation) || fallback.preciseLocation,
    expandedLocation: clean(value.expandedLocation) || fallback.expandedLocation,
    discoveryLocation: clean(value.discoveryLocation),
    rationale: clean(value.rationale) || "O Manus estruturou uma estratégia progressiva de sourcing para ampliar a descoberta sem alterar os critérios originais da vaga.",
  };
}

export function simplifyFunctionalTitle(title: string) {
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

function mergeInto(map: Map<string, HrCandidate>, candidate: HrCandidate) {
  const key = candidate.profileUrl || `${normalize(candidate.name)}|${normalize(candidate.currentTitle || "")}`;
  const previous = map.get(key);
  map.set(key, previous ? mergeCandidate(previous, candidate) : candidate);
}

function mergeCandidate(base: HrCandidate, update: HrCandidate): HrCandidate {
  return {
    ...base,
    currentTitle: update.currentTitle || base.currentTitle,
    currentCompany: update.currentCompany || base.currentCompany,
    location: update.location || base.location,
    profileUrl: update.profileUrl || base.profileUrl,
    professionalSummary: longer(update.professionalSummary, base.professionalSummary),
    sourceName: base.sourceName === update.sourceName ? base.sourceName : `${base.sourceName} + ${update.sourceName}`,
    confidence: strongerConfidence(base.confidence, update.confidence),
    contacts: dedupeContacts([...base.contacts, ...update.contacts]),
  };
}

function deduplicateCandidates(candidates: HrCandidate[]) {
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

function strongerConfidence(a: EvidenceState, b: EvidenceState): EvidenceState {
  const order: EvidenceState[] = ["não verificado", "inferência", "provável", "confirmado"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function longer(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

function toPrismaConfidence(value: EvidenceState): ConfidenceLevel {
  if (value === "confirmado") return "CONFIRMED";
  if (value === "provável") return "LIKELY";
  if (value === "inferência") return "INFERENCE";
  return "UNVERIFIED";
}

function quoteIfNeeded(value: string) {
  const cleaned = clean(value).replace(/"/g, "");
  if (!cleaned) return "";
  return cleaned.includes(" ") ? `"${cleaned}"` : cleaned;
}

function clean(value: unknown) {
  return typeof value === "string" && !protectedTerms.test(value) ? value.replace(/\s+/g, " ").trim().slice(0, 220) : "";
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const cleaned = clean(value);
    const key = normalize(cleaned);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(clean);
}

function compact(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function roundLabel(level: SourcingRound["level"]) {
  if (level === "precise") return "precisa";
  if (level === "expanded") return "ampliada";
  return "de descoberta";
}

function formatCriteria(dna: JobDna) {
  return dna.criteria
    .filter((criterion) => criterion.kind !== "não relevante")
    .slice(0, 16)
    .map((criterion) => `${criterion.kind}: ${criterion.label}`)
    .join(" | ") || "não especificados";
}

const sourcingPlanSchema = {
  type: "object",
  properties: {
    primaryTitle: { type: "string" },
    equivalentTitles: { type: "array", items: { type: "string" }, maxItems: 6 },
    adjacentTitles: { type: "array", items: { type: "string" }, maxItems: 6 },
    mustHaveKeywords: { type: "array", items: { type: "string" }, maxItems: 8 },
    supportingKeywords: { type: "array", items: { type: "string" }, maxItems: 8 },
    excludedTerms: { type: "array", items: { type: "string" }, maxItems: 8 },
    preciseLocation: { type: "string" },
    expandedLocation: { type: "string" },
    discoveryLocation: { type: "string" },
    rationale: { type: "string" },
  },
  required: [
    "primaryTitle",
    "equivalentTitles",
    "adjacentTitles",
    "mustHaveKeywords",
    "supportingKeywords",
    "excludedTerms",
    "preciseLocation",
    "expandedLocation",
    "discoveryLocation",
    "rationale",
  ],
  additionalProperties: false,
} as const;
