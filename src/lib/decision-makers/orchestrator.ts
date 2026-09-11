import "server-only";
import { createHash } from "node:crypto";
import { getBusinessUnitDna } from "@/lib/business-units/dna";
import {
  discoverBroadPeople,
  discoverCompanies,
  discoverHarvestPeople,
  enrichPersonPosts,
  enrichPersonProfile,
  researchCompanies,
} from "@/lib/connectors/apifyHunting";
import { applyAiRanking, refineDecisionMakerRanking } from "@/lib/decision-makers/aiRanking";
import { mergePeople, normalizeCompanies, normalizePeople } from "@/lib/decision-makers/normalization";
import { rankCompanies, rankPeople, targetRolesNotFound } from "@/lib/decision-makers/ranking";
import { expandRoleFamilies } from "@/lib/decision-makers/roleIntelligence";
import type { DecisionMakerResult, DecisionMakerSearchInput, HuntingPerson, PersonSearchInput } from "@/lib/decision-makers/search";
import {
  manusCompaniesToRawItems,
  manusPeopleToRawItems,
  manusWarnings,
  researchB2bCompaniesWithManus,
  researchB2bPeopleWithManus,
} from "@/lib/hunting/manusHuntingProvider";

type HuntingDependencies = {
  discoverCompanies: typeof discoverCompanies;
  discoverHarvestPeople: typeof discoverHarvestPeople;
  discoverBroadPeople: typeof discoverBroadPeople;
  enrichPersonProfile: typeof enrichPersonProfile;
  enrichPersonPosts: typeof enrichPersonPosts;
  researchCompanies: typeof researchCompanies;
  researchManusCompanies: typeof researchB2bCompaniesWithManus;
  researchManusPeople: typeof researchB2bPeopleWithManus;
  refineRanking: typeof refineDecisionMakerRanking;
  now: () => Date;
};

const defaultDependencies: HuntingDependencies = {
  discoverCompanies,
  discoverHarvestPeople,
  discoverBroadPeople,
  enrichPersonProfile,
  enrichPersonPosts,
  researchCompanies,
  researchManusCompanies: researchB2bCompaniesWithManus,
  researchManusPeople: researchB2bPeopleWithManus,
  refineRanking: refineDecisionMakerRanking,
  now: () => new Date(),
};

const resultCache = new Map<string, { expiresAt: number; result: DecisionMakerResult }>();
const cacheTtlMs = 10 * 60 * 1000;

export async function executeDecisionMakerSearch(input: DecisionMakerSearchInput, dependencies: Partial<HuntingDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  const cacheKey = createQueryId(input);
  const cached = resultCache.get(cacheKey);
  if (!input.forceRefresh && cached && cached.expiresAt > deps.now().getTime()) return { ...cached.result, fromCache: true };

  const result = input.mode === "companies"
    ? await executeCompanySearch(input, cacheKey, deps)
    : await executePersonSearch(input, cacheKey, deps);

  resultCache.set(cacheKey, { expiresAt: deps.now().getTime() + cacheTtlMs, result });
  return result;
}

async function executeCompanySearch(input: Extract<DecisionMakerSearchInput, { mode: "companies" }>, queryId: string, deps: HuntingDependencies): Promise<DecisionMakerResult> {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const warnings: string[] = [];
  let items: unknown[] = [];
  let sourceTitle = "LinkedIn Company Search via Harvest";
  let manusFallbackUsed = false;

  try {
    items = await deps.discoverCompanies(input);
  } catch {
    warnings.push("A busca direta de empresas ficou indisponível; o Manus foi acionado apenas como fallback.");
    try {
      const manusResult = await deps.researchManusCompanies(input);
      warnings.push(...manusWarnings(manusResult));
      if (manusResult.status === "success_with_results") {
        items = manusCompaniesToRawItems(manusResult);
        manusFallbackUsed = items.length > 0;
        sourceTitle = "Manus · fallback de pesquisa B2B";
      }
    } catch {
      warnings.push("O fallback do Manus também ficou indisponível.");
    }
    if (!items.length) throw new Error("As fontes de descoberta de empresas estão indisponíveis no momento.");
  }

  const normalized = normalizeCompanies(items, sourceTitle);
  if (items.length > 0 && normalized.length === 0) {
    throw new Error("A fonte retornou empresas, mas o formato recebido não pôde ser normalizado com segurança.");
  }
  const companies = rankCompanies(normalized, input).slice(0, input.filters.quantity);

  return {
    mode: "companies",
    queryId,
    generatedAt: deps.now().toISOString(),
    fromCache: false,
    businessUnitName: unit.name,
    objective: input.objective,
    companies,
    people: [],
    targetRolesNotFound: [],
    nextBestAction: companies.some((company) => company.linkedinUrl)
      ? { title: "Buscar decisores nas contas encontradas", reason: "As contas com LinkedIn identificado já podem disparar a busca de pessoas diretamente pela própria linha.", impact: "alto", effort: "baixo" }
      : { title: "Revisar os filtros de descoberta", reason: "A fonte respondeu sem confirmar empresas verificáveis para este recorte. Amplie os critérios antes de concluir que não existem contas aderentes.", impact: "alto", effort: "baixo" },
    sources: [{
      title: sourceTitle,
      confidence: companies.length ? "provável" : "não verificado",
      notes: manusFallbackUsed
        ? "O Manus foi usado somente porque a fonte direta de empresas falhou."
        : "A busca de empresas foi executada diretamente no Actor especializado, sem Manus no caminho crítico.",
    }],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: manusFallbackUsed ? "Apify direto falhou; Manus usado como fallback." : "Apify direto como fonte principal; Manus não foi necessário.",
      basicCandidates: companies.length,
      profileEnrichments: 0,
      postEnrichments: 0,
      broadDiscoveryUsed: manusFallbackUsed,
    },
  };
}

async function executePersonSearch(input: Extract<DecisionMakerSearchInput, { mode: "people" }>, queryId: string, deps: HuntingDependencies): Promise<DecisionMakerResult> {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const filters = { ...input.filters, roles: expandRoleFamilies(input.filters.roles) };
  const expandedInput: PersonSearchInput = { ...input, filters };
  const warnings: string[] = [];
  let primaryItems: unknown[] = [];
  let fallbackItems: unknown[] = [];
  let primaryFailed = false;
  let fallbackFailed = false;
  let fallbackUsed = false;
  let manusUsed = false;
  let primarySource = "Funcionários públicos via Dami Studio";

  try {
    primaryItems = await deps.discoverHarvestPeople(expandedInput);
  } catch {
    primaryFailed = true;
    warnings.push("O Actor principal de funcionários não respondeu; a segunda fonte foi acionada automaticamente.");
  }

  if (!primaryItems.length || input.filters.includeBroadDiscovery) {
    try {
      fallbackItems = await deps.discoverBroadPeople(expandedInput);
      fallbackUsed = fallbackItems.length > 0;
      if (!primaryItems.length && fallbackUsed) warnings.push("A segunda fonte de funcionários assumiu a descoberta porque a principal não trouxe cobertura.");
    } catch {
      fallbackFailed = true;
      if (!primaryItems.length) warnings.push("A segunda fonte de funcionários também não respondeu.");
      else warnings.push("A expansão complementar não respondeu; os resultados da fonte principal foram preservados.");
    }
  }

  if (!primaryItems.length && !fallbackItems.length && primaryFailed && fallbackFailed) {
    warnings.push("Os dois Actors diretos falharam; o Manus foi acionado como último fallback.");
    try {
      const manusResult = await deps.researchManusPeople(expandedInput);
      warnings.push(...manusWarnings(manusResult));
      if (manusResult.status === "success_with_results") {
        primaryItems = manusPeopleToRawItems(manusResult);
        manusUsed = primaryItems.length > 0;
        if (manusUsed) primarySource = "Manus · fallback de pesquisa de decisores";
      }
    } catch {
      warnings.push("O fallback do Manus também ficou indisponível.");
    }
    if (!primaryItems.length) throw new Error("As fontes de descoberta de pessoas estão indisponíveis no momento.");
  }

  const primaryPeople = normalizePeople(primaryItems, primarySource, input.filters.desiredDecisionRole);
  const fallbackPeople = normalizePeople(fallbackItems, "Funcionários públicos via Apt Marble", input.filters.desiredDecisionRole);
  if ((primaryItems.length > 0 && primaryPeople.length === 0) || (fallbackItems.length > 0 && fallbackPeople.length === 0 && primaryPeople.length === 0)) {
    throw new Error("A fonte retornou perfis, mas o formato recebido não pôde ser normalizado com segurança.");
  }

  let people = mergePeople(primaryPeople, fallbackPeople).slice(0, input.filters.quantity);
  people = rankPeople(people, expandedInput);

  // Enriquecimentos individuais de perfil/posts saíram do caminho crítico. Eles geravam
  // várias execuções adicionais por pesquisa e podiam transformar uma descoberta válida
  // em timeout. A primeira resposta agora prioriza velocidade e evidência básica.
  const profileEnrichments = 0;
  const postEnrichments = 0;

  let aiNextAction: DecisionMakerResult["nextBestAction"] | null = null;
  if (people.length) {
    try {
      const refinement = await deps.refineRanking(people, input.objective, unit.name);
      if (refinement) {
        people = applyAiRanking(people, refinement);
        aiNextAction = { title: refinement.nextBestAction.title, reason: refinement.nextBestAction.reason, impact: "alto", effort: "baixo" };
      }
    } catch {
      warnings.push("A revisão especialista está indisponível; o ranking explicável por evidências foi preservado.");
    }
  }

  const missingRoles = targetRolesNotFound(input.filters.roles, people);
  const companies = companiesFromPeople(people);
  const discoveryTitle = manusUsed
    ? "Manus · fallback de decisores"
    : fallbackUsed && !primaryPeople.length
      ? "Apt Marble · funcionários públicos"
      : fallbackUsed
        ? "Dami Studio + Apt Marble · funcionários públicos"
        : "Dami Studio · funcionários públicos";

  return {
    mode: "people",
    queryId,
    generatedAt: deps.now().toISOString(),
    fromCache: false,
    businessUnitName: unit.name,
    objective: input.objective,
    companies,
    people,
    targetRolesNotFound: missingRoles,
    nextBestAction: aiNextAction ?? nextActionForPeople(people),
    sources: [{
      title: discoveryTitle,
      confidence: people.length ? "provável" : "não verificado",
      notes: manusUsed
        ? "Os Actors diretos falharam e o Manus foi usado somente como último fallback."
        : "A descoberta usa Actors diretos de funcionários e aceita apenas perfis com URL pública real do LinkedIn.",
    }],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: manusUsed
        ? "Actors diretos indisponíveis; Manus usado como último fallback."
        : fallbackUsed
          ? "Actor principal direto com segunda fonte usada para cobertura."
          : "Actor principal direto; sem Manus e sem enriquecimentos individuais no caminho crítico.",
      basicCandidates: people.length,
      profileEnrichments,
      postEnrichments,
      broadDiscoveryUsed: fallbackUsed,
    },
  };
}

function companiesFromPeople(people: HuntingPerson[]) {
  const names = [...new Set(people.map((person) => person.company).filter((name) => name !== "Empresa não informada"))];
  return names.map((name) => ({
    id: createHash("sha1").update(name).digest("hex").slice(0, 12),
    name,
    fit: "Média" as const,
    fitReasons: ["Conta associada a profissionais encontrados em fonte pública."],
    signals: [],
    confidence: "provável" as const,
    source: "Resultados de profissionais",
  }));
}

function nextActionForPeople(people: HuntingPerson[]): DecisionMakerResult["nextBestAction"] {
  const first = people[0];
  if (!first) return { title: "Revisar filtros e tentar novamente", reason: "As fontes responderam sem erro, mas nenhuma pessoa real foi confirmada. Amplie cargos ou reduza filtros.", impact: "alto", effort: "baixo" };
  if (first.recentSignals.length) return { title: `Validar o contexto de ${first.name}`, reason: "Há sinal profissional recente. Leia a fonte e confirme sua relação com o objetivo antes de preparar rapport.", impact: "alto", effort: "baixo" };
  return { title: `Pesquisar sinais recentes de ${first.name}`, reason: "O perfil tem aderência ao papel, mas ainda faltam evidências de prioridade ou momento para uma conversa relevante.", impact: "alto", effort: "médio" };
}

function createQueryId(input: DecisionMakerSearchInput) {
  const cacheable = { ...input, forceRefresh: false };
  return createHash("sha256").update(JSON.stringify(cacheable)).digest("hex").slice(0, 20);
}

export function clearDecisionMakerCache() {
  resultCache.clear();
}
