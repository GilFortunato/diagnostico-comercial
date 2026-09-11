import assert from "node:assert/strict";
import test from "node:test";
import { buildLinkedInOutreachMessage, firstName } from "@/components/hr-hunting/outreachMessage";
import type { HrCandidate, HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";

test("mensagem de LinkedIn usa o primeiro nome da conta logada e o link da vaga", () => {
  const message = buildLinkedInOutreachMessage(candidate(), search(), "Gil Fortunato");
  assert.match(message, /Eu sou Gil/);
  assert.match(message, /Analista de Contratos/);
  assert.match(message, /Blue Fleet/);
  assert.match(message, /https:\/\/jobs\.inhire\.app\/vaga-123/);
  assert.doesNotMatch(message, /Amanda Recrutadora/);
});

test("nome da conta funciona para outros usuários sem inferir gênero", () => {
  assert.equal(firstName("Amanda Souza"), "Amanda");
  assert.equal(firstName("Rogério Silva"), "Rogério");
  assert.match(buildLinkedInOutreachMessage(candidate(), search(), "Rogério Silva"), /Eu sou Rogério/);
});

function candidate(): HrCandidate {
  return {
    id: "candidate-1",
    name: "Maria Oliveira",
    currentTitle: "Analista de Suprimentos",
    currentCompany: "Empresa X",
    location: "Campinas, SP",
    profileUrl: "https://www.linkedin.com/in/maria-oliveira",
    fitScore: 82,
    fitClassification: "Alta",
    pointsToValidate: [],
    sourceName: "fixture",
    confidence: "confirmado",
    evidence: [],
    contacts: [],
    shortlisted: false,
  };
}

function search(): HrHuntingSearchSnapshot {
  return {
    id: "search-1",
    title: "Analista de Contratos",
    jobDescription: "Descrição da vaga",
    jobUrl: "https://jobs.inhire.app/vaga-123",
    companyName: "Blue Fleet",
    recruiterName: "Amanda Recrutadora",
    jobDna: {
      title: "Analista de Contratos",
      shortSummary: "Gestão de contratos e fornecedores.",
      responsibilities: [],
      criteria: [],
      interviewChecks: [],
    },
    searchTerms: [],
    status: "results_ready",
    connectorWarnings: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    candidates: [],
  };
}
