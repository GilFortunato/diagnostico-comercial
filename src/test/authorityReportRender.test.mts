import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { writeFile } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { AuthorityReportDocument } from "@/lib/reports/authorityReportDocument";
import type { AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";

function reportFixture(): AuthorityReportSnapshot {
  const businessUnit = getBusinessUnitDna(defaultBusinessUnitId);
  const assessment = createAuthorityAssessment({
    businessUnitId: businessUnit.id,
    businessUnitName: businessUnit.name,
    businessUnitContext: buildBusinessUnitGuidance(businessUnit.id),
    profileUrl: "https://www.linkedin.com/in/perfil-executivo",
    objective: "Fortalecer autoridade comercial com lideranças de empresas.",
    headline: "Estratégia de aprendizagem, IA aplicada e desenvolvimento de lideranças",
    about: "Atuo na conexão entre aprendizagem, tecnologia e transformação de negócios.",
    themes: "IA aplicada, aprendizagem corporativa, liderança",
    proofPoints: "Projetos corporativos, casos documentados e resultados validados por clientes.",
    recentContent: "Conteúdos sobre aprendizagem corporativa, liderança e aplicação responsável de IA.",
    interactionSignals: "Conversas com diretores, lideranças de RH e gestores de aprendizagem.",
  });

  assessment.id = "assessment-report-render-fixture";
  assessment.createdAt = "2026-08-30T12:00:00.000Z";
  assessment.analyzedProfileName = "Ana Estratégia";

  return {
    id: assessment.id,
    ownerId: "owner-1",
    ownerEmail: "owner@example.com",
    subjectName: "Usuário logado",
    businessUnitId: businessUnit.id,
    assessment,
    plan30Days: createStructuredAuthorityThirtyDayPlan({ assessment }),
    createdAt: new Date(assessment.createdAt),
  };
}

test("real renderer creates selectable vector PDF bytes without provider credentials", async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousApify = process.env.APIFY_TOKEN;
  delete process.env.GEMINI_API_KEY;
  delete process.env.APIFY_TOKEN;

  try {
    const document = createElement(AuthorityReportDocument, { snapshot: reportFixture() }) as unknown as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(document);
    assert.equal(buffer.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(buffer.byteLength > 20_000);
    if (process.env.REPORT_QA_OUTPUT) await writeFile(process.env.REPORT_QA_OUTPUT, buffer);
  } finally {
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    if (previousApify === undefined) delete process.env.APIFY_TOKEN;
    else process.env.APIFY_TOKEN = previousApify;
  }
});
