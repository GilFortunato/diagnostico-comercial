import assert from "node:assert/strict";
import test from "node:test";
import { compareAuthorityAssessments, createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";

const defaultBu = getBusinessUnitDna(defaultBusinessUnitId);
const baseInput = {
  businessUnitId: defaultBu.id,
  businessUnitName: defaultBu.name,
  businessUnitContext: buildBusinessUnitGuidance(defaultBu.id),
  profileUrl: "https://www.linkedin.com/in/prosper-demo",
  objective: "Ser reconhecido por liderancas de RH como referencia em IA aplicada a educacao corporativa.",
  headline: "Educacao corporativa e IA aplicada ao desenvolvimento de talentos para empresas",
  about:
    "Ajudo liderancas e times de RH a aplicar IA em programas de desenvolvimento com criterio, contexto humano e impacto real no negocio.",
  themes: "IA aplicada a RH, educacao corporativa, desenvolvimento de talentos",
  proofPoints: "Cases com clientes, projetos de treinamento e resultados relatados por liderancas.",
  recentContent: "Posts, artigos e comentarios sobre aprendizagem corporativa e IA.",
  interactionSignals: "Conversas com RH, diretores, gestores de treinamento e decisores.",
};

test("authority assessment returns a bounded commercial authority score", () => {
  const assessment = createAuthorityAssessment(baseInput);

  assert.equal(assessment.input.businessUnitName, defaultBu.name);
  assert.equal(assessment.dimensions.length, 20);
  assert.ok(assessment.overallScore >= 0);
  assert.ok(assessment.overallScore <= 100);
  assert.ok(assessment.sources.some((source) => source.confidence === "confirmed"));
  assert.ok(assessment.nextActions.includes("Comparar evolucao"));
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
