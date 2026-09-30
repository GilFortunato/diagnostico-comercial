import assert from "node:assert/strict";
import test from "node:test";
import { collectHuntingPages } from "@/lib/hunting/pagination";
import { candidateKey, collectHrDiscovery, readDiscoveryState, type HrDiscoveryState } from "@/lib/hr-hunting/pagedDiscovery";
import type { HrCandidate } from "@/lib/hr-hunting/types";

const person = (id: number): HrCandidate => ({ id: String(id), name: `Pessoa ${id}`, currentTitle: "Analista de RH", profileUrl: `https://www.linkedin.com/in/fixture-${id}`, fitScore: 0, fitClassification: "Parcial", pointsToValidate: [], sourceName: "fixture", confidence: "provável", contacts: [], evidence: [], shortlisted: false });
const state = (): HrDiscoveryState => ({ version: 1, fingerprint: "corpus", pending: [], rounds: [{ input: { currentJobTitles: ["Analista de RH"] }, nextPage: 1, exhausted: false }] });

test("coleta completa 50 com lotes curtos e sobrepostos, sem parar em 30", async () => {
  const pages: number[] = [];
  const result = await collectHuntingPages({ target: 50, key: String, fetchPage: async (page) => {
    pages.push(page.startPage);
    const start = page.startPage === 1 ? 0 : page.startPage === 3 ? 20 : 40;
    return { items: Array.from({ length: 30 }, (_, i) => start + i), exhausted: false };
  } });
  assert.deepEqual(pages, [1, 3]);
  assert.equal(result.items.length, 50);
  assert.equal(result.summary.duplicates, 10);
  assert.equal(result.summary.stopReason, "target_reached");
});

test("falha posterior preserva resultados e a página para nova tentativa", async () => {
  const result = await collectHuntingPages({ target: 50, key: String, fetchPage: async (page) => {
    if (page.startPage > 1) throw new Error("offline");
    return { items: [1, 2], exhausted: false };
  } });
  assert.deepEqual(result.items, [1, 2]);
  assert.equal(result.summary.nextPage, 3);
  assert.equal(result.summary.stopReason, "provider_error");
});

test("fonte sem progresso encerra com limite de custo", async () => {
  const result = await collectHuntingPages({ target: 50, key: String, fetchPage: async () => ({ items: [1], exhausted: false }) });
  assert.equal(result.summary.requests, 3);
  assert.equal(result.summary.stopReason, "no_progress");
});

test("respeita o orçamento de tempo antes de abrir outra chamada", async () => {
  let now = 0;
  const result = await collectHuntingPages({ target: 50, key: String, now: () => now, timeoutMs: 2_000, fetchPage: async () => {
    now = 2_000;
    return { items: [1], exhausted: false };
  } });
  assert.equal(result.summary.requests, 1);
  assert.equal(result.summary.stopReason, "time_limit");
});

test("HR usa páginas seguintes para completar 50 mesmo após lote de 30", async () => {
  const pages: number[] = [];
  const result = await collectHrDiscovery({ state: state(), target: 50, normalize: (raw) => raw as HrCandidate[], fetchPage: async (_input, page) => {
    pages.push(page.startPage);
    const offset = page.startPage === 1 ? 0 : 30;
    return Array.from({ length: 30 }, (_, i) => person(i + offset));
  } });
  assert.deepEqual(pages, [1, 3]);
  assert.equal(result.items.length, 60, "preserva o lote completo para ranking");
  assert.equal(result.state.rounds[0].nextPage, 5);
  assert.equal(result.summary.stopReason, "target_reached");
});

test("HR carregar mais reaproveita pendentes e avança sem repetir a primeira página", async () => {
  const previous = state();
  previous.rounds[0].nextPage = 5;
  previous.pending = Array.from({ length: 10 }, (_, i) => person(50 + i));
  const pages: number[] = [];
  const result = await collectHrDiscovery({ state: previous, target: 20, excludedKeys: new Set(Array.from({ length: 50 }, (_, i) => candidateKey(person(i)))), normalize: (raw) => raw as HrCandidate[], fetchPage: async (_input, page) => {
    pages.push(page.startPage);
    return Array.from({ length: 30 }, (_, i) => person(45 + i));
  } });
  assert.deepEqual(pages, [5]);
  assert.equal(result.items.length, 25);
  assert.equal(new Set(result.items.map(candidateKey)).size, 25);
  assert.ok(result.items.every((candidate) => Number(candidate.id) >= 50));
});

test("HR lote pendente suficiente evita qualquer chamada paga", async () => {
  const previous = state();
  previous.pending = Array.from({ length: 25 }, (_, i) => person(i));
  const result = await collectHrDiscovery({ state: previous, target: 20, normalize: () => [], fetchPage: async () => { throw new Error("não chamar"); } });
  assert.equal(result.summary.requests, 0);
  assert.equal(result.items.length, 25);
});

test("cursor antigo ou de outro filtro não é reutilizado", () => {
  assert.equal(readDiscoveryState([], "corpus"), null);
  assert.equal(readDiscoveryState(state(), "outro-recorte"), null);
  assert.ok(readDiscoveryState(state(), "corpus"));
});

test("HR reconhece o mesmo candidato sem URL antes e depois de persistir", () => {
  const candidate = { ...person(1), profileUrl: undefined };
  assert.equal(candidateKey(candidate), candidateKey({ ...candidate, id: "1_search-id" }));
});
