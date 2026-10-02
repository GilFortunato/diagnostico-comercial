import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSignals, canonicalUrl, scoreBrandRelevance } from "../lib/scout/mkt/signals";
import type { Signal } from "../lib/scout/mkt/types";

const now = new Date("2026-10-02T12:00:00.000Z");
// Deterministic fixtures live only in tests; production collectors never import them.
function fixture(overrides: Partial<Signal> = {}): Signal {
  return { id: "fixture-1", source: "agencia-brasil", sourceType: "news", title: "Empresas ampliam recrutamento e gestão de pessoas", url: "https://example.test/noticia/1", publisher: "Agência Brasil", publishedAt: "2026-10-02T10:00:00.000Z", detectedAt: now.toISOString(), evidence: ["Manchete de teste."], rawMetrics: {}, confidence: 0.85, geography: "BR", ...overrides };
}

test("MKT score redistributes weights and does not manufacture volume or velocity", () => {
  const [trend] = analyzeSignals([fixture()], "share", now);
  assert.equal(trend.score.components.find((component) => component.key === "velocity")?.value, null);
  assert.equal(trend.score.components.find((component) => component.key === "volume")?.value, null);
  assert.equal(trend.score.components.find((component) => component.key === "velocity")?.weight, 0);
  assert.ok(Math.abs(trend.score.components.reduce((sum, component) => sum + component.weight, 0) - 1) < 0.00001);
  assert.match(trend.growthExplanation, /não é possível confirmar crescimento/);
});

test("MKT an accumulated count enables volume but never velocity", () => {
  const [trend] = analyzeSignals([fixture({ source: "youtube", sourceType: "video", rawMetrics: { views: 20000 } })], "share", now);
  assert.notEqual(trend.score.components.find((component) => component.key === "volume")?.value, null);
  assert.equal(trend.score.components.find((component) => component.key === "velocity")?.value, null);
});

test("MKT retains evidence across sources without treating same URL as corroboration", () => {
  const title = "Empresas ampliam recrutamento e gestão de pessoas";
  const signals = [fixture(), fixture({ id: "fixture-2", source: "hacker-news", sourceType: "community", publisher: "Hacker News", title, url: "https://www.example.test/noticia/1?utm_source=hn", geography: "global" })];
  const trends = analyzeSignals(signals, "share", now);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].signals.length, 2);
  assert.equal(trends[0].independentSourceCount, 1);
  assert.equal(trends[0].score.components.find((component) => component.key === "sourceDiversity")?.value, 0);
});

test("MKT identical syndicated headlines count once even on different domains", () => {
  const [trend] = analyzeSignals([fixture(), fixture({ id: "fixture-2", publisher: "Outlet Two", url: "https://another.example.test/story" })], "share", now);
  assert.equal(trend.signals.length, 2);
  assert.equal(trend.independentSourceCount, 1);
});

test("MKT distinct events with a broad common topic stay separate", () => {
  const trends = analyzeSignals([fixture({ title: "Inteligência artificial muda recrutamento em empresas brasileiras" }), fixture({ id: "fixture-2", title: "Inteligência artificial identifica medicamentos em pesquisa de saúde", url: "https://example.test/noticia/2" })], "potencia", now);
  assert.equal(trends.length, 2);
});

test("MKT recent related evidence keeps its unknown publication date and explicit association", () => {
  const parent = fixture({ id: "search-1", source: "google-trends", sourceType: "search", title: "recrutamento por inteligência artificial", publisher: "Google Trends", url: "https://trends.google.com/trends/explore?q=recrutamento" });
  const related = fixture({ id: "related-1", source: "google-trends", title: "Empresas testam robôs no processo seletivo", publishedAt: null, relatedSignalId: parent.id });
  const direct = fixture({ id: "direct-1", title: related.title });
  const [trend] = analyzeSignals([direct, related, parent], "share", now);
  assert.equal(trend.signals.length, 3);
  assert.equal(trend.signals.find((signal) => signal.id === related.id)?.publishedAt, null);
  assert.equal(trend.independentSourceCount, 2);
});

test("MKT rejects stale, future and standalone undated signals even if just detected", () => {
  const old = fixture({ id: "old", publishedAt: "2026-09-01T00:00:00.000Z" });
  const future = fixture({ id: "future", publishedAt: "2026-10-03T00:00:00.000Z" });
  const undated = fixture({ id: "undated", publishedAt: null });
  assert.deepEqual(analyzeSignals([old, future, undated], "share", now), []);
});

test("MKT duplicate observations keep first detection and latest metrics", () => {
  const before = fixture({ firstDetectedAt: "2026-10-01T12:00:00.000Z", detectedAt: "2026-10-02T10:00:00.000Z", rawMetrics: { views: 50 } });
  const after = fixture({ rawMetrics: { views: 70 } });
  const [trend] = analyzeSignals([before, after], "share", now);
  assert.equal(trend.signals.length, 1);
  assert.equal(trend.firstDetectedAt, before.firstDetectedAt);
  assert.equal(trend.lastDetectedAt, now.toISOString());
  assert.equal(trend.signals[0].rawMetrics.views, 70);
});

test("MKT brand relevance uses word boundaries and changes by selected context", () => {
  const signals = [fixture({ title: "IA transforma recrutamento e trabalho" })];
  assert.ok(scoreBrandRelevance(signals, "share").score > scoreBrandRelevance(signals, "ache").score);
  assert.equal(scoreBrandRelevance([fixture({ title: "Austrália celebra feriado" })], "potencia").score, 0);
});

test("MKT URL normalization preserves meaningful article parameters", () => {
  assert.equal(canonicalUrl("http://www.example.test/story?id=123&utm_source=rss#section"), "https://example.test/story?id=123");
  assert.notEqual(canonicalUrl("https://youtube.com/watch?v=1"), canonicalUrl("https://youtube.com/watch?v=2"));
});
