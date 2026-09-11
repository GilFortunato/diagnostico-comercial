import assert from "node:assert/strict";
import test from "node:test";
import { assessCompanyRestriction, assessRole, classifyHumanshipParticipant } from "@/lib/humanship/restrictions";

test("Humanship accepts clear executive People titles", () => {
  assert.equal(assessRole("Diretora Executiva de Gente e Cultura").classification, "eligible");
  assert.equal(assessRole("Head of People & Culture").classification, "eligible");
});

test("Humanship sends ambiguous or nearby HR titles to validation", () => {
  assert.equal(assessRole("CPO").classification, "validate");
  assert.equal(assessRole("Gerente de RH").classification, "validate");
  assert.equal(assessRole("Coordenadora de RH").classification, "validate");
});

test("Humanship keeps low-seniority HR titles as possible rejected", () => {
  assert.equal(assessRole("Analista de Recursos Humanos").classification, "possible_rejected");
});

test("Humanship identifies company restrictions from the current mapping", () => {
  assert.equal(assessCompanyRestriction("InHire").restricted, true);
  assert.equal(assessCompanyRestriction("Robert Half Brasil").restricted, true);
  assert.equal(assessCompanyRestriction("Empresa sem restrição").restricted, false);
});

test("company restriction always becomes possible rejected but stays reviewable", () => {
  const result = classifyHumanshipParticipant({
    sourceCompany: "Gupy",
    sourceTitle: "Chief People Officer",
    linkedinFound: true,
  });
  assert.equal(result.classification, "possible_rejected");
});
