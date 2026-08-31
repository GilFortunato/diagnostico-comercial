import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildAuthorityReportFilename, buildAuthorityReportViewModel, type AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";
import { createAuthorityReportResponse } from "@/lib/reports/authorityReportRoute";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";

const fixtureBu = getBusinessUnitDna(defaultBusinessUnitId);

function reportFixture({ withPlan = true }: { withPlan?: boolean } = {}): AuthorityReportSnapshot {
  const assessment = createAuthorityAssessment({
    businessUnitId: fixtureBu.id,
    businessUnitName: fixtureBu.name,
    businessUnitContext: buildBusinessUnitGuidance(fixtureBu.id),
    profileUrl: "https://www.linkedin.com/in/perfil-executivo",
    objective: "Fortalecer autoridade comercial com lideranças de empresas.",
    headline: "Estratégia de aprendizagem, IA aplicada e desenvolvimento de lideranças",
    about: "Atuo na conexão entre aprendizagem, tecnologia e transformação de negócios, com experiência em projetos corporativos e desenvolvimento de lideranças.",
    themes: "IA aplicada, aprendizagem corporativa, liderança",
    proofPoints: "Projetos corporativos, cases documentados e resultados validados por clientes.",
    recentContent: "Posts e artigos sobre aprendizagem corporativa, liderança e aplicação responsável de IA.",
    interactionSignals: "Conversas com diretores, lideranças de RH e gestores de aprendizagem.",
  });
  assessment.id = "assessment-report-fixture";
  assessment.createdAt = "2026-08-30T12:00:00.000Z";
  assessment.authoritySellingScore = 74;
  assessment.overallScore = 74;
  assessment.buAffinityScore = 61;
  assessment.activationPotentialScore = 79;

  return {
    id: assessment.id,
    ownerId: "owner-1",
    ownerEmail: "owner@example.com",
    subjectName: "Ana Estratégia / Conselho",
    businessUnitId: fixtureBu.id,
    assessment,
    plan30Days: withPlan ? createStructuredAuthorityThirtyDayPlan({ assessment }) : null,
    createdAt: new Date(assessment.createdAt),
  };
}

test("authenticated owner receives a valid PDF response", async () => {
  const snapshot = reportFixture();
  const expectedBytes = Buffer.from("%PDF-1.7\nfixture");
  const response = await createAuthorityReportResponse({
    assessmentId: snapshot.id,
    user: { id: snapshot.ownerId, email: snapshot.ownerEmail },
    dependencies: {
      findSnapshot: async () => snapshot,
      renderReport: async () => expectedBytes,
      isAdmin: () => false,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.match(response.headers.get("Content-Disposition") ?? "", /^attachment; filename="ShareAI_Diagnostico_LinkedIn_/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBytes);
});

test("unauthenticated user is blocked before snapshot lookup and rendering", async () => {
  let lookups = 0;
  let renders = 0;
  const response = await createAuthorityReportResponse({
    assessmentId: "assessment-1",
    user: null,
    dependencies: {
      findSnapshot: async () => { lookups += 1; return reportFixture(); },
      renderReport: async () => { renders += 1; return Buffer.from("%PDF"); },
      isAdmin: () => false,
    },
  });

  assert.equal(response.status, 401);
  assert.equal(lookups, 0);
  assert.equal(renders, 0);
});

test("user cannot export another user's assessment", async () => {
  let renders = 0;
  const response = await createAuthorityReportResponse({
    assessmentId: "assessment-1",
    user: { id: "other-user", email: "other@example.com" },
    dependencies: {
      findSnapshot: async () => reportFixture(),
      renderReport: async () => { renders += 1; return Buffer.from("%PDF"); },
      isAdmin: () => false,
    },
  });

  assert.equal(response.status, 403);
  assert.equal(renders, 0);
});

test("administrator can export an authorized assessment", async () => {
  const response = await createAuthorityReportResponse({
    assessmentId: "assessment-1",
    user: { id: "admin-user", email: "admin@example.com" },
    dependencies: {
      findSnapshot: async () => reportFixture(),
      renderReport: async () => Buffer.from("%PDF-1.7\nadmin"),
      isAdmin: (email) => email === "admin@example.com",
    },
  });

  assert.equal(response.status, 200);
});

test("missing assessment returns 404 without rendering", async () => {
  let renders = 0;
  const response = await createAuthorityReportResponse({
    assessmentId: "missing",
    user: { id: "owner-1", email: "owner@example.com" },
    dependencies: {
      findSnapshot: async () => null,
      renderReport: async () => { renders += 1; return Buffer.from("%PDF"); },
      isAdmin: () => false,
    },
  });

  assert.equal(response.status, 404);
  assert.equal(renders, 0);
});

test("filename is sanitized and cannot inject headers", () => {
  const filename = buildAuthorityReportFilename("João / Diretoria\r\nContent-Type: text/html", "2026-08-30T12:00:00.000Z");
  assert.equal(filename, "ShareAI_Diagnostico_LinkedIn_Joao_Diretoria_Content_Type_text_html_2026-08-30.pdf");
  assert.equal(/[\r\n/\\]/.test(filename), false);
});

test("view model preserves every persisted score exactly", () => {
  const model = buildAuthorityReportViewModel(reportFixture());
  assert.deepEqual(model.scores, { authority: 74, businessUnitAffinity: 61, activationPotential: 79 });
});

test("missing optional report fields are omitted without fabrication", () => {
  const snapshot = reportFixture({ withPlan: false });
  snapshot.subjectName = null;
  snapshot.assessment.input.headline = "";
  snapshot.assessment.profileReview = [];
  snapshot.assessment.bridgeOpportunities = [];
  snapshot.assessment.sources = [];
  snapshot.assessment.strengths = [];
  snapshot.assessment.gaps = [];
  snapshot.assessment.opportunities = [];
  snapshot.assessment.recommendations = [];
  snapshot.assessment.personalAuthorityPlan = { cycleLabel: "", priority: "", progressLabel: "", actions: [] };
  snapshot.assessment.nextActions = [];

  const model = buildAuthorityReportViewModel(snapshot);
  assert.equal(model.subjectName, null);
  assert.equal(model.headline, null);
  assert.equal(model.plan, null);
  assert.deepEqual(model.bridges, []);
  assert.deepEqual(model.sources, []);
  assert.equal(model.nextBestAction?.priority, snapshot.assessment.nextBestAction.title);
});

test("technical-term filtering does not corrupt ordinary Portuguese words", () => {
  const snapshot = reportFixture({ withPlan: false });
  snapshot.assessment.sources = [{
    title: "Capitais em transformação",
    confidence: "confirmed",
    notes: "Capitais estratégicas consideradas na análise.",
  }];

  const [source] = buildAuthorityReportViewModel(snapshot).sources;
  assert.equal(source.title, "Capitais em transformação");
  assert.equal(source.notes, "Capitais estratégicas consideradas na análise.");
});

test("report export modules have zero imports from AI and extraction providers", async () => {
  const root = process.cwd();
  const files = [
    "src/app/api/diagnostics/authority/[id]/report/route.ts",
    "src/lib/reports/authorityReportRoute.ts",
    "src/lib/reports/authorityReportRenderer.tsx",
    "src/lib/reports/authorityReportDocument.tsx",
    "src/lib/reports/authorityReportModel.ts",
  ];
  const source = (await Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")))).join("\n");

  assert.doesNotMatch(source, /authorityProvider|authorityContentProvider|geminiClient|apifyLinkedIn|extractLinkedIn/i);
});
