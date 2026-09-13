import assert from "node:assert/strict";
import test from "node:test";
import { parseHumanshipCsv, normalizeHumanshipRows } from "@/lib/humanship/importRows";
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

test("Humanship imports rows even when the spreadsheet has a preamble", () => {
  const rows = normalizeHumanshipRows([
    ["Lista de participantes - evento"],
    ["Nome completo", "E-mail", "Empresa", "Cargo"],
    ["Ana Pessoa", "ana@example.com", "Empresa A", "Head of People"],
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fullName, "Ana Pessoa");
  assert.equal(rows[0].company, "Empresa A");
});

test("Humanship accepts English name headers", () => {
  const rows = normalizeHumanshipRows([
    ["Full name", "Email", "Company", "Job title"],
    ["Taylor Example", "taylor@example.com", "Example Co", "CPO"],
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fullName, "Taylor Example");
});

test("Humanship parses semicolon CSV exports", () => {
  const csv = 'Nome;E-mail;Empresa;Cargo\n"Maria Silva";maria@example.com;Acme;"Diretora de RH"\n';
  const bytes = new TextEncoder().encode(csv);
  const rows = parseHumanshipCsv(bytes.buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "maria@example.com");
  assert.equal(rows[0].jobTitle, "Diretora de RH");
});
