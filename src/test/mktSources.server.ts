import assert from "node:assert/strict";
import test from "node:test";
import { collectSource, collectSources, SOURCE_REGISTRY } from "../lib/scout/mkt/sources";

const now = new Date("2026-10-02T12:00:00.000Z");
const xml = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item><title>IA em recrutamento</title><link>https://trends.google.com/trending/rss?geo=BR</link><pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate><ht:approx_traffic>2000+</ht:approx_traffic><ht:news_item><ht:news_item_title>Empresas ampliam testes de IA</ht:news_item_title><ht:news_item_url>https://example.test/story</ht:news_item_url><ht:news_item_source>Publicação de teste</ht:news_item_source></ht:news_item></item></channel></rss>`;
const news = `<?xml version="1.0"?><rss><channel><item><title>Pesquisa sobre trabalho</title><link>https://example.test/news</link><pubDate>Fri, 02 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>`;
function responds(body: string, status = 200): typeof fetch { return (async () => new Response(body, { status })) as typeof fetch; }

test("MKT Trends parses real RSS field shapes and does not copy topic date to related article", async () => {
  const result = await collectSource("google-trends", { now, fetcher: responds(xml) });
  assert.equal(result.status.status, "ok");
  assert.equal(result.signals.length, 2);
  const [parent, related] = result.signals;
  assert.equal(parent.rawMetrics.approximateSearchesLowerBound, 2000);
  assert.equal(related.relatedSignalId, parent.id);
  assert.equal(related.publishedAt, null);
  assert.ok(parent.url?.includes("q=IA+em+recrutamento"));
});

test("MKT malformed XML, oversized payload and failed source degrade explicitly", async () => {
  for (const fetcher of [responds("<rss><channel>"), responds("x".repeat(1_000_001)), responds("error", 503)]) {
    const result = await collectSource("google-trends", { now, fetcher });
    assert.equal(result.status.status, "unavailable");
    assert.deepEqual(result.signals, []);
  }
});

test("MKT forbids RSS entity declarations", async () => {
  const result = await collectSource("google-trends", { now, fetcher: responds('<!DOCTYPE rss [<!ENTITY x "payload">]><rss><channel></channel></rss>') });
  assert.equal(result.status.status, "unavailable");
});

test("MKT old RSS entries and related articles are removed together", async () => {
  const result = await collectSource("google-trends", { now, fetcher: responds(xml.replace("02 Oct 2026", "01 Sep 2026")) });
  assert.equal(result.status.status, "empty");
  assert.equal(result.signals.length, 0);
});

test("MKT manual search is explicit about bounded feed sample without matches", async () => {
  const result = await collectSource("agencia-brasil", { now, query: "astronomia", fetcher: responds(news) });
  assert.equal(result.status.status, "empty");
  assert.match(result.status.message, /amostra recente/);
});

test("MKT unavailable adapters do not erase another source's confirmed signals", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("agenciabrasil")) return new Response(news);
    return new Response("unavailable", { status: 503 });
  }) as typeof fetch;
  const results = await collectSources({ now, fetcher });
  assert.equal(results.length, SOURCE_REGISTRY.length);
  const agency = results.find((result) => result.status.id === "agencia-brasil")!;
  assert.equal(agency.status.status, "ok");
  assert.equal(agency.signals.length, 1);
  assert.ok(results.some((result) => result.status.status === "unavailable"));
});

test("MKT source HTTP work has bounded concurrency even for HN item fanout", async () => {
  let active = 0;
  let peak = 0;
  const fetcher = (async (input: string | URL | Request) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    const url = String(input);
    if (url.includes("topstories")) return new Response(JSON.stringify(Array.from({ length: 12 }, (_, index) => index + 1)));
    if (url.includes("/item/")) return new Response(JSON.stringify({ id: Number(url.match(/item\/(\d+)/)?.[1]), type: "story", title: "Fixture global community story", time: now.getTime() / 1000, score: 10 }));
    return new Response(url.includes("agenciabrasil") ? news : xml);
  }) as typeof fetch;
  const results = await collectSources({ now, fetcher });
  assert.ok(peak <= 4, `Observed ${peak} simultaneous requests`);
  assert.equal(results.find((result) => result.status.id === "hacker-news")?.signals.length, 12);
  assert.ok(results.find((result) => result.status.id === "hacker-news")?.signals.every((signal) => signal.geography === "global"));
});

test("MKT Google Trends preserves thousands separators and compact metric units", async () => {
  for (const [value, expected] of [["1,000+", 1000], ["10.000+", 10000], ["1.5K+", 1500], ["2M+", 2000000]] as const) {
    const result = await collectSource("google-trends", { now, fetcher: responds(xml.replace("2000+", value)) });
    assert.equal(result.signals[0].rawMetrics.approximateSearchesLowerBound, expected);
  }
});
test("MKT manual HN query uses dated search and preserves metrics", async () => {
  let requested = "";
  const fetcher = (async (input: string | URL | Request) => {
    requested = String(input);
    return new Response(JSON.stringify({ hits: [{ objectID: "123", title: "Artificial intelligence at work", url: "https://example.test/ai", created_at_i: now.getTime()/1000-3600, points: 7, num_comments: 2 }] }));
  }) as typeof fetch;
  const result = await collectSource("hacker-news", { now, query: "intelligence", fetcher });
  assert.match(requested, /search_by_date/);
  assert.match(requested, /numericFilters/);
  assert.equal(result.signals[0].rawMetrics.points, 7);
});
test("MKT YouTube query is optional and missing counts remain absent", async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "test-only-not-a-real-key";
  try {
    const requests: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input); requests.push(url);
      return new Response(JSON.stringify(url.includes("/search?") ? { items: [{ id: { videoId: "test-video" } }] } : {
        items: [{ id: "test-video", snippet: { title: "Test video", publishedAt: new Date(now.getTime()-3600000).toISOString(), channelTitle: "Test" }, statistics: { viewCount: "200" } }],
      }));
    }) as typeof fetch;
    const result = await collectSource("youtube", { now, query: "trabalho", fetcher });
    assert.equal(requests.length, 2);
    assert.match(requests[0], /q=trabalho/);
    assert.equal(result.signals[0].rawMetrics.views, 200);
    assert.equal(result.signals[0].rawMetrics.likes, undefined);
    assert.equal(result.signals[0].rawMetrics.velocity, undefined);
  } finally { if (previous === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = previous; }
});
