import assert from "node:assert/strict";
import test from "node:test";
import { compareAuthorityAssessments, createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { executeAuthorityPipeline, InsufficientPublicProfileDataError } from "@/lib/diagnostics/authorityPipeline";

const defaultBu = getBusinessUnitDna(defaultBusinessUnitId);
const baseInput = {
  businessUnitId: defaultBu.id,
  businessUnitName: defaultBu.name,
  businessUnitContext: buildBusinessUnitGuidance(defaultBu.id),
  profileUrl: "https://www.linkedin.com/in/prosper-demo",
  objective: "Ser reconhecido por lideranças de RH como referencia em IA aplicada a educacao corporativa.",
  headline: "Educação corporativa e IA aplicada ao desenvolvimento de talentos para empresas",
  about:
    "Ajudo lideranças e times de RH a aplicar IA em programas de desenvolvimento com critério, contexto humano e impacto real no negócio.",
  themes: "IA aplicada a RH, educação corporativa, desenvolvimento de talentos",
  proofPoints: "Cases com clientes, projetos de treinamento e resultados relatados por lideranças.",
  recentContent: "Posts, artigos e comentários sobre aprendizagem corporativa e IA.",
  interactionSignals: "Conversas com RH, diretores, gestores de treinamento e decisores.",
};

test("authority assessment returns a bounded commercial authority score", () => {
  const assessment = createAuthorityAssessment(baseInput);

  assert.equal(assessment.input.businessUnitName, defaultBu.name);
  assert.equal(assessment.dimensions.length, 20);
  assert.ok(assessment.overallScore >= 0);
  assert.ok(assessment.overallScore <= 100);
  assert.equal(assessment.authoritySellingScore, assessment.overallScore);
  assert.ok(assessment.buAffinityScore >= 0);
  assert.ok(assessment.activationPotentialScore >= assessment.buAffinityScore);
  assert.ok(assessment.bridgeOpportunities.length > 0);
  assert.ok(assessment.sources.some((source) => source.confidence === "confirmed"));
  assert.ok(assessment.nextActions.includes("Comparar evolução"));
});

test("authority comparison calculates score movement", () => {
  const first = createAuthorityAssessment({ ...baseInput, proofPoints: "", recentContent: "" });
  const latest = createAuthorityAssessment(baseInput);
  first.createdAt = "2026-01-01T00:00:00.000Z";
  latest.createdAt = "2026-02-01T00:00:00.000Z";
  const comparison = compareAuthorityAssessments([latest, first]);

  assert.equal(comparison.available, true);
  assert.equal(comparison.delta, latest.overallScore - first.overallScore);
});

test("business unit changes affinity without rewriting personal authority", () => {
  const shareBu = getBusinessUnitDna("bu_share");
  const prosperAssessment = createAuthorityAssessment(baseInput);
  const shareAssessment = createAuthorityAssessment({
    ...baseInput,
    businessUnitId: shareBu.id,
    businessUnitName: shareBu.name,
    businessUnitContext: buildBusinessUnitGuidance(shareBu.id),
  });

  assert.equal(prosperAssessment.authoritySellingScore, shareAssessment.authoritySellingScore);
  assert.notEqual(prosperAssessment.buAffinityScore, shareAssessment.buAffinityScore);
  assert.ok(prosperAssessment.sources.some((source) => source.title.includes(defaultBu.name)));
  assert.ok(shareAssessment.sources.some((source) => source.title.includes(shareBu.name)));
});

test("business unit starter input does not fabricate personal profile data", () => {
  const starter = getBusinessUnitDna(defaultBusinessUnitId);
  const input = buildBusinessUnitGuidance(starter.id);
  assert.ok(input.territories.length > 0);
  assert.equal(baseInput.businessUnitContext.name, starter.name);

  const emptyStarter = {
    ...baseInput,
    headline: "",
    about: "",
    themes: "",
    proofPoints: "",
    recentContent: "",
    interactionSignals: "",
  };
  const assessment = createAuthorityAssessment(emptyStarter);
  assert.ok(assessment.profileReview.every((item) => item.confidence === "unverified"));
  assert.ok(assessment.buAffinityScore < 55);
});

test("thirty-day plan creates a daily plan without reusing legacy weekly cards", () => {
  const assessment = createAuthorityAssessment(baseInput);
  const plan = createStructuredAuthorityThirtyDayPlan({ assessment });

  assert.equal(plan.actions.length, 30);
  assert.deepEqual(plan.actions.map((action) => action.day), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.ok(plan.actions.some((action) => action.scope === "PERSONAL"));
  assert.ok(plan.actions.some((action) => action.scope === "BUSINESS_UNIT"));
  assert.equal(plan.generation, "structured-skeleton");
});

test("thirty-day plan changes its BU activation actions when the BU changes", () => {
  const shareBu = getBusinessUnitDna("bu_share");
  const prosperPlan = createStructuredAuthorityThirtyDayPlan({ assessment: createAuthorityAssessment(baseInput) });
  const sharePlan = createStructuredAuthorityThirtyDayPlan({
    assessment: createAuthorityAssessment({
      ...baseInput,
      businessUnitId: shareBu.id,
      businessUnitName: shareBu.name,
      businessUnitContext: buildBusinessUnitGuidance(shareBu.id),
    }),
  });

  assert.notEqual(prosperPlan.actions.find((action) => action.scope === "BUSINESS_UNIT")?.businessUnit, sharePlan.actions.find((action) => action.scope === "BUSINESS_UNIT")?.businessUnit);
});

test("authority pipeline collects public data before requesting specialist analysis", async () => {
  const calls: string[] = [];
  const result = await executeAuthorityPipeline(baseInput, {
    extractProfile: async (profileUrl) => {
      calls.push(`collect:${profileUrl}`);
      return {
        input: { headline: "Headline pública confirmada" },
        source: { title: "Perfil público", confidence: "likely", notes: "Dados públicos recuperados pela fonte autorizada." },
      };
    },
    createAssessment: async (input, sources) => {
      calls.push(`analyze:${input.headline}:${sources.length}`);
      return createAuthorityAssessment(input, sources);
    },
  });

  assert.deepEqual(calls, [
    `collect:${baseInput.profileUrl}`,
    "analyze:Headline pública confirmada:1",
  ]);
  assert.equal(result.input.headline, "Headline pública confirmada");
});

test("authority pipeline does not analyze an empty public-profile result as evidence", async () => {
  const inputWithoutManualEvidence = {
    ...baseInput,
    headline: "",
    about: "",
    themes: "",
    proofPoints: "",
    recentContent: "",
    interactionSignals: "",
  };
  let analysisCalls = 0;

  await assert.rejects(
    executeAuthorityPipeline(inputWithoutManualEvidence, {
      extractProfile: async () => null,
      createAssessment: async (input, sources) => {
        analysisCalls += 1;
        return createAuthorityAssessment(input, sources);
      },
    }),
    InsufficientPublicProfileDataError,
  );
  assert.equal(analysisCalls, 0);
});

test("authority pipeline can use manual evidence when public sources are unavailable", async () => {
  const result = await executeAuthorityPipeline(baseInput, {
    extractProfile: async () => { throw new PlatformResourceUnavailableError(); },
    createAssessment: async (input, sources) => createAuthorityAssessment(input, sources),
  });

  assert.equal(result.input.headline, baseInput.headline);
  assert.equal(result.sources.some((source) => source.title === "Perfil público"), false);
});
