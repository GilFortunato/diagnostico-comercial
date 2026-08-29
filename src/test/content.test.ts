import assert from "node:assert/strict";
import test from "node:test";
import { createContentOpportunity } from "@/lib/content/intelligence";

test("content opportunity uses business unit DNA and STEPPS strategy", () => {
  const result = createContentOpportunity({
    businessUnitId: "bu_prosper",
    objective: "Criar pauta consultiva sobre IA aplicada ao trabalho.",
    personalVoice: "direta, pratica e com exemplos reais",
  });

  assert.equal(result.businessUnitName, "Prosper Digital Skills");
  assert.ok(result.adherenceScore >= 0);
  assert.ok(result.adherenceScore <= 100);
  assert.ok(result.stepps.some((item) => item.key === "Practical Value"));
  assert.ok(result.sources.some((source) => source.confidence === "confirmed"));
});
