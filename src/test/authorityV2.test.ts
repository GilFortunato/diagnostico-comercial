import assert from "node:assert/strict";
import test from "node:test";
import { buildBusinessUnitGuidance, getBusinessUnitDna } from "@/lib/business-units/dna";
import { normalizeLinkedInPayload } from "@/lib/connectors/linkedinNormalization";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { upgradeAuthorityAssessmentV2 } from "@/lib/diagnostics/authorityV2";

const prosper = getBusinessUnitDna("bu_prosper");

function assessment() {
  const snapshot = normalizeLinkedInPayload({
    profileUrl: "https://www.linkedin.com/in/teste-v2",
    profile: {
      fullName: "Pessoa Teste",
      headline: "Customer Success | Project Management",
      about: "Lidero projetos de inteligência artificial e automação para melhorar processos.",
      experience: [{ title: "Tech Project Manager", companyName: "Empresa", description: "Reduzi o lead time de atendimento em 35% com automação de processos." }],
      skills: ["Inteligência artificial", "Automação"],
    },
    posts: [
      { text: "Por que treinamento de IA não basta: como redesenhar o processo antes de escalar a ferramenta.", publishedAt: "2026-09-01" },
      { text: "Nos bastidores de um projeto, reduzimos 35% do lead time de atendimento com automação.", publishedAt: "2026-09-05" },
    ],
  });
  return createAuthorityAssessment({
    businessUnitId: prosper.id,
    businessUnitName: prosper.name,
    businessUnitContext: buildBusinessUnitGuidance(prosper.id),
    profileUrl: snapshot.profileUrl,
    objective: "Ser reconhecida por T&D e RH como referência em IA aplicada ao trabalho.",
    headline: snapshot.headline,
    about: snapshot.about,
    themes: "IA aplicada ao trabalho, automação, habilidades digitais",
    proofPoints: "Redução de 35% no lead time.",
    recentContent: snapshot.posts.map((item) => item.text).join("\n\n"),
    interactionSignals: "",
    linkedinSnapshot: snapshot,
  });
}

test("V2 organiza o diagnóstico em seis pilares LinkedIn-first", () => {
  const upgraded = upgradeAuthorityAssessmentV2(assessment());
  assert.equal(upgraded.dimensions.length, 6);
  assert.deepEqual(upgraded.dimensions.map((item) => item.label), [
    "Posicionamento",
    "Autoridade comprovável no LinkedIn",
    "Buyer Alignment",
    "Search & Discoverability",
    "Thought Leadership",
    "Ativação & Relacionamento",
  ]);
});

test("V2 não converte ausência de dados de relacionamento em zero", () => {
  const upgraded = upgradeAuthorityAssessmentV2(assessment());
  const relationship = upgraded.dimensions.find((item) => item.key === "v2_activation_relationship");
  assert.ok(relationship);
  if (relationship?.status === "not_evaluated") assert.equal(relationship.score, null);
});

test("V2 trata visibilidade como sinalização e não percepção comprovada", () => {
  const upgraded = upgradeAuthorityAssessmentV2(assessment());
  assert.match(upgraded.authorityPerception.perceivedAuthority, /sinaliza|sinais públicos/i);
  assert.doesNotMatch(upgraded.authorityPerception.perceivedAuthority, /a audiência percebe/i);
});

test("V2 explicita que discoverability inferida não é Search Appearances", () => {
  const upgraded = upgradeAuthorityAssessmentV2(assessment());
  const discoverability = upgraded.dimensions.find((item) => item.key === "v2_discoverability");
  assert.match(discoverability?.rationale ?? "", /não equivale aos dados reais de Search Appearances/i);
});
