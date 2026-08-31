import assert from "node:assert/strict";
import test from "node:test";
import { buildBusinessUnitGuidance, getBusinessUnitDna } from "@/lib/business-units/dna";
import { normalizeLinkedInPayload } from "@/lib/connectors/linkedinNormalization";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";

const prosper = getBusinessUnitDna("bu_prosper");

function input(overrides: Record<string, unknown> = {}) {
  return {
    businessUnitId: prosper.id,
    businessUnitName: prosper.name,
    businessUnitContext: buildBusinessUnitGuidance(prosper.id),
    profileUrl: "https://www.linkedin.com/in/perfil-teste",
    objective: "Fortalecer autoridade comercial com lideranças de empresas.",
    headline: "Liderança de projetos de inteligência artificial aplicada a negócios",
    about: "Lidero projetos de inteligência artificial e transformação com foco em decisões, pessoas e impacto mensurável.",
    themes: "inteligência artificial, transformação digital, liderança",
    proofPoints: "Liderança de projetos estratégicos e formação de equipes.",
    recentContent: "",
    interactionSignals: "",
    ...overrides,
  };
}

function snapshot(withPosts = false) {
  return normalizeLinkedInPayload({
    profileUrl: "https://www.linkedin.com/in/perfil-teste",
    collectedAt: "2026-08-30T12:00:00.000Z",
    profile: {
      headline: "Liderança de IA aplicada a negócios",
      about: "Reduzi o lead time em 28% ao liderar uma transformação com times comerciais.",
      experiences: [{ title: "Head de Transformação", companyName: "Empresa Exemplo", description: "Reduzi tickets em 20% e economizei 300 horas. Arquitetura React, API, AWS e pipeline interno detalhado." }],
      education: [{ schoolName: "Universidade Exemplo", degreeName: "Administração" }],
      certifications: [{ name: "Gestão de Produtos", issuer: "Instituição Exemplo" }],
      skills: ["Inteligência artificial", "Liderança"],
    },
    posts: withPosts ? [
      { text: "Como transformar IA em decisões melhores para o negócio.", publishedAt: "2026-08-20", reactions: 12, comments: 3 },
      { text: "Liderança e IA exigem clareza sobre o problema antes da tecnologia.", publishedAt: "2026-08-12", reactions: 8, comments: 2 },
    ] : [],
  });
}

test("headline não vira evidência de comentários ou networking", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  for (const key of ["comments_quality", "strategic_network", "relevant_conversations"]) {
    const dimension = assessment.dimensions.find((item) => item.key === key);
    assert.equal(dimension?.status, "not_evaluated");
    assert.equal(dimension?.score, null);
    assert.deepEqual(dimension?.evidence, []);
  }
});

test("sem posts, conteúdo e frequência ficam não avaliados", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  assert.equal(assessment.dimensions.find((item) => item.key === "published_content")?.score, null);
  assert.equal(assessment.dimensions.find((item) => item.key === "frequency")?.score, null);
});

test("posts existentes liberam somente dimensões compatíveis", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(true) }));
  assert.equal(assessment.dimensions.find((item) => item.key === "published_content")?.status, "evaluated");
  assert.equal(assessment.dimensions.find((item) => item.key === "frequency")?.status, "evaluated");
  assert.equal(assessment.dimensions.find((item) => item.key === "comments_quality")?.status, "not_evaluated");
});

test("normalização semântica remove URLs, IDs e dimensões de imagem do texto executivo", () => {
  const normalized = normalizeLinkedInPayload({
    profileUrl: "https://www.linkedin.com/in/perfil-teste",
    profile: {
      headline: "Autoridade comercial",
      experience: [{ title: "Diretora", companyName: "Empresa", description: "https://cdn.example/logo.png", internalId: "urn:li:fsd_profile:123", imageSize: "400 400" }],
      skills: ["Estratégia", "https://cdn.example/icon.png", "urn:li:skill:123", "200 x 200"],
    },
  });
  const executive = JSON.stringify({ experiences: normalized.experiences, skills: normalized.skills });
  assert.doesNotMatch(executive, /cdn\.example|urn:li|400 400|200 x 200/);
});

test("texto com scripts misturados por corrupção não vira evidência", () => {
  const normalized = normalizeLinkedInPayload({ profileUrl: "https://www.linkedin.com/in/perfil-teste", profile: { headline: "Liderança", location: "Sao Рaulo corrompido" } });
  assert.equal(normalized.location, null);
});

test("resultados mensuráveis ficam separados de experiência e formação", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  assert.ok(assessment.evidencePortfolio.measurableResults.some((item) => /28%|20%|300 horas/.test(item)));
  assert.ok(assessment.evidencePortfolio.relevantExperience.some((item) => item.includes("Head de Transformação")));
  assert.ok(assessment.evidencePortfolio.relevantEducation.some((item) => item.includes("Universidade Exemplo")));
});

test("Authority Selling permanece igual quando apenas a BU muda", () => {
  const share = getBusinessUnitDna("bu_share");
  const personalEvidence = { themes: "IA aplicada, habilidades digitais, educação corporativa", linkedinSnapshot: snapshot(true) };
  const first = createAuthorityAssessment(input(personalEvidence));
  const second = createAuthorityAssessment(input({ ...personalEvidence, businessUnitId: share.id, businessUnitName: share.name, businessUnitContext: buildBusinessUnitGuidance(share.id) }));
  assert.equal(first.authoritySellingScore, second.authoritySellingScore);
  assert.notEqual(first.buAffinityScore, second.buAffinityScore);
});

test("potencial de ativação é limitado e explicado", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(true) }));
  assert.ok(assessment.activationPotentialScore <= 92);
  assert.match(assessment.scoreExplanations.activationPotential, /autoridade|aderência|ponte/i);
});

test("mapa de autoridade informa território, evidência e visibilidade", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(true) }));
  assert.ok(assessment.authorityMap.length > 0);
  assert.ok(assessment.authorityMap.every((item) => item.territory && item.currentStrength && item.publicVisibility));
});

test("Bridge Engine clusteriza temas semanticamente equivalentes", () => {
  const assessment = createAuthorityAssessment(input({ themes: "IA, inteligência artificial, IA aplicada, liderança", linkedinSnapshot: snapshot(true) }));
  const normalized = assessment.bridgeOpportunities.map((item) => item.territory.toLocaleLowerCase("pt-BR").replace(/ia aplicada|ia/g, "inteligência artificial"));
  assert.equal(new Set(normalized).size, normalized.length);
});

test("pontes variam ações e personas quando há opções", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(true) }));
  assert.ok(new Set(assessment.bridgeOpportunities.map((item) => item.nextAction)).size > 1);
  assert.ok(new Set(assessment.bridgeOpportunities.map((item) => item.persona)).size > 1);
});

test("exposição competitiva considera detalhe técnico sem apagar o resultado", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  assert.ok(assessment.commercialExposure.some((item) => item.classification === "PROVA_COMERCIAL"));
  assert.ok(assessment.commercialExposure.some((item) => item.classification === "EXPOSICAO_COMPETITIVA" || item.classification === "DETALHE_OPERACIONAL"));
});

test("motor não inventa fatos ausentes", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  assert.doesNotMatch(JSON.stringify(assessment.evidencePortfolio), /aumento de receita|milhão|Fortune 500/i);
});

test("lacuna sem evidência declara limite metodológico", () => {
  const assessment = createAuthorityAssessment(input({ linkedinSnapshot: snapshot(false) }));
  const gap = assessment.strategicGaps.find((item) => item.confidence === "not_evaluated");
  assert.ok(gap);
  assert.match(gap!.expertReading, /Ausência de dado não é fraqueza/);
});

test("plano executivo mantém estratégia acima das ações diárias", async () => {
  const { createStructuredAuthorityThirtyDayPlan } = await import("@/lib/diagnostics/authorityPlan");
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(input({ linkedinSnapshot: snapshot(true) })) });
  assert.ok(plan.objective && plan.currentState && plan.desiredState && plan.whyNow);
  assert.equal(plan.weeks.length, 4);
  assert.equal(plan.actions.length, 30);
  assert.ok(new Set(plan.actions.map((item) => item.socialSellingAction)).size >= 6);
});
