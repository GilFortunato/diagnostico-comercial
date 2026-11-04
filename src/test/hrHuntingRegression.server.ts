import assert from "node:assert/strict";
import test from "node:test";
import { conservativeJobDna } from "@/lib/hr-hunting/jobDna";
import { applyCandidateQualityGate, buildHrCandidateRecallInput, buildTitleFamily, normalizeCandidates, rankCandidates } from "@/lib/hr-hunting/service";
import { createJobSchema, executeSearchSchema, type HrCandidate, type JobDna } from "@/lib/hr-hunting/types";
import { buildAffirmativeProfileQueries, hasPublicAffirmativeMention } from "@/lib/hr-hunting/affirmativeSourcing";

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

test("busca afirmativa consulta focos escolhidos e exige menção pública, sem inferir identidade", () => {
  const filters = executeSearchSchema.parse({
    quantity: 20, currentTitle: "Analista Comercial", seniority: [], location: "", keywords: [],
    affirmativeFocus: ["women", "disabled"], affirmativeInitiative: "Programa Inclusão Profissional", affirmativeMode: true,
  });
  const queries = buildAffirmativeProfileQueries(filters.affirmativeFocus, filters.affirmativeInitiative);
  assert.deepEqual(queries[0], '"Programa Inclusão Profissional"');
  assert.match(queries[1], /mulheres em tecnologia/);
  assert.match(queries[1], /pessoas com deficiência/);
  assert.ok(queries.every((query) => query.length <= 300));
  assert.equal(hasPublicAffirmativeMention("Atuo em vendas e participei do Programa Inclusão Profissional.", filters.affirmativeFocus, filters.affirmativeInitiative), true);
  assert.equal(hasPublicAffirmativeMention("Analista Comercial e especialista em vendas.", filters.affirmativeFocus, filters.affirmativeInitiative), false);
  const professional = candidate("Ana", "Analista Comercial", "", "https://www.linkedin.com/in/ana", "Empresa X", "Atendimento ao cliente.");
  const dna: JobDna = { title: "Analista Comercial", shortSummary: "Vendas e atendimento.", responsibilities: [], interviewChecks: [], criteria: [] };
  assert.equal(rankCandidates([professional], dna, filters)[0].fitScore, rankCandidates([professional], dna, { ...filters, affirmativeMode: false, affirmativeFocus: [] })[0].fitScore);
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
