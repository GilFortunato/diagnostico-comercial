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
import { employeeSize, rankCompanies, rankPeople, targetRolesNotFound } from "@/lib/decision-makers/ranking";
import { expandRoleFamilies } from "@/lib/decision-makers/roleIntelligence";
import { collectHuntingPages, collectionMessage, type CollectionSummary } from "@/lib/hunting/pagination";
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

const brazilStates: Record<string, string> = { ac:"acre", al:"alagoas", ap:"amapa", am:"amazonas", ba:"bahia", ce:"ceara", df:"distrito federal", es:"espirito santo", go:"goias", ma:"maranhao", mt:"mato grosso", ms:"mato grosso do sul", mg:"minas gerais", pa:"para", pb:"paraiba", pr:"parana", pe:"pernambuco", pi:"piaui", rj:"rio de janeiro", rn:"rio grande do norte", rs:"rio grande do sul", ro:"rondonia", rr:"roraima", sc:"santa catarina", sp:"sao paulo", se:"sergipe", to:"tocantins" };
function geoText(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function geoContains(value: string, term: string) { return (" " + value + " ").includes(" " + term + " "); }
function matchesGeo(location: string | undefined, requested: string) {
  const value = geoText(location ?? "");
  const parts = requested.split(/[,/–—-]/).map(geoText).filter(Boolean);
  if (!value || !parts.length) return false;
  return parts.every((term) => {
    if (term === "brasil" || term === "brazil") return geoContains(value, "brasil") || geoContains(value, "brazil") || Object.entries(brazilStates).some(([uf, name]) => geoContains(value, uf) || geoContains(value, name));
    const full = brazilStates[term] ?? term;
    const uf = Object.keys(brazilStates).find((key) => brazilStates[key] === full);
    return geoContains(value, full) || Boolean(uf && geoContains(value, uf));
  });
}
function matchesPeopleGeo(location: string | undefined, locations: string[]) {
  const specific = locations.filter((item) => !["brasil","brazil"].includes(geoText(item)));
  return specific.length ? specific.some((item) => matchesGeo(location, item)) : true;
}


export async function executeDecisionMakerSearch(input: DecisionMakerSearchInput, dependencies: Partial<HuntingDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  const cacheKey = createQueryId(input);
  const cached = resultCache.get(cacheKey);
  if (!input.forceRefresh && cached && cached.expiresAt > deps.now().getTime()) return { ...cached.result, fromCache: true };

  const result = input.mode === "companies"
    ? await executeCompanySearch(input, cacheKey, deps)
    : await executePersonSearch(input, cacheKey, deps);

  if (result.companies.length || result.people.length) resultCache.set(cacheKey, { expiresAt: deps.now().getTime() + cacheTtlMs, result });
  return result;
}

async function executeCompanySearch(input: Extract<DecisionMakerSearchInput, { mode: "companies" }>, queryId: string, deps: HuntingDependencies): Promise<DecisionMakerResult> {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const warnings: string[] = [];
  let sourceTitle = "LinkedIn Company Search via Harvest";
  let manusFallbackUsed = false;
  const matches = (company: import("@/lib/decision-makers/search").HuntingCompany) =>
    (!input.filters.cityPostalCodes.length || input.filters.cityPostalCodes.some(city => matchesGeo(company.location, city))) &&
    (!input.filters.states.length || input.filters.states.some(state => matchesGeo(company.location, state)));
  type Company = import("@/lib/decision-makers/search").HuntingCompany;
  const pool = new Map<string, Company>();
  let discarded = 0;
  let successfulSources = 0;
  const add = (items: unknown[], source: string) => {
    const normalized = normalizeCompanies(items, source);
    for (const company of normalized) {
      if (!matches(company)) { discarded++; continue; }
      const key = (company.linkedinUrl || company.domain || company.name).toLowerCase().replace(/\/$/, "");
      const existing = pool.get(key);
      pool.set(key, existing ? { ...existing, ...Object.fromEntries(Object.entries(company).filter(([,value]) => value !== undefined && value !== "")), employeeRange: company.employeeRange || existing.employeeRange } : company);
    }
    console.info("[b2b-hunting] company discovery result", { source, received: items.length, normalized: normalized.length, eligible: pool.size, discarded });
  };
  for (const variant of ["primary", "alternate", "broad"] as const) {
    if (pool.size >= input.filters.quantity) break;
    try {
      const items = await deps.discoverCompanies(input, variant);
      successfulSources++;
      add(items, sourceTitle);
    } catch {
      warnings.push(`Tentativa Apify (${variant}) indisponível.`);
      console.warn("[b2b-hunting] company discovery attempt failed", { variant });
    }
  }
  if (pool.size < input.filters.quantity) {
    warnings.push("Cobertura insuficiente no Apify; pesquisa complementar acionada.");
    try {
      const manusResult = await deps.researchManusCompanies(input);
      warnings.push(...manusWarnings(manusResult));
      successfulSources++;
      if (manusResult.status === "success_with_results") {
        manusFallbackUsed = true;
        add(manusCompaniesToRawItems(manusResult), "Manus · pesquisa complementar B2B");
        sourceTitle = "Apify / Manus";
      }
    } catch {
      warnings.push("A pesquisa complementar do Manus ficou indisponível.");
    }
  }
  if (!successfulSources && !pool.size) throw new Error("As fontes de descoberta de empresas estão indisponíveis no momento.");
  const candidates = [...pool.values()];
  const toEnrich = candidates.filter(company => !company.employeeRange && company.linkedinUrl).slice(0, Math.min(30, input.filters.quantity * 2));
  if (toEnrich.length) {
    try {
      const details = normalizeCompanies(await deps.researchCompanies(toEnrich.map(company => company.linkedinUrl!)), "Detalhes corporativos");
      for (const candidate of candidates) {
        const detail = details.find(company => company.linkedinUrl && candidate.linkedinUrl && company.linkedinUrl.toLowerCase().replace(/\/$/, "") === candidate.linkedinUrl.toLowerCase().replace(/\/$/, ""));
        if (detail) {
          candidate.employeeRange = detail.employeeRange || candidate.employeeRange;
          candidate.domain = detail.domain || candidate.domain;
          candidate.website = detail.website || candidate.website;
          candidate.industry = detail.industry || candidate.industry;
        }
      }
    } catch {
      warnings.push("Enriquecimento de porte indisponível; empresas com porte desconhecido ficam ao final.");
    }
  }
  if (discarded) warnings.push(`${discarded} registros excluídos por localização incompatível ou não comprovada.`);
  const companies = rankCompanies(candidates, input).slice(0, input.filters.quantity);
  console.info("[b2b-hunting] company search completed", { eligible: candidates.length, returned: companies.length, discarded, knownSize: companies.filter(company => company.employeeRange).length, manusFallbackUsed });

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
        ? "O Manus complementou a pesquisa quando a cobertura do Apify foi insuficiente."
        : "A busca de empresas foi executada diretamente no Actor especializado, sem Manus no caminho crítico.",
    }],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: manusFallbackUsed ? "Pesquisa progressiva Apify com complemento Manus." : "Apify direto como fonte principal; Manus não foi necessário.",
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
  let primaryItems: HuntingPerson[] = [];
  let fallbackItems: unknown[] = [];
  let companyItems: unknown[] = [];
  let primaryFailed = false;
  let fallbackFailed = false;
  let fallbackUsed = false;
  let manusUsed = false;
  let primarySource = "Funcionários públicos via Harvest";
  let collection: CollectionSummary | undefined;

  try {
    companyItems = await deps.researchCompanies(input.filters.companyLinkedinUrls);
  } catch {
    warnings.push("Os detalhes corporativos não estavam disponíveis; a busca de decisores continuou com as páginas informadas.");
  }

  try {
    const collected = await collectHuntingPages({
      target: input.filters.quantity,
      timeoutMs: 90_000,
      key: (person: HuntingPerson) => person.linkedinUrl.toLowerCase().replace(/\/$/, ""),
      fetchPage: async (page) => {
        const raw = await deps.discoverHarvestPeople(expandedInput, page);
        const normalized = normalizePeople(raw, primarySource, input.filters.desiredDecisionRole);
        if (raw.length && !normalized.length) throw new Error("Formato de perfis não reconhecido.");
        return { items: normalized.filter((person) => matchesPeopleGeo(person.location, input.filters.locations)), exhausted: raw.length === 0 };
      },
    });
    primaryItems = collected.items;
    collection = collected.summary;
  } catch {
    primaryFailed = true;
    warnings.push("O Actor principal de funcionários não respondeu; a segunda fonte foi acionada automaticamente.");
  }

  if (primaryItems.length < input.filters.quantity || input.filters.includeBroadDiscovery) {
    try {
      fallbackItems = await deps.discoverBroadPeople(expandedInput);
      fallbackUsed = fallbackItems.length > 0;
      if (fallbackUsed) warnings.push("A busca complementar consultou funcionários das empresas informadas sem restringir cargo ou localização. Os resultados fora da localização específica serão excluídos.");
      if (!primaryItems.length && fallbackUsed) warnings.push("A segunda fonte de funcionários assumiu a descoberta porque a principal não trouxe cobertura.");
    } catch {
      fallbackFailed = true;
      if (!primaryItems.length) warnings.push("A segunda fonte de funcionários também não respondeu.");
      else warnings.push("A descoberta complementar também está indisponível; os resultados da fonte principal foram preservados.");
    }
  }

  if (!primaryItems.length && !fallbackItems.length && primaryFailed && fallbackFailed) {
    warnings.push("Os dois Actors diretos falharam; o Manus foi acionado como último fallback.");
    try {
      const manusResult = await deps.researchManusPeople(expandedInput, { timeoutMs: 30_000 });
      warnings.push(...manusWarnings(manusResult));
      if (manusResult.status === "success_with_results") {
        primarySource = "Manus · fallback de pesquisa de decisores";
        primaryItems = normalizePeople(manusPeopleToRawItems(manusResult), primarySource, input.filters.desiredDecisionRole);
        manusUsed = primaryItems.length > 0;
      }
    } catch {
      warnings.push("O fallback do Manus também ficou indisponível.");
    }
    if (!primaryItems.length) throw new Error("As fontes de descoberta de pessoas estão indisponíveis no momento.");
  }

  const primaryPeople = primaryItems;
  const fallbackPeople = normalizePeople(fallbackItems, "Descoberta complementar via Apify", input.filters.desiredDecisionRole);
  if ((primaryItems.length > 0 && primaryPeople.length === 0) || (fallbackItems.length > 0 && fallbackPeople.length === 0 && primaryPeople.length === 0)) {
    throw new Error("A fonte retornou perfis, mas o formato recebido não pôde ser normalizado com segurança.");
  }

  const researchedCompanies = normalizeCompanies(companyItems, "Páginas corporativas públicas");
  const companyKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const employerSizes = new Map(researchedCompanies.map(company => [companyKey(company.name), company.employeeRange]));
  const sortByEmployer = (items: HuntingPerson[]) => items.sort((a,b) => employeeSize(b.companyEmployeeRange) - employeeSize(a.companyEmployeeRange) || b.fitScore - a.fitScore);
  const merged = mergePeople(primaryPeople, fallbackPeople).map(person => ({ ...person, companyEmployeeRange: employerSizes.get(companyKey(person.company)) || person.companyEmployeeRange }));
  const eligible = merged.filter((person) => matchesPeopleGeo(person.location, input.filters.locations));
  if (eligible.length < merged.length) warnings.push(`${merged.length - eligible.length} perfis excluídos por localização incompatível ou não comprovada.`);
  let people: HuntingPerson[] = sortByEmployer(rankPeople(eligible, expandedInput)).slice(0, input.filters.quantity);
  if (collection) {
    collection = { ...collection, unique: people.length, stopReason: people.length >= input.filters.quantity ? "target_reached" : collection.stopReason };
    warnings.push(collectionMessage(collection));
  }
  console.info("[b2b-hunting] collection completed", { requested: input.filters.quantity, primary: primaryPeople.length, complementary: fallbackPeople.length, unique: people.length, requests: collection?.requests ?? 0 });
  if (people.some((person) => person.title === "Cargo não informado")) warnings.push("Alguns perfis não informam cargo atual; valide as responsabilidades antes de considerar aderência.");

  const profileResults = await Promise.all(people.slice(0, manusUsed ? 0 : 5).map(async (person) => {
    try {
      const profileItems = await deps.enrichPersonProfile(person.linkedinUrl);
      return applyProfileEvidence(person, profileItems) ? 1 : 0;
    } catch {
      warnings.push(`O perfil de ${person.name} não pôde ser enriquecido; o resultado confirmado da descoberta foi mantido.`);
      return 0;
    }
  }));
  const profileEnrichments = profileResults.reduce<number>((total, current) => total + current, 0);

  const postResults = await Promise.all(people.slice(0, manusUsed ? 0 : 3).map(async (person) => {
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

  people = rankPeople(people.filter((person) => matchesPeopleGeo(person.location, input.filters.locations)), expandedInput);

  let aiNextAction: DecisionMakerResult["nextBestAction"] | null = null;
  if (people.length && !manusUsed) {
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

  people = sortByEmployer(people);
  const missingRoles = targetRolesNotFound(input.filters.roles, people);
  const companies = researchedCompanies.length ? researchedCompanies : companiesFromPeople(people);
  const discoveryTitle = manusUsed
    ? "Manus · fallback de decisores"
    : fallbackUsed && !primaryPeople.length
      ? "Apify · descoberta complementar"
      : fallbackUsed
        ? "Harvest + Apify complementar · funcionários públicos"
        : "Harvest · funcionários públicos";

  return {
    mode: "people",
    collection,
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
      {
        title: discoveryTitle,
        confidence: people.length ? "provável" : "não verificado",
        notes: manusUsed
          ? "Os Actors diretos falharam e o Manus foi usado somente como último fallback."
          : "A descoberta usa Actors diretos de funcionários e aceita apenas perfis com URL pública real do LinkedIn.",
      },
      { title: "Perfis públicos enriquecidos", confidence: profileEnrichments ? "confirmado" : "não verificado", notes: `${profileEnrichments} dos 5 perfis prioritários receberam evidências adicionais.` },
      { title: "Publicações profissionais recentes", confidence: postEnrichments ? "confirmado" : "não verificado", notes: `${postEnrichments} dos 3 perfis prioritários apresentaram sinais públicos recentes.` },
    ],
    warnings: [...new Set(warnings)],
    cost: {
      strategy: manusUsed
        ? "Actors diretos indisponíveis; Manus usado como último fallback."
        : fallbackUsed
          ? "Actor principal direto com segunda fonte usada para cobertura; enriquecimento limitado aos perfis prioritários."
          : "Actor principal direto; sem Manus na descoberta e enriquecimento limitado aos perfis prioritários.",
      basicCandidates: people.length,
      profileEnrichments,
      postEnrichments,
      broadDiscoveryUsed: fallbackUsed,
    },
  };
}

function applyProfileEvidence(person: HuntingPerson, items: unknown[]) {
  const record = items.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (!record) return false;
  const detail = normalizePeople([record], person.source, person.probableDecisionRole).find((item) => item.linkedinUrl === person.linkedinUrl);
  if (detail && person.title === "Cargo não informado" && detail.title !== "Cargo não informado") person.title = detail.title;
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
