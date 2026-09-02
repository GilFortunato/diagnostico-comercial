import assert from "node:assert/strict";
import test from "node:test";
import { conservativeJobDna } from "@/lib/hr-hunting/jobDna";
import { buildHrCandidateRecallInput, normalizeCandidates } from "@/lib/hr-hunting/service";
import { createJobSchema } from "@/lib/hr-hunting/types";

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

test("fallback direto do HR usa recall-first e limita páginas", () => {
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
  assert.deepEqual(actorInput.locations, ["Jundiaí, SP"]);
  assert.equal("currentJobTitles" in actorInput, false);
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

test("normalizador abre wrappers de resultados e preserva perfil com LinkedIn mesmo sem cargo", () => {
  const candidates = normalizeCandidates([{
    results: [{
      firstName: "João",
      lastName: "Costa",
      linkedinUrl: "https://www.linkedin.com/in/joao-costa",
      location: { parsed: { text: "Campinas, SP, Brasil" } },
    }],
  }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "João Costa");
  assert.equal(candidates[0].currentTitle, undefined);
  assert.ok(candidates[0].pointsToValidate.includes("Cargo atual não informado pela fonte"));
});
