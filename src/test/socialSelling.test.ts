import assert from "node:assert/strict";
import test from "node:test";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { createContentOpportunity } from "@/lib/content/intelligence";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { buildHookVariants, isGenericComment, reviewAuthorityContent, type ContentQualityInput } from "@/lib/social-selling/contentQualityGate";
import { classifyLinkedInMetrics, linkedInStrategySources } from "@/lib/social-selling/linkedinAlgorithmStrategy";
import { buildNextBestSocialSellingAction, buildStrategicComment } from "@/lib/social-selling/socialSellingStrategy";

const businessUnit = getBusinessUnitDna(defaultBusinessUnitId);
const baseInput = {
  businessUnitId: businessUnit.id,
  businessUnitName: businessUnit.name,
  businessUnitContext: buildBusinessUnitGuidance(businessUnit.id),
  profileUrl: "https://www.linkedin.com/in/social-selling-test",
  objective: "Ser reconhecido por lideranças de RH como referência em IA aplicada à educação corporativa.",
  headline: "Educação corporativa e IA aplicada ao desenvolvimento de talentos para empresas",
  about: "Ajudo lideranças e times de RH a aplicar IA em programas de desenvolvimento com critério, contexto humano e impacto real no negócio.",
  themes: "IA aplicada a RH, educação corporativa, desenvolvimento de talentos",
  proofPoints: "Projetos de treinamento e resultados relatados por lideranças, sujeitos à validação antes da publicação.",
  recentContent: "Publicações e comentários sobre aprendizagem corporativa e IA.",
  interactionSignals: "Conversas com RH, diretores, gestores de treinamento e decisores.",
};

const factualContext = "Criei uma plataforma para ajudar meus alunos a aprender mineração de texto e processamento de linguagem natural e usei a narrativa da série The Last of Us.";
const thesis = "Talvez o ensino de tecnologia ganhe significado quando o contexto vem antes da ferramenta.";
const selectedHook = "Eu coloquei The Last of Us dentro de uma aula de processamento de linguagem natural.";

function validQualityInput(overrides: Partial<ContentQualityInput> = {}): ContentQualityInput {
  return {
    post: `${selectedHook}\n\nCriei uma plataforma para trabalhar mineração de texto e processamento de linguagem natural com meus alunos. A narrativa não entra como decoração: ela organiza o contexto em que os problemas técnicos aparecem.\n\nEssa experiência levanta uma questão sobre a ordem do ensino. Talvez a ferramenta faça mais sentido quando o problema já tem significado para quem aprende.`,
    expertReading: "A escolha incomum de uma narrativa conhecida cria uma tensão útil entre rigor técnico e contexto de aprendizagem.",
    thesis,
    hook: {
      variants: buildHookVariants({ humanContext: factualContext, thesis, territory: "IA aplicada à aprendizagem" }),
      selectedType: "SPECIFIC_PERSONAL",
      selected: selectedHook,
      payoff: "O corpo explica como a narrativa organiza o contexto do problema técnico sem afirmar um resultado não fornecido.",
    },
    humanContext: factualContext,
    businessUnitName: businessUnit.name,
    primaryStepps: ["Stories", "Practical Value"],
    ...overrides,
  };
}

test("the 30-day sprint can recommend no publication", () => {
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(baseInput) });
  assert.ok(plan.actions.some((action) => action.socialSellingAction === "NO_PUBLISH"));
});

test("the 30-day sprint includes strategic comments", () => {
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(baseInput) });
  assert.ok(plan.actions.some((action) => action.socialSellingAction === "COMMENT"));
});

test("suggested comment is substantive instead of generic", () => {
  const suggestion = buildStrategicComment({ territory: "IA aplicada à aprendizagem", persona: "lideranças de RH", thesis });
  assert.equal(isGenericComment(suggestion.comment), false);
  assert.match(suggestion.comment, /consequência prática/i);
});

test("hook intelligence preserves the supplied fact without inventing an outcome", () => {
  const hooks = buildHookVariants({ humanContext: factualContext, thesis, territory: "IA aplicada à aprendizagem" });
  const factualHook = hooks.find((hook) => hook.type === "SPECIFIC_PERSONAL");
  assert.ok(factualHook?.text.includes("Criei uma plataforma"));
  assert.doesNotMatch(JSON.stringify(hooks), /retenção aumentou|resultados melhoraram|resistência desapareceu/i);
});

test("a selected hook must have a substantive payoff in the body", () => {
  assert.equal(reviewAuthorityContent(validQualityInput()).valid, true);
  const invalid = reviewAuthorityContent(validQualityInput({
    hook: { ...validQualityInput().hook, payoff: "Sem entrega." },
  }));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some((issue) => issue.includes("promessa do gancho")));
});

test("content intelligence does not create a viral score", () => {
  const result = createContentOpportunity({ businessUnitId: businessUnit.id, objective: "Criar uma pauta consultiva sobre IA aplicada ao trabalho.", personalVoice: "" });
  assert.equal(Object.hasOwn(result, "viralScore"), false);
  assert.match(result.circulationPotential.disclaimer, /não é previsão/i);
});

test("LinkedIn strategy does not expose fictitious algorithm weights", () => {
  assert.ok(linkedInStrategySources.every((source) => !Object.hasOwn(source, "weight")));
  assert.ok(linkedInStrategySources.some((source) => source.evidenceClass === "OFFICIAL"));
  assert.ok(linkedInStrategySources.some((source) => source.evidenceClass === "SHARE_AI_HEURISTIC"));
});

test("STEPPS remains part of content strategy", () => {
  const result = createContentOpportunity({ businessUnitId: businessUnit.id, objective: "Criar uma pauta consultiva sobre IA aplicada ao trabalho.", personalVoice: "" });
  assert.ok(result.stepps.length >= 1);
  assert.ok(result.stepps.some((item) => item.key === "Valor prático"));
});

test("factual distance rejects an outcome absent from human context", () => {
  const review = reviewAuthorityContent(validQualityInput({
    post: `${selectedHook}\n\nCriei a plataforma com essa narrativa. A resistência dos alunos desapareceu e a retenção aumentou. O caso prova que a abordagem funciona em qualquer contexto profissional.`,
  }));
  assert.equal(review.valid, false);
  assert.ok(review.issues.some((issue) => issue.includes("resultado factual não fornecido")));
});

test("business unit remains context instead of becoming propaganda", () => {
  const review = reviewAuthorityContent(validQualityInput({
    post: `${selectedHook}\n\nA ${businessUnit.name} oferece o contexto. A ${businessUnit.name} resolve a questão. Por isso, a ${businessUnit.name} deve ser a escolha de qualquer empresa. Este texto repete a marca em vez de desenvolver a tese e ainda promete uma solução universal sem evidência.`,
  }));
  assert.equal(review.valid, false);
  assert.ok(review.issues.some((issue) => issue.includes("propaganda")));
});

test("generic AI-style opening fails the quality gate", () => {
  const review = reviewAuthorityContent(validQualityInput({
    post: "Você já parou para pensar em como a inteligência artificial está transformando tudo? Em um mundo cada vez mais conectado, precisamos inovar e sair da zona de conforto. Essa reflexão mostra que a mudança depende de todos nós, sempre com propósito e colaboração.",
    hook: { ...validQualityInput().hook, selected: "Você já parou para pensar em como a inteligência artificial está transformando tudo?" },
  }));
  assert.equal(review.valid, false);
  assert.ok(review.issues.some((issue) => issue.includes("fórmula genérica")));
});

test("missing LinkedIn analytics remain absent instead of being estimated", () => {
  assert.deepEqual(classifyLinkedInMetrics(), []);
  assert.deepEqual(classifyLinkedInMetrics({ impressions: 120, comments: 4 }), [
    { key: "impressions", value: 120, category: "EXPOSURE" },
    { key: "comments", value: 4, category: "CONVERSATION" },
  ]);
});

test("the sprint does not require daily posting", () => {
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(baseInput) });
  const publicationDays = plan.actions.filter((action) => action.socialSellingAction === "POST");
  assert.ok(publicationDays.length > 0);
  assert.ok(publicationDays.length < plan.actions.length / 2);
});

test("next best action can prioritize relationship before outreach", () => {
  const assessment = createAuthorityAssessment(baseInput);
  assessment.buAffinityScore = 35;
  const decision = buildNextBestSocialSellingAction(assessment);
  assert.equal(decision.action, "RELATIONSHIP");
  assert.equal(decision.shouldPublish, false);
  assert.match(decision.actions.join(" "), /não envie abordagem comercial ainda/i);
});

test("content without a sufficient thesis fails before display", () => {
  const review = reviewAuthorityContent(validQualityInput({ thesis: "IA é importante." }));
  assert.equal(review.valid, false);
  assert.ok(review.issues.some((issue) => issue.includes("tese específica")));
});

test("outreach appears only after relationship and rapport in the sprint", () => {
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(baseInput) });
  const outreachIndex = plan.actions.findIndex((action) => action.socialSellingAction === "OUTREACH");
  if (outreachIndex === -1) {
    assert.ok(plan.actions.some((action) => action.socialSellingAction === "RELATIONSHIP"));
    return;
  }
  assert.ok(plan.actions.slice(0, outreachIndex).some((action) => action.socialSellingAction === "RELATIONSHIP"));
  assert.ok(plan.actions.slice(0, outreachIndex).some((action) => action.socialSellingAction === "RAPPORT"));
});
