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
import { mergePeople, normalizeCompanies, normalizePeople, pickString } from "@/lib/decision-makers/normalization";
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
  let sourceTitle = "Manus · pesquisa B2B";
  let manusUsed = false;

  try {
    const manusResult = await deps.researchManusCompanies(input);
    warnings.push(...manusWarnings(manusResult));
    if (manusResult.status === "success_with_results") {
      items = manusCompaniesToRawItems(manusResult);
      manusUsed = items.length > 0;
      if (!manusUsed) warnings.push("Manus retornou registros sem evidência suficiente para serem aceitos; a Share AI acionou o Apify direto como confirmação.");
    } else if (manusResult.status === "success_empty") {
      warnings.push("Manus concluiu a pesquisa sem empresas verificáveis; o Apify direto foi consultado para confirmar a cobertura.");
    } else {
      warnings.push("Manus não concluiu a pesquisa principal; o Apify direto foi acionado como fallback.");
    }
  } catch {
    warnings.push("Manus ficou indisponível antes de concluir a pesquisa; o Apify direto foi acionado como fallback.");
  }

  if (!manusUsed) {
    sourceTitle = "LinkedIn Company Search via Harvest";
    try {
      items = await deps.discoverCompanies(input);
    } catch {
      throw new Error("Manus e a fonte direta de descoberta de empresas estão indisponíveis.");
    }
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
      ? { title: "Selecionar contas e buscar pessoas", reason: "As contas com página pública identificada podem seguir para uma busca econômica de profissionais básicos.", impact: "alto", effort: "baixo" }
      : { title: "Revisar os filtros de descoberta", reason: "As fontes responderam sem confirmar empresas verificáveis para este recorte. Amplie o universo antes de concluir que não existem contas aderentes.", impact: "alto", effort: "baixo" },
    sources: [{ title: sourceTitle, confidence: companies.length ? "provável" : "não verificado", notes: manusUsed ? "Pesquisa orquestrada pelo Manus com evidências públicas; Apify é usado pelo agente quando autorizado." : "Fallback direto do Apify normalizado e deduplicado pela Share AI." }],
    warnings: [...new Set(warnings)],
    cost: { strategy: manusUsed ? "Manus como pesquisa principal; fallback Apify não foi necessário para descoberta." : "Fallback Apify usado porque Manus não produziu cobertura verificável.", basicCandidates: companies.length, profileEnrichments: 0, postEnrichments: 0, broadDiscoveryUsed: !manusUsed },
  };
}

async function executePersonSearch(input: Extract<DecisionMakerSearchInput, { mode: "people" }>, queryId: string, deps: HuntingDependencies): Promise<DecisionMakerResult> {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const filters = { ...input.filters, roles: expandRoleFamilies(input.filters.roles) };
  const expandedInput: PersonSearchInput = { ...input, filters };
  const warnings: string[] = [];
  let harvestItems: unknown[] = [];
  let broadItems: unknown[] = [];
  let companyItems: unknown[] = [];
  let harvestFailed = false;
  let broadFailed = false;
  let manusUsed = false;
  let primarySource = "Manus + fontes públicas";

  try {
    const manusResult = await deps.researchManusPeople(expandedInput);
    warnings.push(...manusWarnings(manusResult));
    if (manusResult.status === "success_with_results") {
      harvestItems = manusPeopleToRawItems(manusResult);
      manusUsed = harvestItems.length > 0;
      if (!manusUsed) warnings.push("Manus retornou perfis sem LinkedIn real verificável; a Share AI acionou o Apify direto como confirmação.");
    } else if (manusResult.status === "success_empty") {
      warnings.push("Manus concluiu sem pessoas verificáveis; o Apify direto foi consultado para confirmar a cobertura.");
    } else {
      warnings.push("Manus não concluiu a pesquisa principal; o Apify direto foi acionado como fallback.");
    }
  } catch {
    warnings.push("Manus ficou indisponível durante a descoberta; o Apify direto foi acionado como fallback.");
  }

  if (!manusUsed) {
    primarySource = "Funcionários públicos da empresa via Harvest";
    try {
      companyItems = await deps.researchCompanies(input.filters.companyLinkedinUrls);
    } catch {
      warnings.push("Os detalhes corporativos não estavam disponíveis; a busca direta continuou com as páginas informadas.");
    }

    try {
      harvestItems = await deps.discoverHarvestPeople(expandedInput);
    } catch {
      harvestFailed = true;
      warnings.push("A busca direta principal de funcionários da conta falhou.");
    }

    if (input.filters.includeBroadDiscovery) {
      warnings.push("A descoberta complementar direta usa uma segunda busca pública do Harvest e pode gerar custo adicional.");
      try {
        broadItems = await deps.discoverBroadPeople(expandedInput);
      } catch {
        broadFailed = true;
        warnings.push("A descoberta complementar direta também está indisponível.");
      }
    }

    if (harvestFailed && (!input.filters.includeBroadDiscovery || broadFailed)) {
      throw new Error("Manus e as fontes diretas de descoberta de pessoas estão indisponíveis.");
    }
  }

  const harvestPeople = normalizePeople(harvestItems, primarySource, input.filters.desiredDecisionRole);
  const broadPeople = normalizePeople(broadItems, "Descoberta complementar via Harvest Profile Search", input.filters.desiredDecisionRole);
  if ((harvestItems.length > 0 && harvestPeople.length === 0) || (broadItems.length > 0 && broadPeople.length === 0 && harvestPeople.length === 0)) {
    throw new Error("A fonte retornou perfis, mas o formato recebido não pôde ser normalizado com segurança.");
  }

  let people = mergePeople(harvestPeople, broadPeople).slice(0, input.filters.quantity);
  people = rankPeople(people, expandedInput);

  const profileResults = await Promise.all(people.slice(0, 5).map(async (person) => {
    try {
      const profileItems = await deps.enrichPersonProfile(person.linkedinUrl);
      return applyProfileEvidence(person, profileItems) ? 1 : 0;
    } catch {
      warnings.push(`O perfil de ${person.name} não pôde ser enriquecido; o resultado confirmado da descoberta foi mantido.`);
      return 0;
    }
  }));
  const profileEnrichments = profileResults.reduce<number>((total, current) => total + current, 0);

  const postResults = await Promise.all(people.slice(0, 3).map(async (person) => {
    try {
      const postItems = await deps.enrichPersonPosts(person.linkedinUrl);
      const signals = extractPostSignals(postItems);
      if (!signals.length) return 0;
      person.recentSignals = signals;
      return 1;
    } catch {
      warnings.push(`As publicações de ${person.name} não estavam disponíveis; o ranking continua baseado no perfil.`);
      return 0;
    }
  }));
  const postEnrichments = postResults.reduce<number>((total, current) => total + current, 0);

  people = rankPeople(people, expandedInput);
  let aiNextAction: DecisionMakerResult["nextBestAction"] | null = null;
  try {
    const refinement = await deps.refineRanking(people, input.objective, unit.name);
    if (refinement) {
      people = applyAiRanking(people, refinement);
      aiNextAction = { title: refinement.nextBestAction.title, reason: refinement.nextBestAction.reason, impact: "alto", effort: "baixo" };
    }
  } catch {
    warnings.push("A revisão especialista está indisponível; o ranking explicável por evidências foi preservado.");
  }

  const missingRoles = targetRolesNotFound(input.filters.roles, people);
  const researchedCompanies = normalizeCompanies(companyItems, "Páginas corporativas públicas");
  const companies = researchedCompanies.length ? researchedCompanies : companiesFromPeople(people);
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
    sources: [
      { title: manusUsed ? "Manus · pesquisa de decisores" : "Funcionários públicos das contas selecionadas", confidence: harvestPeople.length ? "provável" : "não verificado", notes: manusUsed ? "Pessoas aceitas somente com LinkedIn real e evidência profissional; o conector Apify é priorizado pelo Manus quando autorizado." : "Fallback direto do Harvest normalizado e deduplicado pela camada segura de conectores." },
      { title: "Perfis públicos enriquecidos", confidence: profileEnrichments ? "confirmado" : "não verificado", notes: `${profileEnrichments} dos 5 perfis prioritários receberam evidências adicionais.` },
      { title: "Publicações profissionais recentes", confidence: postEnrichments ? "confirmado" : "não verificado", notes: `${postEnrichments} dos 3 perfis prioritários apresentaram sinais públicos recentes.` },
    ],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: manusUsed ? "Manus como descoberta principal; enriquecimento Apify limitado aos perfis prioritários." : "Fallback Apify direto usado para descoberta e enriquecimento progressivo.",
      basicCandidates: people.length,
      profileEnrichments,
      postEnrichments,
      broadDiscoveryUsed: !manusUsed && input.filters.includeBroadDiscovery,
    },
  };
}

function applyProfileEvidence(person: HuntingPerson, items: unknown[]) {
  const record = items.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (!record) return false;
  const summary = pickString(record, ["about", "summary", "description", "headline"]);
  if (summary) person.profileSummary = summary;
  const location = pickString(record, ["location", "locationName", "geo"]);
  if (location) person.location = location;
  return Boolean(summary || location);
}

function extractPostSignals(items: unknown[]) {
  const signals: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const text = pickString(item as Record<string, unknown>, ["text", "content", "commentary", "postText", "title"]);
    if (text.trim().length >= 20) signals.push(text.trim().slice(0, 180));
    if (signals.length === 3) break;
  }
  return signals;
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
