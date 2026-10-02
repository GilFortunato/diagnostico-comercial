import "server-only";
import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { publicUrlSchema, signalSchema, type Signal, type SourceId, type SourceStatus } from "./types";

const HOUR = 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 1_000_000;
export const SOURCE_REGISTRY = [
  { id: "google-trends", name: "Google Trends · Brasil", ttlMs: 20 * 60_000, maxAgeMs: 48 * HOUR },
  { id: "agencia-brasil", name: "Agência Brasil · notícias", ttlMs: 15 * 60_000, maxAgeMs: 72 * HOUR },
  { id: "hacker-news", name: "Hacker News · comunidade global", ttlMs: 20 * 60_000, maxAgeMs: 48 * HOUR },
  { id: "youtube", name: "YouTube · Brasil", ttlMs: 60 * 60_000, maxAgeMs: 72 * HOUR },
] as const;

export type SourceCollectOptions = {
  query?: string;
  now?: Date;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  onWarning?: (message: string) => void;
};
export type SourceAdapter = (typeof SOURCE_REGISTRY)[number] & {
  collect: (options?: SourceCollectOptions) => Promise<Signal[]>;
};
export type SourceCollection = { signals: Signal[]; status: SourceStatus };

class SourceUnavailable extends Error {}

// This limit also applies when different adapters collect concurrently.
let activeRequests = 0;
const requestQueue: Array<() => void> = [];
async function boundedRequest<T>(work: () => Promise<T>): Promise<T> {
  if (activeRequests >= 4) await new Promise<void>((resolve) => requestQueue.push(resolve));
  else activeRequests += 1;
  try { return await work(); }
  finally {
    const next = requestQueue.shift();
    if (next) next();
    else activeRequests -= 1;
  }
}

async function request(url: URL | string, options: SourceCollectOptions): Promise<string> {
  return boundedRequest(async () => {
    const signal = AbortSignal.any([options.signal ?? AbortSignal.timeout(20_000), AbortSignal.timeout(6_000)]);
    signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      signal, cache: "no-store", headers: { Accept: "application/json, application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok) throw new SourceUnavailable(`A fonte respondeu HTTP ${response.status}.`);
    if (Number(response.headers.get("content-length") ?? 0) > MAX_PAYLOAD_BYTES) throw new SourceUnavailable("A fonte excedeu o limite de resposta.");
    const reader = response.body?.getReader();
    if (!reader) throw new SourceUnavailable("A fonte respondeu sem conteúdo.");
    const decoder = new TextDecoder();
    let body = "";
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_PAYLOAD_BYTES) {
          await reader.cancel();
          throw new SourceUnavailable("A fonte excedeu o limite de resposta.");
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      return body + decoder.decode();
    } finally { reader.releaseLock(); }
  });
}

function stableId(source: SourceId, key: string) {
  return `${source}-${createHash("sha256").update(key).digest("hex").slice(0, 22)}`;
}
function cleanText(value: string, max = 500) {
  return value.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" })[entity] ?? " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function timestamp(value: string | number | undefined) {
  if (value === undefined) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
function urlOrNull(value: string | undefined) {
  return publicUrlSchema.safeParse(value).success ? value! : null;
}
const rssSchema = z.object({ rss: z.object({ channel: z.object({ item: z.array(z.unknown()).default([]) }) }) });
const rssItemSchema = z.object({ title: z.string().min(1), link: z.string().optional(), pubDate: z.string().optional() }).passthrough();
function rssItems(xml: string): unknown[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new SourceUnavailable("A fonte retornou um RSS inválido.");
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true, isArray: (name) => name === "item" || name === "ht:news_item" });
  return rssSchema.parse(parser.parse(xml)).rss.channel.item.slice(0, 40);
}
function approximateTraffic(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)*)\s*(K|M|mil)?\+?$/i);
  if (!match) return null;
  const suffix = match[2]?.toLowerCase();
  const numeric = !suffix && /^\d{1,3}(?:[.,]\d{3})+$/.test(match[1]) ? match[1].replace(/[.,]/g, "") : match[1].replace(",", ".");
  const number = Number(numeric) * (suffix === "m" ? 1_000_000 : suffix === "k" || suffix === "mil" ? 1000 : 1);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function googleTrends(options: SourceCollectOptions): Promise<Signal[]> {
  const now = (options.now ?? new Date()).toISOString();
  const items = rssItems(await request("https://trends.google.com/trending/rss?geo=BR", options));
  const signals: Signal[] = [];
  for (const raw of items.slice(0, 20)) {
    const parsed = rssItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const title = cleanText(item.title);
    if (!title) continue;
    const publishedAt = timestamp(item.pubDate);
    const id = stableId("google-trends", `${title}|${publishedAt ?? "undated"}`);
    const traffic = approximateTraffic(item["ht:approx_traffic"]);
    const searchUrl = new URL("https://trends.google.com/trends/explore");
    searchUrl.searchParams.set("geo", "BR");
    searchUrl.searchParams.set("date", "now 1-d");
    searchUrl.searchParams.set("q", title);
    signals.push({ id, source: "google-trends", sourceType: "search", title, url: searchUrl.toString(), publisher: "Google Trends", publishedAt, detectedAt: now, confidence: 0.85, geography: "BR", rawMetrics: traffic === null ? {} : { approximateSearchesLowerBound: traffic }, evidence: [
      `Tema listado no RSS de buscas em alta do Google Trends para o Brasil: ${title}.`,
      traffic === null ? "Volume e variação temporal não informados pelo feed." : `Faixa de buscas informada pela fonte: ${String(item["ht:approx_traffic"])}. É um limite inferior aproximado; o feed não fornece série histórica nem taxa de crescimento.`,
    ] });
    const related = z.array(z.object({ "ht:news_item_title": z.string(), "ht:news_item_url": publicUrlSchema, "ht:news_item_source": z.string().optional() })).safeParse(item["ht:news_item"]);
    if (!related.success) continue;
    for (const news of related.data.slice(0, 3)) {
      const newsTitle = cleanText(news["ht:news_item_title"]);
      if (!newsTitle) continue;
      signals.push({ id: stableId("google-trends", news["ht:news_item_url"]), source: "google-trends", sourceType: "news", title: newsTitle, url: news["ht:news_item_url"], publisher: cleanText(news["ht:news_item_source"] ?? "", 200) || null, relatedSignalId: id, publishedAt: null, detectedAt: now, confidence: 0.6, geography: "BR", rawMetrics: {}, evidence: [`O Google Trends relacionou esta publicação ao tema “${title}” nesta coleta.`, "O feed não informa a data original desta publicação. A associação não comprova causalidade ou confirmação independente."] });
    }
  }
  if (items.length && !signals.length) throw new SourceUnavailable("O feed não contém sinais em formato reconhecido.");
  return signals;
}

async function agenciaBrasil(options: SourceCollectOptions): Promise<Signal[]> {
  const now = (options.now ?? new Date()).toISOString();
  const items = rssItems(await request("https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", options));
  const signals: Signal[] = [];
  for (const raw of items) {
    const parsed = rssItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const title = cleanText(item.title);
    const url = urlOrNull(item.link);
    const publishedAt = timestamp(item.pubDate);
    if (!title || !url || !publishedAt) continue;
    signals.push({ id: stableId("agencia-brasil", url), source: "agencia-brasil", sourceType: "news", title, url, publisher: "Agência Brasil", publishedAt, detectedAt: now, evidence: [`Manchete publicada pela Agência Brasil: ${title}.`, "Fonte: Agência Brasil / EBC. O feed autoriza reprodução com atribuição; nenhuma métrica de audiência é fornecida."], rawMetrics: {}, confidence: 0.85, geography: "BR" });
  }
  if (items.length && !signals.length) throw new SourceUnavailable("O feed não contém notícias com data e URL válidas.");
  return signals;
}

const hnStorySchema = z.object({ id: z.number().int().positive(), type: z.literal("story"), title: z.string(), url: z.string().optional(), time: z.number().positive(), score: z.number().nonnegative().optional(), descendants: z.number().int().nonnegative().optional(), deleted: z.boolean().optional(), dead: z.boolean().optional() });
const hnSearchHitSchema = z.object({ objectID: z.string().regex(/^\d+$/), title: z.string(), url: z.string().nullable().optional(), created_at_i: z.number().positive(), points: z.number().nonnegative().nullable().optional(), num_comments: z.number().int().nonnegative().nullable().optional() });
async function searchHackerNews(options: SourceCollectOptions): Promise<Signal[]> {
  const now = options.now ?? new Date();
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.search = new URLSearchParams({ query: options.query!.trim(), tags: "story", hitsPerPage: "12", restrictSearchableAttributes: "title", numericFilters: `created_at_i>${Math.floor((now.getTime() - 48 * HOUR) / 1000)}` }).toString();
  const response = z.object({ hits: z.array(z.unknown()).max(100) }).parse(JSON.parse(await request(url, options)));
  const signals: Signal[] = [];
  for (const raw of response.hits) {
    const parsed = hnSearchHitSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const title = cleanText(item.title);
    if (!title) continue;
    const rawMetrics: Record<string, number> = {};
    if (item.points != null) rawMetrics.points = item.points;
    if (item.num_comments != null) rawMetrics.comments = item.num_comments;
    signals.push({ id: stableId("hacker-news", item.objectID), source: "hacker-news", sourceType: "community", title, url: urlOrNull(item.url ?? undefined) ?? `https://news.ycombinator.com/item?id=${item.objectID}`, publisher: "Hacker News", publishedAt: timestamp(item.created_at_i * 1000), detectedAt: now.toISOString(), rawMetrics, confidence: 0.75, geography: "global", evidence: [`Resultado recente para “${options.query!.trim()}” na busca do Hacker News fornecida por Algolia.`, `Discussão: https://news.ycombinator.com/item?id=${item.objectID}. As contagens refletem uma comunidade global; não medem público brasileiro nem velocidade.`] });
  }
  if (response.hits.length && !signals.length) throw new SourceUnavailable("A busca da comunidade retornou publicações em formato inválido.");
  if (signals.length < response.hits.length) options.onWarning?.("Alguns resultados da busca não puderam ser validados.");
  return signals;
}
async function hackerNews(options: SourceCollectOptions): Promise<Signal[]> {
  if (options.query?.trim()) return searchHackerNews(options);
  const ids = z.array(z.number().int().positive()).max(1000).parse(JSON.parse(await request("https://hacker-news.firebaseio.com/v0/topstories.json", options))).slice(0, 12);
  const results = await Promise.allSettled(ids.map(async (id) => {
    const payload = JSON.parse(await request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, options));
    const parsed = hnStorySchema.safeParse(payload);
    if (!parsed.success || parsed.data.deleted || parsed.data.dead) return null;
    const story = parsed.data;
    const title = cleanText(story.title);
    if (!title) return null;
    const metrics: Record<string, number> = {};
    if (story.score !== undefined) metrics.points = story.score;
    if (story.descendants !== undefined) metrics.comments = story.descendants;
    return { id: stableId("hacker-news", String(story.id)), source: "hacker-news", sourceType: "community", title, url: urlOrNull(story.url) ?? `https://news.ycombinator.com/item?id=${story.id}`, publisher: "Hacker News", publishedAt: timestamp(story.time * 1000), detectedAt: (options.now ?? new Date()).toISOString(), evidence: [`Publicação na lista de destaque da comunidade global Hacker News: ${title}.`, `Discussão: https://news.ycombinator.com/item?id=${story.id}. Os pontos e comentários são contagens no momento da coleta; não medem o público brasileiro nem velocidade.`], rawMetrics: metrics, confidence: 0.75, geography: "global" } satisfies Signal;
  }));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) options.onWarning?.(`Coleta parcial: ${failed} de ${ids.length} publicações não puderam ser consultadas.`);
  const signals = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  if (ids.length && !signals.length) throw new SourceUnavailable("Não foi possível validar as publicações da comunidade nesta coleta.");
  return signals;
}

const youtubeVideoSchema = z.object({ id: z.string().min(1), snippet: z.object({ title: z.string(), publishedAt: z.string(), channelTitle: z.string() }), statistics: z.object({ viewCount: z.string().regex(/^\d+$/).optional(), likeCount: z.string().regex(/^\d+$/).optional(), commentCount: z.string().regex(/^\d+$/).optional() }).optional() });
async function youtube(options: SourceCollectOptions): Promise<Signal[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new SourceUnavailable("YouTube está indisponível nesta instalação. O radar continua com as fontes públicas.");
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  if (options.query?.trim()) {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.search = new URLSearchParams({ key, part: "snippet", type: "video", q: options.query.trim(), regionCode: "BR", relevanceLanguage: "pt", maxResults: "12", order: "relevance", publishedAfter: new Date((options.now ?? new Date()).getTime() - 72 * HOUR).toISOString() }).toString();
    const search = z.object({ items: z.array(z.object({ id: z.object({ videoId: z.string().min(1) }) })).max(50) }).parse(JSON.parse(await request(searchUrl, options)));
    if (!search.items.length) return [];
    url.search = new URLSearchParams({ key, part: "snippet,statistics", id: search.items.map((item) => item.id.videoId).join(",") }).toString();
  } else {
    url.search = new URLSearchParams({ key, part: "snippet,statistics", chart: "mostPopular", regionCode: "BR", maxResults: "24" }).toString();
  }
  const payload = z.object({ items: z.array(z.unknown()).max(100) }).parse(JSON.parse(await request(url, options)));
  const signals: Signal[] = [];
  for (const raw of payload.items) {
    const parsed = youtubeVideoSchema.safeParse(raw);
    if (!parsed.success) continue;
    const video = parsed.data;
    const publishedAt = timestamp(video.snippet.publishedAt);
    const title = cleanText(video.snippet.title);
    if (!publishedAt || !title) continue;
    const metrics: Record<string, number> = {};
    for (const [field, name] of [["viewCount", "views"], ["likeCount", "likes"], ["commentCount", "comments"]] as const) {
      const count = video.statistics?.[field];
      if (count !== undefined && Number.isFinite(Number(count))) metrics[name] = Number(count);
    }
    signals.push({ id: stableId("youtube", video.id), source: "youtube", sourceType: "video", title, url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`, publisher: cleanText(video.snippet.channelTitle, 200), publishedAt, detectedAt: (options.now ?? new Date()).toISOString(), evidence: [options.query?.trim() ? `Vídeo retornado pela busca recente do YouTube para “${options.query.trim()}”, disponível no Brasil, no canal ${cleanText(video.snippet.channelTitle, 200)}.` : `Vídeo listado pelo YouTube entre os mais populares no recorte Brasil, no canal ${cleanText(video.snippet.channelTitle, 200)}.`, "As contagens são acumuladas no momento da coleta. Sem uma segunda medição comparável, não há taxa de crescimento."], rawMetrics: metrics, confidence: 0.8, geography: "BR" });
  }
  if (payload.items.length && !signals.length) throw new SourceUnavailable("O YouTube não retornou vídeos em formato reconhecido.");
  return signals;
}

const collectors: Record<SourceId, (options: SourceCollectOptions) => Promise<Signal[]>> = { "google-trends": googleTrends, "agencia-brasil": agenciaBrasil, "hacker-news": hackerNews, youtube };
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
const QUERY_STOPWORDS = new Set("a o as os e de da do das dos em no na nos nas um uma para por com sobre the and for of in on".split(" "));
function matchesQuery(signal: Signal, query: string) {
  const title = new Set(normalize(signal.title).split(/[^a-z0-9]+/).filter(Boolean));
  const meaningful = normalize(query).split(/[^a-z0-9]+/).filter((word) => word && !QUERY_STOPWORDS.has(word));
  return meaningful.length > 0 && meaningful.every((word) => title.has(word));
}
export function filterSourceSignals(signals: Signal[], id: SourceId, options: SourceCollectOptions = {}): Signal[] {
  const now = (options.now ?? new Date()).getTime();
  const maxAge = SOURCE_REGISTRY.find((source) => source.id === id)!.maxAgeMs;
  const dated = signals.filter((signal) => {
    const time = signal.publishedAt ? new Date(signal.publishedAt).getTime() : NaN;
    return Number.isFinite(time) && time <= now + 5 * 60_000 && now - time <= maxAge;
  });
  const currentIds = new Set(dated.map((signal) => signal.id));
  const current = signals.filter((signal) => currentIds.has(signal.id) || (!signal.publishedAt && signal.relatedSignalId && currentIds.has(signal.relatedSignalId)));
  const query = options.query?.trim();
  if (!query || id === "hacker-news" || id === "youtube") return current;
  const matches = current.filter((signal) => matchesQuery(signal, query));
  const matchedIds = new Set(matches.flatMap((signal) => [signal.id, ...(signal.relatedSignalId ? [signal.relatedSignalId] : [])]));
  return current.filter((signal) => matchedIds.has(signal.id) || (signal.relatedSignalId && matchedIds.has(signal.relatedSignalId)));
}

export const sourceAdapters: SourceAdapter[] = SOURCE_REGISTRY.map((source) => ({ ...source, collect: async (options: SourceCollectOptions = {}) => {
  const configuredOptions = { ...options, now: options.now ?? new Date(), signal: options.signal ?? AbortSignal.timeout(20_000) };
  const raw = await collectors[source.id](configuredOptions);
  const valid = raw.flatMap((signal) => { const parsed = signalSchema.safeParse(signal); return parsed.success ? [parsed.data] : []; });
  if (raw.length && !valid.length) throw new SourceUnavailable("A fonte retornou sinais inválidos.");
  return filterSourceSignals(valid, source.id, configuredOptions);
} }));

export async function collectSource(id: SourceId, options: SourceCollectOptions = {}): Promise<SourceCollection> {
  const adapter = sourceAdapters.find((source) => source.id === id)!;
  const now = options.now ?? new Date();
  try {
    const warnings: string[] = [];
    const signals = await adapter.collect({ ...options, now, onWarning: (message) => { warnings.push(message); options.onWarning?.(message); } });
    const scope = options.query && (id === "google-trends" || id === "agencia-brasil") ? " Pesquisa aplicada à amostra recente do RSS, sem busca em todo o acervo." : "";
    return { signals, status: { id, name: adapter.name, status: signals.length ? "ok" : "empty", count: signals.length, collectedAt: now.toISOString(), message: signals.length ? `${signals.length} sinais atuais coletados.${id === "hacker-news" ? " Comunidade global; não representa o público brasileiro." : ""}${scope}${warnings.length ? ` ${warnings.join(" ")}` : ""}` : options.query ? "Nenhuma correspondência na amostra recente desta fonte para o tema pesquisado." : "A fonte respondeu, mas a amostra não contém sinais dentro da janela recente." } };
  } catch (error) {
    return { signals: [], status: { id, name: adapter.name, status: "unavailable", count: 0, collectedAt: now.toISOString(), message: error instanceof SourceUnavailable ? error.message : "Não foi possível atualizar esta fonte agora. As demais continuam disponíveis." } };
  }
}
export async function collectSources(options: SourceCollectOptions = {}): Promise<SourceCollection[]> {
  return Promise.all(SOURCE_REGISTRY.map((source) => collectSource(source.id, options)));
}
