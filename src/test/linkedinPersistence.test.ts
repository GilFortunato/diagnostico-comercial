import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isLinkedInProfileUrl } from "@/lib/profiles/linkedinProfileUrl";
import { normalizeLinkedInPayload } from "@/lib/connectors/linkedinNormalization";
import { executeAuthorityPipeline } from "@/lib/diagnostics/authorityPipeline";
import { createAuthorityAssessment } from "@/lib/diagnostics/authority";
import { buildBusinessUnitGuidance, getBusinessUnitDna } from "@/lib/business-units/dna";

test("validação aceita perfil pessoal e rejeita empresa ou outro domínio", () => {
  assert.equal(isLinkedInProfileUrl("https://www.linkedin.com/in/pessoa"), true);
  assert.equal(isLinkedInProfileUrl("https://www.linkedin.com/company/empresa"), false);
  assert.equal(isLinkedInProfileUrl("https://example.com/in/pessoa"), false);
});

test("snapshot normalizado de perfil e posts chega ao motor uma única vez", async () => {
  const bu = getBusinessUnitDna("bu_prosper");
  const normalized = normalizeLinkedInPayload({
    profileUrl: "https://www.linkedin.com/in/pessoa",
    profile: { headline: "Especialista em IA aplicada", about: "Atuação em transformação e negócios.", skills: ["IA aplicada"] },
    posts: [{ text: "IA aplicada começa pelo problema de negócio.", publishedAt: "2026-08-20" }],
  });
  let collectionCalls = 0;
  let receivedSnapshot = false;
  await executeAuthorityPipeline({
    businessUnitId: bu.id,
    businessUnitName: bu.name,
    businessUnitContext: buildBusinessUnitGuidance(bu.id),
    profileUrl: normalized.profileUrl,
    objective: "Fortalecer autoridade comercial com lideranças empresariais.",
    headline: "",
    about: "",
    themes: "",
    proofPoints: "",
    recentContent: "",
    interactionSignals: "",
  }, {
    extractProfile: async () => {
      collectionCalls += 1;
      return { input: { headline: normalized.headline }, sources: [], snapshot: normalized };
    },
    createAssessment: async (input, sources) => {
      receivedSnapshot = input.linkedinSnapshot === normalized;
      return createAuthorityAssessment(input, sources);
    },
  });
  assert.equal(collectionCalls, 1);
  assert.equal(receivedSnapshot, true);
});

test("histórico oficial não usa localStorage e PDF não importa coletores", async () => {
  const diagnosticUi = await readFile("src/components/diagnostics/AuthorityDiagnostic.tsx", "utf8");
  const reportRoute = await readFile("src/app/api/diagnostics/authority/[id]/report/route.ts", "utf8");
  const reportModel = await readFile("src/lib/reports/authorityReportModel.ts", "utf8");
  assert.doesNotMatch(diagnosticUi, /localStorage/);
  assert.doesNotMatch(`${reportRoute}\n${reportModel}`, /apifyLinkedIn|authorityProvider|geminiClient/);
});

test("pipeline Apify integra o Actor de perfil e o de publicações com limite controlado", async () => {
  const source = await readFile("src/lib/connectors/apifyLinkedIn.ts", "utf8");
  assert.match(source, /linkedinProfilePosts/);
  assert.match(source, /maxPosts: 8/);
  assert.match(source, /snapshot/);
});

test("migração preserva snapshots históricos ao adicionar perfil profissional", async () => {
  const migration = await readFile("prisma/migrations/20260830203000_add_users_profiles_permissions/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "User"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "ProfessionalProfile"/);
  assert.match(migration, /ALTER TABLE "AuthorityAssessmentSnapshot"\s+ADD COLUMN IF NOT EXISTS/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});
