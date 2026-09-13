import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { upgradeAuthorityAssessmentV2 } from "@/lib/diagnostics/authorityV2";

export type AuthorityImplementationKit = {
  headlineVariants: Array<{ label: "Buyer" | "Autoridade" | "Híbrida"; text: string }>;
  aboutDraft: string;
  featuredRecommendations: string[];
  caseCandidates: string[];
  contentIdeas: string[];
  thoughtLeadershipTheses: string[];
  priorityKeywords: string[];
};

/** Gera um kit executável apenas com sinais já presentes no LinkedIn + contexto comercial informado. */
export function buildAuthorityImplementationKit(rawAssessment: AuthorityAssessment): AuthorityImplementationKit {
  const assessment = upgradeAuthorityAssessmentV2(rawAssessment);
  const context = assessment.input.businessUnitContext;
  const snapshot = assessment.input.linkedinSnapshot;
  const primaryPersona = context?.personas?.[0] || "lideranças e times";
  const primaryTerritory = context?.territories?.[0] || bestTerritory(assessment) || "transformação digital";
  const secondaryTerritory = context?.territories?.[1] || bestTerritory(assessment, 1) || "projetos digitais";
  const role = snapshot?.experiences?.[0]?.role || compactRole(assessment.input.headline) || "Profissional de tecnologia e negócios";
  const measurable = assessment.evidencePortfolio?.measurableResults ?? [];
  const proof = measurable[0] || assessment.evidencePortfolio?.authorityProofs?.[0] || assessment.evidencePortfolio?.relevantExperience?.[0] || "experiência prática em projetos e transformação";
  const keywordCandidates = unique([
    ...(context?.recommendedTerms ?? []),
    ...(context?.territories ?? []),
    ...(snapshot?.skills ?? []),
  ]).filter((item) => item.length >= 2).slice(0, 12);

  const buyerHeadline = limitHeadline(`${primaryTerritory} para ${humanizePersona(primaryPersona)} | ${role} | Projetos orientados a impacto e aplicação prática`);
  const authorityHeadline = limitHeadline(`${role} | ${primaryTerritory} & ${secondaryTerritory} | Transformando experiência prática em resultados, aprendizagem e decisão`);
  const hybridHeadline = limitHeadline(`${primaryTerritory} & ${secondaryTerritory} | ${role} | Estratégia, execução e desenvolvimento de capacidades para times e negócios`);

  const resultSentence = measurable.length
    ? `Entre as evidências já visíveis no LinkedIn, há resultados como ${sentenceCase(measurable[0])}.`
    : `Minha trajetória reúne ${proof.replace(/\.$/, "")}.`;
  const aboutDraft = [
    `Atuo na interseção entre ${primaryTerritory}, ${secondaryTerritory} e execução de projetos, conectando tecnologia, pessoas e objetivos de negócio.`,
    `Meu foco é ajudar ${humanizePersona(primaryPersona)} a transformar intenção em aplicação prática: clareza do problema, desenho da solução, adoção e aprendizagem ao longo da execução.`,
    resultSentence,
    `No LinkedIn, compartilho aprendizados, bastidores, casos e pontos de vista sobre ${primaryTerritory}, sempre separando experiência comprovável de hipótese ou recomendação.`,
    `Se esse é um desafio presente no seu time, uma boa conversa começa pelo contexto e pelo problema antes da ferramenta.`,
  ].join("\n\n");

  const caseCandidates = unique([
    ...measurable.slice(0, 3).map((item) => `Transformar “${trim(item, 130)}” em mini-case: contexto → intervenção → papel → resultado → aprendizado.`),
    ...(snapshot?.experiences ?? []).slice(0, 3).map((item) => `Case de ${item.role}${item.company ? ` na ${item.company}` : ""}: explicitar problema, escopo, decisão tomada e resultado observável.`),
  ]).slice(0, 4);

  const featuredRecommendations = [
    measurable[0] ? `Um case curto com o resultado “${trim(measurable[0], 120)}”, contextualizado e sem expor detalhe operacional sensível.` : "Um case principal com problema, papel, solução, resultado e aprendizado.",
    `Uma publicação de ponto de vista sobre ${primaryTerritory} que deixe clara uma tese própria.`,
    `Uma peça prática para ${humanizePersona(primaryPersona)}: checklist, framework ou guia curto ligado a um problema recorrente.`,
    "Uma prova de trajetória já presente no LinkedIn que ajude o buyer a confiar: projeto, aula, certificação ou publicação com contexto.",
  ];

  const contentIdeas = unique([
    `O erro mais comum ao começar ${primaryTerritory} — e o que eu faria antes da ferramenta.`,
    measurable[0] ? `Bastidores de um resultado: o que precisou mudar para chegar a ${trim(measurable[0], 90)}.` : `Como transformar um projeto de ${primaryTerritory} em resultado mensurável sem começar pela tecnologia.`,
    `O que minha experiência prática me ensinou sobre adoção: por que capacitação sem mudança de processo costuma parar no meio do caminho.`,
    `${secondaryTerritory}: 5 perguntas que eu faria antes de aprovar um piloto.`,
    `Uma decisão que parece técnica, mas é de negócio: como ${humanizePersona(primaryPersona)} pode avaliar risco, valor e capacidade de execução.`,
  ]).slice(0, 5);

  const thoughtLeadershipTheses = [
    `${primaryTerritory} não gera valor por existir; gera valor quando muda uma decisão, um fluxo ou uma capacidade real do time.`,
    `Treinamento sem contexto de trabalho aumenta repertório, mas não garante adoção. Aprendizagem precisa encontrar processo, incentivo e aplicação.` ,
    `Autoridade B2B não é publicar mais. É tornar visível uma combinação repetível de tese, prova e utilidade para o buyer certo.`,
  ];

  return {
    headlineVariants: [
      { label: "Buyer", text: buyerHeadline },
      { label: "Autoridade", text: authorityHeadline },
      { label: "Híbrida", text: hybridHeadline },
    ],
    aboutDraft,
    featuredRecommendations,
    caseCandidates,
    contentIdeas,
    thoughtLeadershipTheses,
    priorityKeywords: keywordCandidates,
  };
}

function bestTerritory(assessment: AuthorityAssessment, index = 0) {
  return assessment.authorityMap?.filter((item) => item.currentStrength !== "Baixa")[index]?.territory;
}

function compactRole(headline: string) {
  return headline.split(/[|•·]/).map((item) => item.trim()).find((item) => item.length >= 4 && item.length <= 55) || "";
}

function humanizePersona(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/^heads? de /i, "lideranças de ").replace(/^head de /i, "lideranças de ");
}

function limitHeadline(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= 210 ? clean : `${clean.slice(0, 207).trim()}…`;
}

function sentenceCase(value: string) {
  const clean = value.replace(/\s+/g, " ").trim().replace(/[.;:]$/, "");
  return clean ? `${clean.charAt(0).toLocaleLowerCase("pt-BR")}${clean.slice(1)}` : clean;
}

function trim(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
