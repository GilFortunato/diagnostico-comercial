import "server-only";
import { isRealLinkedInCompanyUrl, isRealLinkedInPersonUrl } from "@/lib/connectors/manusCore";
import { runManusStructuredTask, type ManusTaskResult } from "@/lib/connectors/manusClient";
import type { CompanySearchInput, PersonSearchInput } from "@/lib/decision-makers/search";
import type { HrHuntingSearchSnapshot, JobDna } from "@/lib/hr-hunting/types";

type Evidence = { source: string; url: string; claim: string };
type ManusPerson = {
  name: string;
  currentTitle: string;
  company: string;
  location: string;
  linkedinUrl: string;
  professionalEmail: string;
  professionalPhone: string;
  professionalSummary: string;
  confidence: "confirmed" | "probable" | "unverified";
  evidence: Evidence[];
};
type ManusCompany = {
  name: string;
  website: string;
  domain: string;
  linkedinUrl: string;
  industry: string;
  location: string;
  employeeRange: string;
  revenueRange: string;
  description: string;
  confidence: "confirmed" | "probable" | "unverified";
  evidence: Evidence[];
};
type PeoplePayload = { people: ManusPerson[]; queriesAttempted: string[]; sourcesUsed: string[]; limitations: string[] };
type CompanyPayload = { companies: ManusCompany[]; queriesAttempted: string[]; sourcesUsed: string[]; limitations: string[] };
type HrSearchInput = { quantity: number; currentTitle?: string; seniority: string[]; location?: string; keywords: string[] };

export async function researchB2bCompaniesWithManus(input: CompanySearchInput) {
  const prompt = [
    "Você é o agente de pesquisa B2B da Share AI. Pesquise empresas reais e verificáveis para os filtros abaixo.",
    "Use o conector Apify quando estiver disponível como fonte estruturada prioritária e complemente apenas com fontes públicas verificáveis.",
    "Faça no máximo uma tentativa principal e uma expansão controlada de termos. Não execute exploração ilimitada.",
    "Nunca invente empresa, URL, receita, porte, tecnologia ou evidência. Quando um dado não estiver sustentado, retorne string vazia.",
    "Receita estimada só pode aparecer identificada como estimativa e sustentada por fonte. Preserve URLs reais das evidências.",
    `Objetivo comercial: ${input.objective}`,
    `Setores: ${input.filters.industries.join(", ") || "não especificados"}`,
    `País: ${input.filters.country}`,
    `Estados/regiões: ${input.filters.states.join(", ") || "não especificados"}`,
    `Cidades/CEPs: ${input.filters.cityPostalCodes.join(", ") || "não especificados"}`,
    `Porte: ${input.filters.employeeRanges.join(", ") || "não especificado"}`,
    `Palavras-chave: ${input.filters.keywords.join(", ") || "não especificadas"}`,
    `Tecnologias: ${input.filters.technologies.join(", ") || "não especificadas"}`,
    `Domínios: ${input.filters.domains.join(", ") || "não especificados"}`,
    `Quantidade máxima: ${input.filters.quantity}`,
    "Se não houver empresas verificáveis, retorne companies vazio e explique a limitação. Falha de fonte não deve ser descrita como ausência de mercado.",
  ].join("\n");

  return runManusStructuredTask<CompanyPayload>({
    prompt,
    schema: companyPayloadSchema,
    title: "Share AI · B2B Hunting · Empresas",
    countResults: (value) => value.companies.length,
  });
}

export async function researchB2bPeopleWithManus(input: PersonSearchInput) {
  const discoveryMax = Math.min(50, Math.max(25, input.filters.quantity * 2));
  const fuzzyTerms = uniqueStrings([...input.filters.roles, ...input.filters.profileKeywords]).slice(0, 8);
  const fuzzyQuery = fuzzyTerms.join(" OR ");
  const companyUrls = input.filters.companyLinkedinUrls.join(", ");

  const prompt = [
    "Você é o agente de pesquisa de decisores B2B da Share AI. Encontre somente pessoas reais e atualmente ou recentemente associadas às empresas informadas.",
    "Use OBRIGATORIAMENTE o conector Apify desta tarefa como fonte estruturada principal. Não pule para busca web antes de consultar o Apify.",
    "PASSO 1 — use o Actor `harvestapi/linkedin-company-employees` (LinkedIn Company Employees Scraper). Se precisar localizá-lo, use search-actors/fetch-actor-details; depois execute call-actor e leia get-actor-output.",
    `No PASSO 1 use as empresas exatamente como recebidas: ${companyUrls || "nenhuma URL informada"}.`,
    `Input esperado do PASSO 1: companies=[URLs acima], profileScraperMode="Short ($4 per 1k)", maxItems=${discoveryMax}${fuzzyQuery ? `, searchQuery="${fuzzyQuery}"` : ""}.`,
    "No PASSO 1 NÃO empilhe filtros exatos de jobTitles, locations e seniorityLevelIds. Primeiro maximize recall dentro da empresa; depois avalie cargo, senioridade, localização e aderência sobre os perfis retornados.",
    'PASSO 2 — somente se o primeiro Actor não trouxer cobertura suficiente, faça UMA expansão controlada com `harvestapi/linkedin-profile-search`, mantendo currentCompanies preso às mesmas URLs, profileScraperMode="Short", maxItems no mesmo limite e uma busca textual equivalente. Não faça uma terceira rodada.',
    "Se o Apify retornar perfis reais da empresa que não correspondem perfeitamente ao título, mantenha-os apenas se forem profissionalmente próximos aos cargos-alvo; a Share AI fará o ranking final.",
    "REGRA ABSOLUTA: só inclua uma pessoa se nome, vínculo profissional e uma URL REAL de perfil LinkedIn /in/ forem sustentados por fonte. Nunca fabrique URL, slug, e-mail ou telefone.",
    "E-mail e telefone só podem ser retornados quando a própria fonte fornecer explicitamente um contato profissional. Caso contrário use string vazia.",
    "Não use nem infira atributos pessoais ou protegidos. Preserve evidências e URLs. Se não conseguir confirmar uma pessoa, não a inclua.",
    `Objetivo comercial: ${input.objective}`,
    `Empresas: ${input.filters.companyNames.join(", ") || "ver URLs"}`,
    `LinkedIn das empresas: ${companyUrls}`,
    `Cargos/famílias: ${input.filters.roles.join(", ")}`,
    `Departamentos: ${input.filters.departments.join(", ") || "não especificados"}`,
    `Senioridade desejada para RANKING, não para bloquear a coleta inicial: ${input.filters.seniority.join(", ") || "não especificada"}`,
    `Localizações desejadas para RANKING, não para bloquear a coleta inicial: ${input.filters.locations.join(", ") || "não especificadas"}`,
    `Palavras-chave profissionais: ${input.filters.profileKeywords.join(", ") || "não especificadas"}`,
    `Quantidade final máxima: ${input.filters.quantity}`,
    "Em queriesAttempted registre os Actors/consultas efetivamente usados. Em sourcesUsed registre Apify/Actor e outras fontes realmente consultadas.",
    "Se nenhuma pessoa puder ser confirmada, retorne people vazio e explique em limitations se o Actor retornou zero, se houve timeout/erro ou se perfis foram descartados por falta de evidência. Não transforme falha de ferramenta em ausência de profissionais.",
  ].join("\n");

  return runManusStructuredTask<PeoplePayload>({
    prompt,
    schema: peoplePayloadSchema,
    title: "Share AI · B2B Hunting · Pessoas",
    countResults: (value) => value.people.length,
  });
}

export async function researchHrCandidatesWithManus(search: Pick<HrHuntingSearchSnapshot, "title" | "companyName" | "jobDescription" | "jobDna">, input: HrSearchInput) {
  const dna = search.jobDna;
  const targetTitle = input.currentTitle?.trim() || dna.title || search.title;
  const targetLocation = input.location?.trim() || dna.location || "";
  const discoveryMax = Math.min(50, Math.max(25, input.quantity * 2));
  const searchTerms = uniqueStrings([targetTitle, ...input.keywords]).slice(0, 8);
  const prompt = [
    "Você é o agente de sourcing profissional do HR Hunting da Share AI. Localize profissionais reais para uma vaga; você NÃO decide contratação.",
    "Use OBRIGATORIAMENTE o conector Apify desta tarefa. Nesta execução NÃO use browser, pesquisa Google, redirecionadores ou navegação manual para tentar descobrir LinkedIn.",
    "PASSO 1 — use diretamente o Actor `harvestapi/linkedin-profile-search`. Se precisar localizar a ferramenta, use apenas search-actors/fetch-actor-details, depois call-actor e get-actor-output.",
    `Input do PASSO 1: profileScraperMode="Short", maxItems=${discoveryMax}, takePages=2, searchQuery="${searchTerms.join(" OR ")}"${targetLocation ? `, locations=["${targetLocation}"]` : ""}.`,
    "Não empilhe filtros exatos de currentJobTitles e seniorityLevelIds nesta primeira coleta. Título, skills, senioridade e localização serão avaliados depois sobre os perfis retornados.",
    "Use diretamente o campo linkedinUrl entregue pelo Actor. Não tente resolver URLs por Google ou browser.",
    "PASSO 2 — somente se o PASSO 1 retornar zero perfis úteis, faça UMA segunda execução do mesmo Actor com uma expansão semântica curta do título, mantendo maxItems e takePages. Não faça terceira rodada e não use outras ferramentas de navegação.",
    "REGRA ABSOLUTA: inclua somente pessoas reais com nome e URL REAL de LinkedIn /in/ sustentados pelo output do Actor. Cargo, empresa ou localização ausentes devem ser string vazia, nunca inventados.",
    "E-mail/telefone só quando a fonte retornar explicitamente contato profissional; caso contrário string vazia. Ausência de evidência significa não verificado, nunca 'não possui'.",
    "Não pesquisar, inferir, retornar ou usar em avaliação: idade, gênero, raça, etnia, religião, deficiência, orientação sexual, identidade de gênero, estado civil, gravidez, foto, opinião política ou outros atributos protegidos/pessoais.",
    `Vaga: ${search.title}`,
    `Empresa: ${search.companyName || "não informada"}`,
    `Resumo profissional: ${dna.shortSummary}`,
    `Título-alvo para aderência: ${targetTitle}`,
    `Senioridade desejada para aderência: ${input.seniority.join(", ") || dna.seniority || "não especificada"}`,
    `Localização desejada para aderência: ${targetLocation || "não especificada"}`,
    `Palavras-chave profissionais: ${input.keywords.join(", ") || "não especificadas"}`,
    `Critérios profissionais da vaga: ${formatCriteria(dna)}`,
    `Quantidade final máxima: ${input.quantity}`,
    "Em queriesAttempted registre o Actor e os inputs de busca efetivamente usados. Em limitations informe zero real, erro ou ausência de campos sem transformar isso em reprovação do candidato.",
  ].join("\n");

  return runManusStructuredTask<PeoplePayload>({
    prompt,
    schema: peoplePayloadSchema,
    title: "Share AI · HR Hunting · Candidatos",
    countResults: (value) => value.people.length,
  });
}

export function manusPeopleToRawItems(result: ManusTaskResult<PeoplePayload>) {
  if (!result.value) return [];
  return result.value.people.flatMap((person) => {
    if (!person.name.trim() || !isRealLinkedInPersonUrl(person.linkedinUrl)) return [];
    return [{
      fullName: person.name.trim(),
      jobTitle: person.currentTitle.trim(),
      companyName: person.company.trim(),
      location: person.location.trim(),
      linkedinUrl: person.linkedinUrl.trim(),
      professionalEmail: person.professionalEmail.trim(),
      professionalPhone: person.professionalPhone.trim(),
      summary: person.professionalSummary.trim(),
      sourceName: result.apifyConnectorUsed ? "Manus + Apify" : "Manus · pesquisa pública",
      _manusEvidence: person.evidence,
      _manusConfidence: person.confidence,
    }];
  });
}

export function manusCompaniesToRawItems(result: ManusTaskResult<CompanyPayload>) {
  if (!result.value) return [];
  return result.value.companies.flatMap((company) => {
    const hasEvidence = company.evidence.some((item) => /^https?:\/\//i.test(item.url));
    if (!company.name.trim() || (!hasEvidence && !company.website.trim() && !isRealLinkedInCompanyUrl(company.linkedinUrl))) return [];
    return [{
      name: company.name.trim(),
      website: company.website.trim(),
      domain: company.domain.trim(),
      linkedinUrl: isRealLinkedInCompanyUrl(company.linkedinUrl) ? company.linkedinUrl.trim() : "",
      industry: company.industry.trim(),
      location: company.location.trim(),
      employeeRange: company.employeeRange.trim(),
      revenueRange: company.revenueRange.trim(),
      description: company.description.trim(),
      sourceName: result.apifyConnectorUsed ? "Manus + Apify" : "Manus · pesquisa pública",
      _manusEvidence: company.evidence,
      _manusConfidence: company.confidence,
    }];
  });
}

export function manusWarnings(result: ManusTaskResult<unknown>) {
  const limitations = isPeoplePayload(result.value) || isCompanyPayload(result.value) ? result.value.limitations : [];
  const provider = result.apifyConnectorUsed ? "Manus utilizou o conector Apify nesta pesquisa." : "Manus executou sem o conector Apify autorizado.";
  const credits = result.creditUsage == null ? [] : [`Consumo Manus desta tarefa: ${result.creditUsage} créditos.`];
  return [...result.warnings, provider, ...limitations, ...credits];
}

function formatCriteria(dna: JobDna) {
  return dna.criteria
    .filter((criterion) => criterion.kind !== "não relevante")
    .slice(0, 16)
    .map((criterion) => `${criterion.kind}: ${criterion.label}`)
    .join(" | ") || "não especificados";
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function isPeoplePayload(value: unknown): value is PeoplePayload {
  return Boolean(value && typeof value === "object" && Array.isArray((value as PeoplePayload).people) && Array.isArray((value as PeoplePayload).limitations));
}

function isCompanyPayload(value: unknown): value is CompanyPayload {
  return Boolean(value && typeof value === "object" && Array.isArray((value as CompanyPayload).companies) && Array.isArray((value as CompanyPayload).limitations));
}

const evidenceSchema = {
  type: "object",
  properties: {
    source: { type: "string" },
    url: { type: "string" },
    claim: { type: "string" },
  },
  required: ["source", "url", "claim"],
  additionalProperties: false,
} as const;

const personSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    currentTitle: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    linkedinUrl: { type: "string" },
    professionalEmail: { type: "string" },
    professionalPhone: { type: "string" },
    professionalSummary: { type: "string" },
    confidence: { type: "string", enum: ["confirmed", "probable", "unverified"] },
    evidence: { type: "array", items: evidenceSchema },
  },
  required: ["name", "currentTitle", "company", "location", "linkedinUrl", "professionalEmail", "professionalPhone", "professionalSummary", "confidence", "evidence"],
  additionalProperties: false,
} as const;

const companySchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    website: { type: "string" },
    domain: { type: "string" },
    linkedinUrl: { type: "string" },
    industry: { type: "string" },
    location: { type: "string" },
    employeeRange: { type: "string" },
    revenueRange: { type: "string" },
    description: { type: "string" },
    confidence: { type: "string", enum: ["confirmed", "probable", "unverified"] },
    evidence: { type: "array", items: evidenceSchema },
  },
  required: ["name", "website", "domain", "linkedinUrl", "industry", "location", "employeeRange", "revenueRange", "description", "confidence", "evidence"],
  additionalProperties: false,
} as const;

const peoplePayloadSchema = {
  type: "object",
  properties: {
    people: { type: "array", items: personSchema },
    queriesAttempted: { type: "array", items: { type: "string" } },
    sourcesUsed: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
  },
  required: ["people", "queriesAttempted", "sourcesUsed", "limitations"],
  additionalProperties: false,
} as const;

const companyPayloadSchema = {
  type: "object",
  properties: {
    companies: { type: "array", items: companySchema },
    queriesAttempted: { type: "array", items: { type: "string" } },
    sourcesUsed: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
  },
  required: ["companies", "queriesAttempted", "sourcesUsed", "limitations"],
  additionalProperties: false,
} as const;
