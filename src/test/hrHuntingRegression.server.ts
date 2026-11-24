import assert from "node:assert/strict";
import test from "node:test";
import { conservativeJobDna } from "@/lib/hr-hunting/jobDna";
import { midLevelInTitle, requiresMidLevel } from "@/lib/hr-hunting/seniority";
import { buildRounds, limitHarvestQuery } from "@/lib/hr-hunting/safeStrategicSearch";
import { applyCandidateQualityGate, buildHrCandidateRecallInput, buildTitleFamily, normalizeCandidates, rankCandidates } from "@/lib/hr-hunting/service";
import { createJobSchema, executeSearchSchema, type HrCandidate, type JobDna } from "@/lib/hr-hunting/types";

const vacancy = `Jundiaí, SP, BR
Analista de Pós-Vendas

Sobre a vaga
Buscamos uma pessoa para acompanhar clientes após a implantação, organizar demandas e apoiar a continuidade do relacionamento.

Responsabilidades:
- Acompanhar a carteira de clientes e registrar interações no CRM.
- Atuar na resolução de demandas em conjunto com áreas internas.

Requisitos:
- Experiência profissional com pós-vendas ou atendimento ao cliente.
- Conhecimento de ERP e CRM.

Diferenciais:
- Vivência com implantação de sistemas.`;

test("HR intake aceita vaga completa sem título em campo separado", () => {
  const parsed = createJobSchema.safeParse({ description: vacancy, jobUrl: "", companyName: "", recruiterName: "" });
  assert.equal(parsed.success, true);
});

test("fallback do Job DNA não usa localização como título ou resumo", () => {
  const dna = conservativeJobDna({ description: vacancy });
  assert.equal(dna.title, "Analista de Pós-Vendas");
  assert.doesNotMatch(dna.shortSummary, /^Jundiaí, SP, BR$/i);
  assert.ok(dna.shortSummary.length >= 35);
  assert.match(dna.location || "", /Jundiaí/i);
  assert.ok(dna.criteria.some((criterion) => /ERP e CRM/i.test(criterion.label)));
  assert.ok(dna.responsibilities.some((item) => /carteira de clientes/i.test(item)));
});

test("família semântica de cargo amplia pós-vendas sem transformar skills em cargo", () => {
  const family = buildTitleFamily("Analista de Pós-Vendas");
  assert.ok(family.some((term) => /Customer Success/i.test(term)));
  assert.ok(family.some((term) => /After Sales/i.test(term)));
  assert.equal(family.some((term) => /^CRM$/i.test(term)), false);
});

test("busca HR usa família de cargo e não abre a descoberta com keywords soltas", () => {
  const actorInput = buildHrCandidateRecallInput({
    quantity: 20,
    currentTitle: "Analista de Pós-Vendas",
    seniority: ["manager"],
    location: "Jundiaí, SP",
    keywords: ["ERP", "CRM"],
  }, "Analista de Pós-Vendas");
  assert.equal(actorInput.profileScraperMode, "Short");
  assert.equal(actorInput.takePages, 2);
  assert.equal(actorInput.maxItems, 40);
  assert.match(String(actorInput.searchQuery), /Analista de Pós-Vendas/);
  assert.match(String(actorInput.searchQuery), /Customer Success/i);
  assert.doesNotMatch(String(actorInput.searchQuery), /\bERP\b/);
  assert.doesNotMatch(String(actorInput.searchQuery), /\bCRM\b/);
  assert.deepEqual(actorInput.locations, ["Jundiaí, SP"]);
  assert.equal("seniorityLevelIds" in actorInput, false);
});

test("refazer busca jurídica após timeout usa títulos de mercado e preserva os filtros explícitos", () => {
  const title = "Pessoa Advogada Empresarial Pleno";
  const jobDna = conservativeJobDna({ title, description: "Obrigatório: formação em Direito e inscrição ativa na OAB." });
  const search = { title, jobDna };
  const input = { currentTitle: title, quantity: 50, seniority: [], location: "Brasil", keywords: [] };
  const plan = { primaryTitle: title, equivalentTitles: ["Pessoa Advogada Empresarial"], adjacentTitles: [] };
  const rounds = buildRounds(search, input, plan);
  for (const round of rounds) {
    assert.equal(round.location, "Brasil");
    assert.deepEqual(round.keywords, []);
    assert.ok(round.titles.includes("Advogado Empresarial Pleno"));
  }
  assert.ok(rounds[0].titles.every(midLevelInTitle));
  assert.ok(rounds[1].titles.includes("Advogado Corporativo"));
  const explicit = buildRounds(search, { ...input, keywords: ["contratos"], alternateTitles: ["Legal Counsel"] }, plan);
  assert.deepEqual(explicit[0].titles, ["Legal Counsel"]);
  assert.ok(explicit.every((round) => round.keywords.join() === "contratos"));
});

test("normalizador aceita o formato Short atual do Harvest", () => {
  const candidates = normalizeCandidates([{
    id: "ACoAA-test",
    firstName: "Maria",
    lastName: "Silva",
    position: "Analista de Pós-Vendas",
    linkedinUrl: "https://www.linkedin.com/in/maria-silva",
    location: {
      linkedinText: "Jundiaí, São Paulo, Brasil",
      parsed: { text: "Jundiaí, SP, Brasil", city: "Jundiaí", state: "São Paulo", country: "Brasil" },
    },
  }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Maria Silva");
  assert.equal(candidates[0].currentTitle, "Analista de Pós-Vendas");
  assert.equal(candidates[0].location, "Jundiaí, São Paulo, Brasil");
  assert.equal(candidates[0].profileUrl, "https://www.linkedin.com/in/maria-silva");
});

test("busca estratégica restringe o texto do Harvest a 300 caracteres preservando alternativas completas", () => {
  const first = "a".repeat(220);
  const tooLong = "b".repeat(90);
  assert.equal(limitHarvestQuery(`${first} OR ${tooLong} OR CRM`), `${first} OR CRM`);
  assert.equal(limitHarvestQuery(undefined), undefined);
});

test("normalizador preserva perfil com LinkedIn sem cargo para possível enriquecimento", () => {
  const candidates = normalizeCandidates([{
    results: [{
      firstName: "João",
      lastName: "Costa",
      linkedinUrl: "https://www.linkedin.com/in/joao-costa",
      location: { parsed: { text: "Campinas, SP, Brasil" } },
    }],
  }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].currentTitle, undefined);
  assert.ok(candidates[0].pointsToValidate.includes("Cargo atual não informado pela fonte"));
});

test("quality gate exclui perfil sem cargo e perfil fora da família/localização", () => {
  const dna = conservativeJobDna({ description: vacancy });
  const candidates: HrCandidate[] = [
    candidate("Maria", "Analista de Customer Success", "Jundiaí, São Paulo, Brasil", "https://www.linkedin.com/in/maria"),
    candidate("João", undefined, "Jundiaí, São Paulo, Brasil", "https://www.linkedin.com/in/joao"),
    candidate("Pedro", "Engenheiro de Software", "Jundiaí, São Paulo, Brasil", "https://www.linkedin.com/in/pedro"),
    candidate("Ana", "Analista de Pós-Vendas", "Fortaleza, Ceará, Brasil", "https://www.linkedin.com/in/ana"),
  ];
  const result = applyCandidateQualityGate(candidates, dna, { quantity: 20, currentTitle: dna.title, seniority: [], location: "Jundiaí, SP", keywords: ["CRM"] });
  assert.deepEqual(result.eligible.map((item) => item.name), ["Maria"]);
  assert.equal(result.rejected.length, 3);
});

test("ranking dá mais peso para família de cargo e evidência profissional", () => {
  const dna: JobDna = {
    title: "Analista de Pós-Vendas",
    shortSummary: "Atuação em pós-vendas e relacionamento com clientes.",
    location: "Jundiaí, SP",
    responsibilities: [],
    interviewChecks: [],
    criteria: [
      { id: "c1", label: "Experiência com pós-vendas e atendimento ao cliente", kind: "obrigatório", sourceExcerpt: "Experiência profissional com pós-vendas ou atendimento ao cliente." },
      { id: "c2", label: "Conhecimento de ERP e CRM", kind: "obrigatório", sourceExcerpt: "Conhecimento de ERP e CRM." },
    ],
  };
  const strong = candidate("Maria", "Analista de Customer Success", "Jundiaí, São Paulo, Brasil", "https://www.linkedin.com/in/maria", "Empresa X", "Atendimento ao cliente, pós-vendas, CRM e ERP.");
  const weak = candidate("Pedro", "Analista Comercial", "Jundiaí, São Paulo, Brasil", "https://www.linkedin.com/in/pedro", "Empresa Y", "Vendas e prospecção comercial.");
  const ranked = rankCandidates([weak, strong], dna, { quantity: 20, currentTitle: dna.title, seniority: [], location: "Jundiaí, SP", keywords: [] });
  assert.equal(ranked[0].name, "Maria");
  assert.ok(ranked[0].fitScore > ranked[1].fitScore);
  assert.match(ranked[0].mainSignal || "", /Cargo\/família profissional aderente/);
});

test("cargos alternativos digitados ampliam elegibilidade e recalculam aderência", () => {
  const parsed = executeSearchSchema.parse({
    quantity: 20, currentTitle: "Gerente Comercial", seniority: [], location: "", keywords: [],
    alternateTitles: ["Key Account", "Sales"],
  });
  const dna: JobDna = {
    title: "Gerente Comercial", shortSummary: "Gestão de contas e relacionamento comercial.",
    responsibilities: [], interviewChecks: [],
    criteria: [{ id: "c1", label: "Relacionamento com clientes", kind: "obrigatório", sourceExcerpt: "Relacionamento com clientes." }],
  };
  const profile = candidate("Joana", "Key Account Manager", "", "https://www.linkedin.com/in/joana", "Empresa X", "Relacionamento com clientes.");
  const withoutAlternatives = { ...parsed, alternateTitles: [] };
  assert.equal(applyCandidateQualityGate([profile], dna, withoutAlternatives).eligible.length, 0);
  assert.deepEqual(applyCandidateQualityGate([profile], dna, parsed).eligible.map((item) => item.name), ["Joana"]);
  assert.ok(rankCandidates([profile], dna, parsed)[0].fitScore > rankCandidates([profile], dna, withoutAlternatives)[0].fitScore);
});

function candidate(name: string, currentTitle: string | undefined, location: string, profileUrl: string, currentCompany?: string, professionalSummary?: string): HrCandidate {
  return {
    id: `hr_${name.toLowerCase()}`,
    name,
    currentTitle,
    currentCompany,
    location,
    profileUrl,
    professionalSummary,
    fitScore: 0,
    fitClassification: "Baixa aderência inicial",
    pointsToValidate: [],
    sourceName: "fixture",
    confidence: "confirmado",
    evidence: [],
    contacts: [],
    shortlisted: false,
  };
}

test("vaga exclusivamente plena exige nível no cargo atual", () => {
  assert.equal(requiresMidLevel("Pessoa Advogada Empresarial Pleno"), true);
  assert.equal(requiresMidLevel("Advogado", "Pleno ou Sênior"), false);
  for (const title of ["Advogada Plena", "Advogado PL", "Mid-level Corporate Lawyer"]) assert.ok(midLevelInTitle(title));
  for (const title of ["Advogada Corporativa Internacional", "Senior Counsel", "Advogado Jr.", "Sócia | Advogada Plena"]) assert.equal(midLevelInTitle(title), false);
});

test("Harvest retoma o mesmo run e aproveita o dataset até quando termina parcialmente", async () => {
  const { readHarvestPage } = await import("@/lib/connectors/harvestPage");
  const round: import("@/lib/hr-hunting/pagedDiscovery").HrDiscoveryRound = { input: {}, nextPage: 1, exhausted: false };
  let state = "RUNNING";
  let created = 0;
  const data = [{ position: "Advogada Plena" }];
  const request = async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") created++;
    if (path.startsWith("datasets/")) return data;
    return { data: { id: "runexample123", status: state, defaultDatasetId: "datasetexample123" } };
  };
  const first = await readHarvestPage("harvestapi/linkedin-profile-search", {}, round, request);
  assert.equal(first.pending, true);
  assert.equal(round.runId, "runexample123");
  state = "TIMED-OUT";
  const last = await readHarvestPage("harvestapi/linkedin-profile-search", {}, round, request);
  assert.deepEqual(last, { items: data, pending: false, partial: true });
  assert.equal(created, 1);
  assert.equal(round.runId, undefined);
});

test("índice de contingência usa perfis individuais, título e localização com evidência", async () => {
  const { indexedProfiles, profileQueries } = await import("@/lib/hr-hunting/indexedProfiles");
  const hit = { title: "Maria Exemplo - Advogada Plena | LinkedIn", url: "https://br.linkedin.com/in/fixture-profile", description: "São Paulo, Brasil · Advocacia" };
  const result = indexedProfiles([{ organicResults: [hit, { ...hit, url: "https://www.linkedin.com/jobs/view/123" },
    { ...hit, url: "https://example.com/in/fake" }, { ...hit, url: "https://www.linkedin.com/in/unknown", description: "sem localização publicada" }] }], "Brasil");
  assert.equal(result.length, 1);
  assert.equal(result[0].currentTitle, "Advogada Plena");
  assert.equal(result[0].location, "São Paulo, Brasil");
  assert.ok(profileQueries(["Advogada Plena"], "Brasil", ["contratos"])[0].includes('"contratos"'));
});
