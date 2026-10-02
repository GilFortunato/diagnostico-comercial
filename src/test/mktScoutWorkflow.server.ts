import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { createScoutStore, isFresh, recordId } from "../lib/scout/mkt/store";
import { createScoutService } from "../lib/scout/mkt/service";
import { createContentGenerator } from "../lib/scout/mkt/generation";
import { runCopyAgent } from "../lib/scout/mkt/copyAgent";
import { createEditorialAnalysis, editorialCopy } from "../lib/scout/mkt/editorial";
import { analyzeSignals } from "../lib/scout/mkt/signals";
import { SOURCE_REGISTRY, type SourceCollection } from "../lib/scout/mkt/sources";
import type { Signal, SourceId } from "../lib/scout/mkt/types";
import { contentRequestSchema, radarRequestSchema, readBody } from "../lib/scout/mkt/http";

// All evidence in this file is synthetic test data, never used by production collectors.
const signal = (now = new Date()): Signal => ({
  id: "test-signal", source: "agencia-brasil", sourceType: "news",
  title: "TESTE: inteligência artificial no recrutamento e trabalho",
  url: "https://example.com/test-signal", publisher: "Fonte de teste",
  publishedAt: new Date(now.getTime() - 3_600_000).toISOString(), detectedAt: now.toISOString(),
  rawMetrics: {}, evidence: ["Manchete sintética exclusiva do teste."], confidence: 0.8, geography: "BR",
});
const collection = (id: SourceId, now: Date, unavailable = false): SourceCollection => ({
  signals: id === "agencia-brasil" && !unavailable ? [signal(now)] : [],
  status: { id, name: id, status: unavailable ? "unavailable" : id === "agencia-brasil" ? "ok" : "empty",
    count: id === "agencia-brasil" && !unavailable ? 1 : 0, collectedAt: now.toISOString(), message: "Teste" },
});
const fakeModel = (evidenceIds = ["test-signal"]) => new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: "text", text: JSON.stringify({ title: "Rascunho de teste", body: "Este rascunho de teste apresenta a evidência fornecida e uma pergunta editorial.", evidenceIds }) }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
    warnings: [],
  }),
});

test("radar collects independently, caches source results and never requires keys", async () => {
  const store = createScoutStore();
  let calls = 0;
  const service = createScoutService(store, async (id, options) => { calls++; return collection(id, options?.now ?? new Date()); });
  const first = await service.radar("share");
  assert.equal(first.trends.length, 1);
  assert.equal(calls, 4);
  assert.equal(first.cache.persistent, false);
  const second = await service.radar("potencia");
  assert.equal(calls, 4);
  assert.equal(second.cache.status, "cached");
  assert.notEqual(second.trends[0].brandRelevance.reason, first.trends[0].brandRelevance.reason);
});

test("expired source update retains only recent confirmed data and original collection date", async () => {
  const start = new Date();
  let now = start;
  let failing = false;
  const service = createScoutService(createScoutStore(), async (id, options) => collection(id, options?.now ?? now, failing), () => now);
  const original = await service.radar("share");
  failing = true; now = new Date(start.getTime() + 2 * 3_600_000);
  const stale = await service.radar("share");
  assert.equal(stale.trends.length, 1);
  assert.equal(stale.sources.find((source) => source.id === "agencia-brasil")?.status, "stale");
  assert.equal(stale.trends[0].firstDetectedAt, original.trends[0].firstDetectedAt);
  assert.equal(stale.sources.find((source) => source.id === "agencia-brasil")?.collectedAt, start.toISOString());
  now = new Date(start.getTime() + 5 * 86_400_000);
  const expired = await service.radar("share");
  assert.equal(expired.trends.length, 0);
});

test("one adapter throwing does not discard other sources", async () => {
  const service = createScoutService(createScoutStore(), async (id, options) => {
    if (id === "youtube") throw new Error("test timeout");
    return collection(id, options?.now ?? new Date());
  });
  const radar = await service.radar("share");
  assert.equal(radar.trends.length, 1);
  assert.equal(radar.sources.find((source) => source.id === "youtube")?.status, "unavailable");
});
test("total outage creates no trends or invented opportunities", async () => {
  const service = createScoutService(createScoutStore(), async (id) => collection(id, new Date(), true));
  const radar = await service.radar("share");
  assert.deepEqual(radar.trends, []);
  assert.equal(radar.sources.filter((source) => source.status === "unavailable").length, 4);
  await assert.rejects(() => service.analysis("unknown", "share"), /não está mais/);
});
test("same request shares one collection, query cache stays separate", async () => {
  let calls = 0;
  const service = createScoutService(createScoutStore(), async (id) => { calls++; await new Promise((resolve) => setTimeout(resolve, 3)); return collection(id, new Date()); });
  await Promise.all([service.radar("share"), service.radar("share")]);
  assert.equal(calls, SOURCE_REGISTRY.length);
  await service.radar("share", "tema diferente");
  assert.equal(calls, SOURCE_REGISTRY.length * 2);
});
test("analysis is context-specific, all opportunities retain angle/audience/structure, visual needs no key", () => {
  const trend = analyzeSignals([signal()], "share")[0];
  const share = createEditorialAnalysis(trend, "share");
  const ache = createEditorialAnalysis(trend, "ache");
  assert.notEqual(share.id, ache.id);
  assert.equal(share.opportunities.length, 8);
  for (const opportunity of share.opportunities) {
    assert.ok(opportunity.angle.includes(trend.title));
    assert.ok(opportunity.hook.includes(trend.title));
    assert.ok(opportunity.audience && opportunity.objective && opportunity.cta && opportunity.rationale);
    assert.ok(opportunity.structure.length >= 3);
  }
  assert.ok(share.visual.avoid.includes("Robôs humanoides"));
  assert.ok(share.visual.channels.some((channel) => channel.format === "9:16"));
  assert.ok(ache.risks.some((risk) => risk.includes("terapêutica")));
  const carousel = editorialCopy(trend, "share", share.opportunities[1]);
  assert.match(carousel.body, /Lâmina 5/);
  assert.match(carousel.body, /Fonte de teste/);
});
test("local persistence survives new store and owner-scopes generations", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mkt-scout-test-"));
  try {
    const first = createScoutStore(folder);
    await first.put("generation", "test-id", { marker: "private" }, { ownerId: "user-a" });
    const restarted = createScoutStore(folder);
    assert.equal((await restarted.get("generation", "test-id", "user-a"))?.persistent, true);
    assert.equal(await restarted.get("generation", "test-id", "user-b"), null);
    assert.notEqual(recordId("generation", "test-id", "user-a"), recordId("generation", "test-id", "user-b"));
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test("AI agent validates structured output and rejects fabricated evidence IDs", async () => {
  const trend = analyzeSignals([signal()], "share")[0];
  const analysis = createEditorialAnalysis(trend, "share");
  const result = await runCopyAgent({ model: fakeModel(), trend, brandId: "share", analysis, opportunity: analysis.opportunities[0] });
  assert.equal(result.usage.inputTokens, 10);
  assert.equal(result.usage.outputTokens, 20);
  await assert.rejects(() => runCopyAgent({ model: fakeModel(["invented"]), trend, brandId: "share", analysis, opportunity: analysis.opportunities[0] }), /Unsupported evidence/);
});
test("missing persistence skips paid model, returns labelled editorial draft and reuses it", async () => {
  const store = createScoutStore();
  const trend = analyzeSignals([signal()], "share")[0];
  const analysis = createEditorialAnalysis(trend, "share");
  let resolved = 0;
  const generator = createContentGenerator({ store, analysis: async () => ({ trend, analysis, persistent: false }), resolveModel: async () => { resolved++; return null; } });
  const input = { trendId: trend.id, brandId: "share" as const, opportunityId: "linkedin", userId: "a" };
  const generated = await generator.generate(input);
  assert.equal(generated.mode, "editorial");
  assert.equal(generated.persistent, false);
  assert.equal(resolved, 0);
  assert.equal((await generator.generate(input)).id, generated.id);
  await assert.rejects(() => generator.get(generated.id, "b"), /não encontrado/);
});
test("durable generation stores pending before model, keeps usage and deduplicates concurrent calls", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mkt-scout-generation-"));
  try {
    const store = createScoutStore(folder);
    const trend = analyzeSignals([signal()], "share")[0];
    const analysis = createEditorialAnalysis(trend, "share");
    let pending = false;
    const originalPut = store.put;
    store.put = async (...args) => {
      const result = await originalPut(...args);
      if ((args[2] as { status?: string }).status === "pending") pending = result.persistent;
      return result;
    };
    let calls = 0;
    const generator = createContentGenerator({
      store, analysis: async () => ({ trend, analysis, persistent: true }),
      resolveModel: async () => ({ model: fakeModel(), modelId: "test-model" }),
      runAgent: async (input) => { assert.equal(pending, true); calls++; return runCopyAgent(input); },
    });
    const input = { trendId: trend.id, brandId: "share" as const, opportunityId: "linkedin", userId: "a" };
    const [first, second] = await Promise.all([generator.generate(input), generator.generate(input)]);
    assert.equal(first.id, second.id); assert.equal(calls, 1);
    assert.equal(first.mode, "ai"); assert.equal(first.persistent, true);
    assert.deepEqual(first.sourceUrls, ["https://example.com/test-signal"]);
    assert.equal(first.usage.costUsd, null);
    const restart = createContentGenerator({ store: createScoutStore(folder), analysis: async () => ({ trend, analysis, persistent: true }) });
    assert.equal((await restart.get(first.id, "a")).body, first.body);
    assert.equal((await restart.generate(input)).cached, true);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test("provider failure retains usable editorial draft with explicit notice", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mkt-scout-fallback-"));
  try {
    const trend = analyzeSignals([signal()], "share")[0];
    const analysis = createEditorialAnalysis(trend, "share");
    const generator = createContentGenerator({
      store: createScoutStore(folder), analysis: async () => ({ trend, analysis, persistent: true }),
      resolveModel: async () => { throw new Error("test provider unavailable"); },
    });
    const result = await generator.generate({ trendId: trend.id, brandId: "share", opportunityId: "short", userId: "a" });
    assert.equal(result.mode, "editorial");
    assert.match(result.notice!, /indisponível/);
    assert.match(result.body, /ABERTURA/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test("request validation rejects injected signals, unsupported brands and oversized/cross-origin bodies", async () => {
  assert.equal(radarRequestSchema.safeParse({ brand: "invalid" }).success, false);
  assert.equal(radarRequestSchema.safeParse({ q: "x" }).success, false);
  assert.equal(contentRequestSchema.safeParse({ trendId: "x", brandId: "share", opportunityId: "linkedin", signals: [] }).success, false);
  await assert.rejects(() => readBody(new Request("https://example.com/api", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" })), /Origem/);
  await assert.rejects(() => readBody(new Request("https://example.com/api", { method: "POST", body: "x".repeat(5000) })), /muito grande/);
});
test("TTL helper expires records without pretending a failed read is fresh", async () => {
  const store = createScoutStore();
  assert.equal(isFresh(null), false);
  const value = await store.put("source", "key", {}, { ttlMs: 100 });
  assert.equal(isFresh(value, Date.now() + 1000), false);
});
