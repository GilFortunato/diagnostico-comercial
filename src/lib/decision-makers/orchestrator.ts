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

type HuntingDependencies = {
  discoverCompanies: typeof discoverCompanies;
  discoverHarvestPeople: typeof discoverHarvestPeople;
  discoverBroadPeople: typeof discoverBroadPeople;
  enrichPersonProfile: typeof enrichPersonProfile;
  enrichPersonPosts: typeof enrichPersonPosts;
  researchCompanies: typeof researchCompanies;
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
  const warnings: string[] = ["A descoberta ampla executa o mínimo técnico de 100 resultados do Actor, mas exibe apenas o limite seguro selecionado."];
  let items: unknown[] = [];
  try {
    items = await deps.discoverCompanies(input);
  } catch {
    warnings.push("A fonte de descoberta ampla está indisponível no momento. Nenhuma empresa fictícia foi criada como substituição.");
  }
  const companies = rankCompanies(normalizeCompanies(items, "Descoberta pública via Apify"), input).slice(0, input.filters.quantity);

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
      ? { title: "Selecionar contas e buscar pessoas", reason: "As contas com página pública identificada podem seguir para uma busca econômica de até 25 profissionais básicos.", impact: "alto", effort: "baixo" }
      : { title: "Validar as empresas encontradas", reason: "Confirme domínio e página corporativa antes de iniciar o enriquecimento de pessoas.", impact: "alto", effort: "médio" },
    sources: [{ title: "Descoberta ampla de empresas", confidence: companies.length ? "provável" : "não verificado", notes: "Resultados públicos normalizados e deduplicados pela camada segura de conectores." }],
    warnings,
    cost: { strategy: "Descoberta ampla com limite visual de 25 empresas.", basicCandidates: companies.length, profileEnrichments: 0, postEnrichments: 0, broadDiscoveryUsed: true },
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

  try {
    companyItems = await deps.researchCompanies(input.filters.companyLinkedinUrls);
  } catch {
    warnings.push("Os detalhes corporativos não estavam disponíveis; a busca de pessoas continuou com as páginas informadas.");
  }

  try {
    harvestItems = await deps.discoverHarvestPeople(expandedInput);
  } catch {
    warnings.push("A busca de funcionários da conta falhou. A plataforma preservou os demais resultados e não criou pessoas fictícias.");
  }

  if (input.filters.includeBroadDiscovery) {
    warnings.push("A descoberta complementar executa o mínimo técnico de 100 resultados do Actor e pode elevar o custo da busca.");
    try {
      broadItems = await deps.discoverBroadPeople(expandedInput);
    } catch {
      warnings.push("A descoberta complementar está indisponível; os resultados da conta conhecida continuam válidos.");
    }
  }

  const harvestPeople = normalizePeople(harvestItems, "Funcionários públicos da empresa via Harvest", input.filters.desiredDecisionRole);
  const broadPeople = filterBroadPeopleByCompanies(
    normalizePeople(broadItems, "Descoberta complementar via Peaky", input.filters.desiredDecisionRole),
    input.filters.companyNames,
  );
  let people = mergePeople(harvestPeople, broadPeople).slice(0, input.filters.quantity);
  people = rankPeople(people, expandedInput);

  const profileResults = await Promise.all(people.slice(0, 5).map(async (person) => {
    try {
      const profileItems = await deps.enrichPersonProfile(person.linkedinUrl);
      return applyProfileEvidence(person, profileItems) ? 1 : 0;
    } catch {
      warnings.push(`O perfil de ${person.name} não pôde ser enriquecido; o candidato básico foi mantido.`);
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
      { title: "Funcionários públicos das contas selecionadas", confidence: harvestPeople.length ? "provável" : "não verificado", notes: "Busca básica limitada, normalizada e deduplicada pela camada segura de conectores." },
      { title: "Perfis públicos enriquecidos", confidence: profileEnrichments ? "confirmado" : "não verificado", notes: `${profileEnrichments} dos 5 perfis prioritários receberam evidências adicionais.` },
      { title: "Publicações profissionais recentes", confidence: postEnrichments ? "confirmado" : "não verificado", notes: `${postEnrichments} dos 3 perfis prioritários apresentaram sinais públicos recentes.` },
    ],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: "Até 25 candidatos básicos; enriquecimento de 5 perfis e publicações de 3 pessoas.",
      basicCandidates: people.length,
      profileEnrichments,
      postEnrichments,
      broadDiscoveryUsed: input.filters.includeBroadDiscovery,
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

function filterBroadPeopleByCompanies(people: HuntingPerson[], companyNames: string[]) {
  if (companyNames.length === 0) return people;
  const normalized = companyNames.map((name) => name.toLocaleLowerCase("pt-BR"));
  return people.filter((person) => normalized.some((name) => person.company.toLocaleLowerCase("pt-BR").includes(name)));
}

function companiesFromPeople(people: HuntingPerson[]) {
  const names = [...new Set(people.map((person) => person.company))];
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
  if (!first) return { title: "Revisar filtros e tentar novamente", reason: "Nenhuma pessoa real foi confirmada. Amplie cargos ou valide a URL corporativa, sem substituir a ausência por perfis fictícios.", impact: "alto", effort: "baixo" };
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
