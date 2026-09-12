import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLinkedInAlgorithmPlanPromptSection,
  linkedInStrategySources,
} from "@/lib/social-selling/linkedinAlgorithmStrategy";

test("plano de 30 dias ensina dwell time sem inventar métrica", () => {
  const prompt = buildLinkedInAlgorithmPlanPromptSection();
  assert.match(prompt, /Dwell Time/i);
  assert.match(prompt, /short dwell\/skip/i);
  assert.match(prompt, /NÃO recebe uma métrica individual de dwell time/i);
  assert.match(prompt, /primeiras 2–3 linhas/i);
  assert.match(prompt, /não.*primeira hora decide o post/i);
});

test("plano usa benchmarks de 2026 como hipótese e privilegia dados próprios", () => {
  const prompt = buildLinkedInAlgorithmPlanPromptSection();
  assert.match(prompt, /4,8 milhões de posts/i);
  assert.match(prompt, /15h e 20h/i);
  assert.match(prompt, /2 a 5 posts por semana/i);
  assert.match(prompt, /77% mais comentários/i);
  assert.match(prompt, /dia 14/i);
  assert.match(prompt, /histórico próprio/i);
  assert.match(prompt, /HIPÓTESE DE TESTE/i);
});

test("fontes distinguem oficial, estudo externo e heurística", () => {
  assert.ok(linkedInStrategySources.some((source) => source.id === "linkedin-dwell-time" && source.evidenceClass === "OFFICIAL"));
  assert.ok(linkedInStrategySources.some((source) => source.id === "buffer-best-time-2026" && source.evidenceClass === "EXTERNAL_STUDY"));
  assert.ok(linkedInStrategySources.some((source) => source.id === "metricool-linkedin-2026" && source.evidenceClass === "EXTERNAL_STUDY"));
  assert.ok(linkedInStrategySources.some((source) => source.id === "share-interest-graph" && source.evidenceClass === "SHARE_AI_HEURISTIC"));
});
