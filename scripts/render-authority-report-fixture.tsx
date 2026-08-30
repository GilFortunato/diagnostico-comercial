import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitDna } from "../src/lib/business-units/dna";
import { createAuthorityAssessment } from "../src/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan } from "../src/lib/diagnostics/authorityPlan";
import { AuthorityReportDocument } from "../src/lib/reports/authorityReportDocument";
import type { AuthorityReportSnapshot } from "../src/lib/reports/authorityReportModel";

const businessUnit = getBusinessUnitDna(defaultBusinessUnitId);
const assessment = createAuthorityAssessment({
  businessUnitId: businessUnit.id,
  businessUnitName: businessUnit.name,
  businessUnitContext: buildBusinessUnitGuidance(businessUnit.id),
  profileUrl: "https://www.linkedin.com/in/perfil-executivo",
  objective: "Fortalecer autoridade comercial com lideranças de empresas.",
  headline: "Estratégia de aprendizagem, IA aplicada e desenvolvimento de lideranças",
  about: "Atuo na conexão entre aprendizagem, tecnologia e transformação de negócios, com experiência em projetos corporativos e desenvolvimento de lideranças.",
  themes: "IA aplicada, aprendizagem corporativa, liderança",
  proofPoints: "Projetos corporativos, casos documentados e resultados validados por clientes.",
  recentContent: "Conteúdos sobre aprendizagem corporativa, liderança e aplicação responsável de IA.",
  interactionSignals: "Conversas com diretores, lideranças de RH e gestores de aprendizagem.",
});

assessment.id = "assessment-report-visual-fixture";
assessment.createdAt = "2026-08-30T12:00:00.000Z";

const snapshot: AuthorityReportSnapshot = {
  id: assessment.id,
  ownerId: "visual-fixture-owner",
  ownerEmail: "fixture@example.com",
  subjectName: "Ana Estratégia",
  businessUnitId: businessUnit.id,
  assessment,
  plan30Days: createStructuredAuthorityThirtyDayPlan({ assessment }),
  createdAt: new Date(assessment.createdAt),
};

const outputDirectory = path.join(process.cwd(), "output", "pdf");
const outputPath = path.join(outputDirectory, "share-ai-authority-report-fixture.pdf");
const document = createElement(AuthorityReportDocument, { snapshot }) as unknown as Parameters<typeof renderToBuffer>[0];
const buffer = await renderToBuffer(document);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, buffer);
console.log(outputPath);
