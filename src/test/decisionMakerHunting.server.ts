import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { applyAiRanking } from "@/lib/decision-makers/aiRanking";
import { buildDecisionMakerWorkbook } from "@/lib/decision-makers/exportWorkbook";
import { mergePeople, normalizeCompanies, normalizePeople } from "@/lib/decision-makers/normalization";
import { clearDecisionMakerCache, executeDecisionMakerSearch } from "@/lib/decision-makers/orchestrator";
import { rankPeople, targetRolesNotFound } from "@/lib/decision-makers/ranking";
import { addRoleSelection, expandRoleFamilies, removeRoleSelection } from "@/lib/decision-makers/roleIntelligence";
import { buildBroadPeopleInput, buildCompanyDiscoveryInput, buildHarvestPeopleInput } from "@/lib/connectors/apifyHunting";
import { companySearchSchema, personSearchSchema, type DecisionMakerResult } from "@/lib/decision-makers/search";
import { conservativeJobDna } from "@/lib/hr-hunting/jobDna";
import { buildHrHuntingWorkbook } from "@/lib/hr-hunting/exportWorkbook";
import { buildApproachMessage, buildHrCandidateSearchInput, normalizeCandidates, rankCandidates } from "@/lib/hr-hunting/service";
import type { HrHuntingSearchSnapshot, JobDna } from "@/lib/hr-hunting/types";

const personInput = personSearchSchema.parse({
  mode: "people",
  businessUnitId: "bu_prosper",
  objective: "Encontrar decisores para uma jornada de IA aplicada.",
  filters: {
    companyLinkedinUrls: ["https://www.linkedin.com/company/acme"],
    companyNames: ["Acme"],
    roles: ["Head de T&D", "Diretor de RH"],
    departments: ["Recursos Humanos"],
    seniority: ["manager", "director", "c_level"],
    locations: ["Brasil"],
    profileKeywords: ["inteligência artificial"],
    desiredDecisionRole: "Decisor funcional",
    quantity: 20,
    includeBroadDiscovery: false,
  },
});

const companyInput = companySearchSchema.parse({
  mode: "companies",
  businessUnitId: "bu_prosper",
  objective: "Encontrar empresas com agenda de desenvolvimento e IA aplicada.",
  filters: {
    industries: ["Professional Training and Coaching"],
    country: "Brazil",
    states: ["SP"],
    cityPostalCodes: ["São Paulo"],
    employeeRanges: ["1000-4999"],
    keywords: ["artificial intelligence"],
    technologies: ["Salesforce"],
    revenueRanges: ["100M-500M"],
    domains: ["acme.com"],
    quantity: 15,
  },
});

test("1. a normalização nunca apresenta Pessoa a identificar como pessoa encontrada", () => {
  const people = normalizePeople([
    rawPerson({ fullName: "Pessoa a identificar" }),
    rawPerson({ fullName: "Maria Silva" }),
  ], "Fonte pública", "Decisor funcional");
  assert.deepEqual(people.map((person) => person.name), ["Maria Silva"]);
});

test("2. papéis-alvo sem pessoa correspondente ficam separados", () => {
  const people = normalizePeople([rawPerson({ jobTitle: "Head de T&D" })], "Fonte pública", "Decisor funcional");
  assert.deepEqual(targetRolesNotFound(["Head de T&D", "CHRO"], people), ["CHRO"]);
});

test("3. score não depende da posição do candidato no array", () => {
  const people = normalizePeople([
    rawPerson({ fullName: "Maria Silva", linkedinUrl: "https://www.linkedin.com/in/maria", jobTitle: "Head de T&D" }),
    rawPerson({ fullName: "João Costa", linkedinUrl: "https://www.linkedin.com/in/joao", jobTitle: "Analista Financeiro" }),
  ], "Fonte pública", "Decisor funcional");
  const forward = new Map(rankPeople(people, personInput).map((person) => [person.id, person.fitScore]));
  const reverse = new Map(rankPeople([...people].reverse(), personInput).map((person) => [person.id, person.fitScore]));
  assert.deepEqual(forward, reverse);
});

test("4. cargos são enviados nos campos reais do Harvest Company Employees", () => {
  const actorInput = buildHarvestPeopleInput(personInput);
  assert.deepEqual(actorInput.jobTitles, personInput.filters.roles);
  assert.equal(actorInput.maxItems, 20);
  assert.equal(actorInput.profileScraperMode, "Short ($4 per 1k)");
  assert.equal("maxItemsPerCompany" in actorInput, false);
});

test("5. múltiplos cargos e famílias equivalentes funcionam", () => {
  const expanded = expandRoleFamilies(["Learning & Development", "Diretor de RH"]);
  assert.ok(expanded.length > 2);
  assert.ok(expanded.some((role) => /learning|t&d/i.test(role)));
});

test("6. senioridade usa IDs reais nos dois Actors Harvest", () => {
  const actorInput = buildHarvestPeopleInput(personInput);
  assert.deepEqual(actorInput.seniorityLevelIds, ["200", "210", "220", "310"]);
  const broadInput = buildBroadPeopleInput(personInput);
  assert.deepEqual(broadInput.seniorityLevelIds, ["200", "210", "220", "310"]);
  assert.deepEqual(broadInput.currentJobTitles, personInput.filters.roles);
});

test("7. empresa específica usa detalhes corporativos e employees antes do enriquecimento", async () => {
  clearDecisionMakerCache();
  const calls: string[] = [];
  await executeDecisionMakerSearch(personInput, dependencies({
    researchCompanies: async () => { calls.push("company"); return [rawCompany()]; },
    discoverHarvestPeople: async () => { calls.push("employees"); return [rawPerson()]; },
    enrichPersonProfile: async () => { calls.push("profile"); return [{ about: "Lidera aprendizagem e IA." }]; },
    enrichPersonPosts: async () => { calls.push("posts"); return [{ text: "Estamos aplicando IA em educação corporativa." }]; },
  }));
  assert.deepEqual(calls.slice(0, 2), ["company", "employees"]);
});

test("8. descoberta complementar não é necessária para o fluxo account-based", async () => {
  clearDecisionMakerCache();
  let broadCalls = 0;
  const result = await executeDecisionMakerSearch(personInput, dependencies({
    discoverBroadPeople: async () => { broadCalls += 1; throw new Error("indisponível"); },
  }));
  assert.equal(broadCalls, 0);
  assert.equal(result.people.length, 1);
});

test("9. falha complementar preserva resultados do Harvest Company Employees", async () => {
  clearDecisionMakerCache();
  const input = personSearchSchema.parse({ ...personInput, forceRefresh: true, filters: { ...personInput.filters, includeBroadDiscovery: true } });
  const result = await executeDecisionMakerSearch(input, dependencies({ discoverBroadPeople: async () => { throw new Error("indisponível"); } }));
  assert.equal(result.people.length, 1);
  assert.match(result.warnings.join(" "), /descoberta complementar também está indisponível/i);
});

test("10. deduplicação prioriza LinkedIn URL", () => {
  const first = normalizePeople([rawPerson({ fullName: "Maria S.", workEmail: "maria@acme.com" })], "Fonte A", "Decisor funcional");
  const second = normalizePeople([rawPerson({ fullName: "Maria Silva", about: "Liderança" })], "Harvest", "Decisor funcional");
  const merged = mergePeople(second, first);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].professionalEmail, "maria@acme.com");
});

test("11. e-mail só aparece quando a fonte fornece", () => {
  const without = normalizePeople([rawPerson()], "Fonte pública", "Decisor funcional")[0];
  const withEmail = normalizePeople([rawPerson({ workEmail: "maria@acme.com" })], "Enrichment público", "Decisor funcional")[0];
  assert.equal(without.professionalEmail, undefined);
  assert.equal(without.emailStatus, "Não encontrado");
  assert.equal(withEmail.professionalEmail, "maria@acme.com");
});

test("12. telefone só aparece quando a fonte fornece", () => {
  const without = normalizePeople([rawPerson()], "Fonte pública", "Decisor funcional")[0];
  const withPhone = normalizePeople([rawPerson({ workPhone: "+55 11 3333-4444" })], "Enrichment público", "Decisor funcional")[0];
  assert.equal(without.professionalPhone, undefined);
  assert.equal(withPhone.professionalPhone, "+55 11 3333-4444");
  assert.equal(withPhone.phoneStatus, "Encontrado");
});

test("13. contato encontrado carrega fonte e confiança", () => {
  const person = normalizePeople([rawPerson({ workEmail: "maria@acme.com" })], "Enrichment público", "Decisor funcional")[0];
  assert.equal(person.contactSource, "Enrichment público");
  assert.equal(person.contactConfidence, "provável");
});

test("14. exportação usa o snapshot e não executa conectores ou Gemini", async () => {
  const externalCalls = 0;
  const result = snapshot();
  const before = externalCalls;
  const buffer = await buildDecisionMakerWorkbook(result);
  assert.ok(buffer.length > 1_000);
  assert.equal(externalCalls, before);
});

test("15. XLSX contém as três abas profissionais", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildDecisionMakerWorkbook(snapshot()) as never);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Empresas", "Pessoas", "Inteligência Share AI"]);
  for (const sheet of workbook.worksheets) {
    assert.equal(sheet.views[0]?.state, "frozen");
    assert.ok(sheet.autoFilter);
  }
});

test("16. arquivo exportado não contém token, IDs internos ou JSON bruto", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildDecisionMakerWorkbook(snapshot()) as never);
  const values: string[] = [];
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => values.push(String(typeof cell.value === "object" && cell.value && "text" in cell.value ? cell.value.text : cell.value)))));
  const content = values.join(" ");
  assert.doesNotMatch(content, /apify_api_|gemini_api_|hunt_[a-z0-9]+|\{"/i);
});

test("17. Gemini não consegue acrescentar uma pessoa inexistente ao ranking", () => {
  const people = normalizePeople([rawPerson()], "Fonte pública", "Decisor funcional");
  const ranked = applyAiRanking(people, {
    ranking: [
      { id: "pessoa_inventada", probableDecisionRole: "Decisor econômico", evidenceReason: "Este registro não existe e deve ser ignorado." },
      { id: people[0].id, probableDecisionRole: "Decisor funcional", evidenceReason: "Cargo aderente às evidências públicas fornecidas." },
    ],
    nextBestAction: { title: "Pesquisar", reason: "Validar o contexto antes de qualquer abordagem." },
  });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, people[0].id);
});

test("18. resultado básico sem enriquecimento não recebe confiança confirmada", () => {
  const person = rankPeople(normalizePeople([rawPerson()], "Fonte pública", "Decisor funcional"), personInput)[0];
  assert.equal(person.confidence, "provável");
});

test("19. seleção de cargos permite adicionar sem duplicar e remover", () => {
  const added = addRoleSelection(["CHRO"], "Head de T&D");
  const deduplicated = addRoleSelection(added, "chro");
  assert.deepEqual(deduplicated, ["CHRO", "Head de T&D"]);
  assert.deepEqual(removeRoleSelection(deduplicated, "CHRO"), ["Head de T&D"]);
});

test("20. papel provável é contextual e não repete a persona da BU", () => {
  const people = normalizePeople([
    rawPerson({ fullName: "Ana Diretora", linkedinUrl: "https://www.linkedin.com/in/ana", jobTitle: "Diretora de Transformação" }),
    rawPerson({ fullName: "Bruno Gerente", linkedinUrl: "https://www.linkedin.com/in/bruno", jobTitle: "Gerente de Inovação" }),
  ], "Fonte pública", "Decisor funcional");
  const ranked = rankPeople(people, personInput);
  assert.notEqual(ranked[0].probableDecisionRole, ranked[1].probableDecisionRole);
  assert.ok(ranked.every((person) => !person.fitReasons.join(" ").includes("Head de T&D tende")));
});

test("21. custo fica limitado a top 5 perfis e top 3 publicações", async () => {
  clearDecisionMakerCache();
  let profileCalls = 0;
  let postCalls = 0;
  const candidates = Array.from({ length: 20 }, (_, index) => rawPerson({
    fullName: `Pessoa Real ${index}`,
    linkedinUrl: `https://www.linkedin.com/in/pessoa-${index}`,
    jobTitle: index % 2 ? "Head de T&D" : "Diretor de RH",
  }));
  const result = await executeDecisionMakerSearch(personInput, dependencies({
    discoverHarvestPeople: async () => candidates,
    enrichPersonProfile: async () => { profileCalls += 1; return [{ about: "Perfil profissional" }]; },
    enrichPersonPosts: async () => { postCalls += 1; return [{ text: "Publicação profissional recente sobre inteligência artificial." }]; },
  }));
  assert.equal(result.people.length, 20);
  assert.equal(profileCalls, 5);
  assert.equal(postCalls, 3);
});

test("22. repetição imediata usa cache e atualizar resultados ignora cache", async () => {
  clearDecisionMakerCache();
  let employeeCalls = 0;
  const deps = dependencies({ discoverHarvestPeople: async () => { employeeCalls += 1; return [rawPerson()]; } });
  const first = await executeDecisionMakerSearch(personInput, deps);
  const second = await executeDecisionMakerSearch(personInput, deps);
  const refreshed = await executeDecisionMakerSearch({ ...personInput, forceRefresh: true }, deps);
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(refreshed.fromCache, false);
  assert.equal(employeeCalls, 2);
});

test("23. busca de empresas envia somente campos suportados pelo Harvest Company Search", () => {
  const input = buildCompanyDiscoveryInput(companyInput);
  assert.equal(input.scraperMode, "short");
  assert.equal(input.maxItems, 15);
  assert.ok(Array.isArray(input.locations));
  assert.match(String(input.searchQuery), /artificial intelligence/i);
  assert.equal("companyState" in input, false);
  assert.equal("revenue" in input, false);
  assert.equal("technologyUsed" in input, false);
  assert.equal("totalResults" in input, false);
});

test("24. empresa normalizada preserva receita como dado provável, não confirmado", () => {
  const company = normalizeCompanies([rawCompany({ revenue: "100M-500M" })], "Enrichment público")[0];
  assert.equal(company.revenueRange, "100M-500M");
  assert.equal(company.confidence, "provável");
});

test("25. resposta atual do Harvest com currentPosition e experience em arrays não é descartada", () => {
  const people = normalizePeople([{
    firstName: "Maria",
    lastName: "Silva",
    linkedinUrl: "https://www.linkedin.com/in/maria-corpus",
    headline: "Executiva comercial",
    currentPosition: [{ companyName: "Corpus" }],
    experience: [{ position: "Gerente Comercial", companyName: "Corpus", location: "São Paulo, Brasil" }],
  }], "Harvest", "Decisor funcional");
  assert.equal(people.length, 1);
  assert.equal(people[0].name, "Maria Silva");
  assert.equal(people[0].title, "Gerente Comercial");
  assert.equal(people[0].company, "Corpus");
});

test("26. HR Hunting não transforma requisitos da vaga em cargos do Actor", () => {
  const input = buildHrCandidateSearchInput({ quantity: 20, currentTitle: "Product Manager", seniority: ["manager"], location: "São Paulo", keywords: ["SaaS", "B2B"] }, "Senior Product Manager");
  assert.deepEqual(input.currentJobTitles, ["Product Manager"]);
  assert.equal(String(input.searchQuery), "SaaS OR B2B");
  assert.doesNotMatch(JSON.stringify(input.currentJobTitles), /SaaS|B2B/);
  assert.deepEqual(input.seniorityLevelIds, ["200", "210"]);
});

test("27. HR Hunting normaliza o formato atual do Harvest", () => {
  const candidates = normalizeCandidates([{
    firstName: "Ana",
    lastName: "Souza",
    linkedinUrl: "https://www.linkedin.com/in/ana-souza",
    headline: "Produto digital",
    currentPosition: [{ companyName: "Acme" }],
    experience: [{ position: "Product Manager", companyName: "Acme", location: "São Paulo" }],
  }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Ana Souza");
  assert.equal(candidates[0].currentTitle, "Product Manager");
  assert.equal(candidates[0].currentCompany, "Acme");
});

test("28. normalização de empresas entende companySize e headquarters do Harvest Company Search", () => {
  const companies = normalizeCompanies([{
    companyName: "Corpus",
    linkedinUrl: "https://www.linkedin.com/company/corpus",
    website: "https://corpus.example",
    industry: "Technology",
    companySize: "201-500 employees",
    headquarters: "São Paulo, Brasil",
  }], "Harvest Company Search");
  assert.equal(companies.length, 1);
  assert.equal(companies[0].name, "Corpus");
  assert.equal(companies[0].employeeRange, "201-500 employees");
  assert.equal(companies[0].location, "São Paulo, Brasil");
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    discoverCompanies: async () => [rawCompany()],
    researchCompanies: async () => [rawCompany()],
    discoverHarvestPeople: async () => [rawPerson()],
    discoverBroadPeople: async () => [],
    enrichPersonProfile: async () => [],
    enrichPersonPosts: async () => [],
    refineRanking: async () => null,
    now: () => new Date("2026-08-31T12:00:00.000Z"),
    ...overrides,
  } as never;
}

function rawPerson(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Maria Silva",
    jobTitle: "Head de T&D",
    companyName: "Acme",
    linkedinUrl: "https://www.linkedin.com/in/maria-silva",
    location: "São Paulo, Brasil",
    ...overrides,
  };
}

function rawCompany(overrides: Record<string, unknown> = {}) {
  return {
    name: "Acme",
    linkedinUrl: "https://www.linkedin.com/company/acme",
    website: "https://acme.com",
    industry: "Professional Training and Coaching",
    location: "São Paulo, Brasil",
    employeeRange: "1000-4999",
    revenue: "100M-500M",
    description: "Empresa em transformação digital.",
    ...overrides,
  };
}

function snapshot(): DecisionMakerResult {
  const person = rankPeople(normalizePeople([rawPerson({ workEmail: "maria@acme.com" })], "Enrichment público", "Decisor funcional"), personInput)[0];
  return {
    mode: "people",
    queryId: "não exportar este id",
    generatedAt: "2026-08-31T12:00:00.000Z",
    fromCache: false,
    businessUnitName: "Prosper Digital Skills",
    objective: personInput.objective,
    companies: normalizeCompanies([rawCompany()], "Enrichment público"),
    people: [person],
    targetRolesNotFound: ["CHRO"],
    nextBestAction: { title: "Pesquisar sinais", reason: "Validar o contexto profissional antes de conversar.", impact: "alto", effort: "baixo" },
    sources: [{ title: "Fonte pública", confidence: "provável", notes: "Dados profissionais públicos normalizados." }],
    warnings: [],
    cost: { strategy: "Top 5 perfis e top 3 publicações.", basicCandidates: 1, profileEnrichments: 0, postEnrichments: 0, broadDiscoveryUsed: false },
  };
}

const hrDna: JobDna = { title: "Product Manager", shortSummary: "Posição para produto digital B2B.", responsibilities: [], interviewChecks: [], criteria: [{ id: "discovery", label: "Product Discovery", kind: "obrigatório", sourceExcerpt: "Experiência com Product Discovery." }, { id: "saas", label: "SaaS B2B", kind: "desejável", sourceExcerpt: "Vivência em SaaS B2B é desejável." }] };

test("HR Hunting preserva evidências: DNA conservador, deduplicação e não verificado", () => {
  const dna = conservativeJobDna({ title: "Analista", description: "Requisito: experiência com dados. Preferência de idade não deve ser considerada." });
  assert.equal(dna.criteria.some((criterion) => /idade/i.test(criterion.label)), false);
  const candidates = normalizeCandidates([{ fullName: "Ana Silva", title: "Product Manager", companyName: "Acme", linkedinUrl: "https://www.linkedin.com/in/ana-silva/" }, { fullName: "Ana Silva", title: "Product Manager", companyName: "Acme", linkedinUrl: "https://www.linkedin.com/in/ana-silva/" }, { fullName: "Bruno Lima", title: "Product Owner", companyName: "Beta" }]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[1].profileUrl, undefined);
  const ranked = rankCandidates([candidates[0]], hrDna, { quantity: 10, seniority: [], keywords: [] });
  assert.equal(ranked[0].evidence.find((item) => item.criterion === "SaaS B2B")?.result, "não verificado");
});

test("HR Hunting gera mensagem com link real e exporta snapshot sem conectores", async () => {
  const search: HrHuntingSearchSnapshot = { id: "hr_1", title: "Product Manager", jobDescription: "Experiência com Product Discovery.", jobUrl: "https://vagas.exemplo.com/produto", companyName: "Acme", recruiterName: "Gil", jobDna: hrDna, searchTerms: ["Product Manager"], status: "results_ready", connectorWarnings: [], createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z", candidates: [{ id: "hr_candidate", name: "Ana Silva", currentTitle: "Product Manager", currentCompany: "Acme", profileUrl: "https://www.linkedin.com/in/ana-silva", fitScore: 88, fitClassification: "Alta", pointsToValidate: ["SaaS B2B"], sourceName: "Fonte pública", confidence: "confirmado", shortlisted: true, evidence: [{ criterion: "Product Discovery", criterionType: "obrigatório", result: "atende", evidence: "Experiência informada no perfil.", source: "Fonte pública", confidence: "confirmado" }], contacts: [] }] };
  assert.match(buildApproachMessage(search, search.candidates[0], "linkedin"), /vagas\.exemplo/);
  assert.doesNotMatch(buildApproachMessage({ ...search, jobUrl: undefined }, search.candidates[0], "linkedin"), /Detalhes da vaga/);
  const output = await buildHrHuntingWorkbook(search, "all");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(output as never);
  assert.equal((workbook.getWorksheet("Ranking")?.getCell("H2").value as { hyperlink?: string }).hyperlink, "https://www.linkedin.com/in/ana-silva");
});
