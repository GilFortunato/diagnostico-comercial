import "server-only";

export const visualScoutLimits = {
  perQuery: 12,
  queryCount: 2,
  prefilter: 30,
  displayBatch: 12,
} as const;

export type ImageProvider = "unsplash" | "pexels" | "pixabay";

export type VisualScoutImage = {
  id: string;
  provider: ImageProvider;
  providerLabel: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
  sourceUrl: string;
  downloadLocation?: string | null;
  width: number;
  height: number;
  author: string;
  authorUrl?: string | null;
  tags: string[];
  score: number;
  attribution: string;
};

export type ProviderState = {
  provider: ImageProvider;
  configured: boolean;
  ok: boolean;
  count: number;
  error?: string;
};

type SearchBundle = {
  items: VisualScoutImage[];
  state: ProviderState;
};

type SearchPlan = {
  queries: string[];
  keywords: string[];
  generatedBy: "gemini" | "rules";
};

const providerLabels: Record<ImageProvider, string> = {
  unsplash: "Unsplash",
  pexels: "Pexels",
  pixabay: "Pixabay",
};

function compactWords(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3)
    .slice(0, 30);
}

function initialScore(item: Omit<VisualScoutImage, "score">, query: string, rank: number) {
  const targetRatio = 16 / 9;
  const ratio = item.width / Math.max(item.height, 1);
  const ratioDistance = Math.abs(ratio - targetRatio) / targetRatio;
  const composition = Math.max(0, 18 - ratioDistance * 22);
  const resolution = Math.min(12, (Math.min(item.width / 1600, item.height / 900)) * 12);

  const words = compactWords(query);
  const haystack = compactWords([item.title, ...item.tags].join(" "));
  const matches = words.filter((word) => haystack.some((candidate) => candidate.includes(word) || word.includes(candidate))).length;
  const semanticProxy = words.length ? Math.min(18, (matches / Math.min(words.length, 8)) * 18) : 0;
  const providerRelevance = Math.max(8, 28 - rank * 0.8);

  return Math.max(1, Math.min(99, Math.round(40 + composition + resolution + semanticProxy + providerRelevance)));
}

function finalize(items: Array<Omit<VisualScoutImage, "score">>, scoreQuery: string) {
  return items.map((item, index) => ({
    ...item,
    score: initialScore(item, scoreQuery, index),
  }));
}

async function buildSearchPlan(briefing: string): Promise<SearchPlan> {
  const fallback = ruleSearchPlan(briefing);
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const prompt = [
    "Você otimiza briefings para busca em bancos de fotografia stock.",
    "Converta o briefing abaixo em consultas curtas e concretas, preferencialmente em inglês, porque os bancos de imagem respondem melhor a termos visuais objetivos.",
    "Não invente marcas, pessoas reais ou fatos. Não descreva conceitos abstratos sem representação visual.",
    "Priorize: sujeito, ambiente, ação, composição e estilo fotográfico.",
    "Gere exatamente 2 consultas de busca, com no máximo 7 palavras cada, diferentes entre si mas fiéis ao briefing.",
    "Gere também até 8 keywords visuais.",
    "Retorne somente JSON no formato { queries: string[], keywords: string[] }.",
    "",
    "BRIEFING:",
    briefing,
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                queries: { type: "array", items: { type: "string" } },
                keywords: { type: "array", items: { type: "string" } },
              },
              required: ["queries", "keywords"],
            },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) return fallback;

    const body = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!raw) return fallback;

    const parsed = JSON.parse(stripCodeFence(raw)) as { queries?: unknown; keywords?: unknown };
    const queries = cleanQueries(parsed.queries, briefing);
    const keywords = cleanKeywords(parsed.keywords);

    return queries.length
      ? {
          queries: queries.slice(0, visualScoutLimits.queryCount),
          keywords: keywords.length ? keywords : fallback.keywords,
          generatedBy: "gemini",
        }
      : fallback;
  } catch {
    return fallback;
  }
}

function ruleSearchPlan(briefing: string): SearchPlan {
  const fragments = briefing
    .split(/[|;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const words = compactWords(briefing)
    .filter((word) => !["para", "com", "uma", "das", "dos", "que", "por", "mais", "como", "the", "and", "with"].includes(word));

  const compact = words.slice(0, 7).join(" ");
  const alternate = words.slice(2, 9).join(" ");

  const queries = uniqueStrings([
    fragments[0]?.slice(0, 90) || "",
    compact,
    alternate,
  ]).filter((item) => item.length >= 3).slice(0, visualScoutLimits.queryCount);

  return {
    queries: queries.length ? queries : [briefing.slice(0, 90)],
    keywords: words.slice(0, 8),
    generatedBy: "rules",
  };
}

function cleanQueries(value: unknown, briefing: string) {
  if (!Array.isArray(value)) return ruleSearchPlan(briefing).queries;
  return uniqueStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim())
      .filter((item) => item.length >= 3)
      .map((item) => item.split(/\s+/).slice(0, 7).join(" ")),
  );
}

function cleanKeywords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/[“”"]/g, "").trim())
      .filter((item) => item.length >= 2),
  ).slice(0, 8);
}

function stripCodeFence(value: string) {
  return value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

async function searchUnsplash(providerQuery: string, scoreQuery: string): Promise<SearchBundle> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  const state: ProviderState = { provider: "unsplash", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      query: providerQuery,
      per_page: String(visualScoutLimits.perQuery),
      orientation: "landscape",
      content_filter: "high",
      order_by: "relevant",
    });

    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json() as {
      results?: Array<{
        id: string;
        width: number;
        height: number;
        description?: string | null;
        alt_description?: string | null;
        urls?: { regular?: string; full?: string; small?: string };
        links?: { html?: string; download_location?: string };
        user?: { name?: string; links?: { html?: string } };
      }>;
    };

    const normalized = (payload.results ?? []).flatMap((photo) => {
      const previewUrl = photo.urls?.regular ?? photo.urls?.small;
      const fullUrl = photo.urls?.full ?? previewUrl;
      const sourceUrl = photo.links?.html;
      if (!previewUrl || !fullUrl || !sourceUrl) return [];
      const author = photo.user?.name?.trim() || "Unsplash contributor";
      return [{
        id: `unsplash:${photo.id}`,
        provider: "unsplash" as const,
        providerLabel: providerLabels.unsplash,
        title: photo.alt_description?.trim() || photo.description?.trim() || "Imagem do Unsplash",
        previewUrl,
        fullUrl,
        sourceUrl,
        downloadLocation: photo.links?.download_location ?? null,
        width: photo.width,
        height: photo.height,
        author,
        authorUrl: photo.user?.links?.html ?? null,
        tags: compactWords(photo.alt_description ?? photo.description ?? ""),
        attribution: `Foto por ${author} / Unsplash`,
      }];
    });

    const items = finalize(normalized, scoreQuery);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Unsplash" } };
  }
}

async function searchPexels(providerQuery: string, scoreQuery: string): Promise<SearchBundle> {
  const key = process.env.PEXELS_API_KEY?.trim();
  const state: ProviderState = { provider: "pexels", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      query: providerQuery,
      per_page: String(visualScoutLimits.perQuery),
      orientation: "landscape",
      size: "medium",
      locale: "en-US",
    });

    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: key },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json() as {
      photos?: Array<{
        id: number;
        width: number;
        height: number;
        url?: string;
        photographer?: string;
        photographer_url?: string;
        alt?: string;
        src?: { large?: string; large2x?: string; landscape?: string; original?: string };
      }>;
    };

    const normalized = (payload.photos ?? []).flatMap((photo) => {
      const previewUrl = photo.src?.large ?? photo.src?.landscape;
      const fullUrl = photo.src?.large2x ?? photo.src?.original ?? previewUrl;
      if (!previewUrl || !fullUrl || !photo.url) return [];
      const author = photo.photographer?.trim() || "Pexels contributor";
      return [{
        id: `pexels:${photo.id}`,
        provider: "pexels" as const,
        providerLabel: providerLabels.pexels,
        title: photo.alt?.trim() || "Imagem do Pexels",
        previewUrl,
        fullUrl,
        sourceUrl: photo.url,
        width: photo.width,
        height: photo.height,
        author,
        authorUrl: photo.photographer_url ?? null,
        tags: compactWords(photo.alt ?? ""),
        attribution: `Foto por ${author} / Pexels`,
      }];
    });

    const items = finalize(normalized, scoreQuery);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Pexels" } };
  }
}

async function searchPixabay(providerQuery: string, scoreQuery: string): Promise<SearchBundle> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  const state: ProviderState = { provider: "pixabay", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      key,
      q: providerQuery.slice(0, 100),
      lang: "en",
      image_type: "photo",
      orientation: "horizontal",
      safesearch: "true",
      min_width: "1000",
      min_height: "560",
      per_page: String(visualScoutLimits.perQuery),
      order: "popular",
    });

    const response = await fetch(`https://pixabay.com/api/?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json() as {
      hits?: Array<{
        id: number;
        pageURL?: string;
        tags?: string;
        webformatURL?: string;
        largeImageURL?: string;
        imageWidth: number;
        imageHeight: number;
        user?: string;
      }>;
    };

    const normalized = (payload.hits ?? []).flatMap((photo) => {
      const previewUrl = photo.webformatURL;
      const fullUrl = photo.largeImageURL ?? previewUrl;
      if (!previewUrl || !fullUrl || !photo.pageURL) return [];
      const author = photo.user?.trim() || "Pixabay contributor";
      return [{
        id: `pixabay:${photo.id}`,
        provider: "pixabay" as const,
        providerLabel: providerLabels.pixabay,
        title: photo.tags?.trim() || "Imagem do Pixabay",
        previewUrl,
        fullUrl,
        sourceUrl: photo.pageURL,
        width: photo.imageWidth,
        height: photo.imageHeight,
        author,
        authorUrl: null,
        tags: compactWords(photo.tags ?? ""),
        attribution: `Imagem por ${author} / Pixabay`,
      }];
    });

    const items = finalize(normalized, scoreQuery);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Pixabay" } };
  }
}

async function searchProviderAcrossQueries(
  provider: ImageProvider,
  queries: string[],
  briefing: string,
) {
  const run = provider === "unsplash" ? searchUnsplash : provider === "pexels" ? searchPexels : searchPixabay;
  const bundles = await Promise.all(queries.map((query) => run(query, briefing)));
  const items = dedupe(bundles.flatMap((bundle) => bundle.items));
  const configured = bundles.some((bundle) => bundle.state.configured);
  const ok = bundles.some((bundle) => bundle.state.ok);
  const errors = uniqueStrings(bundles.map((bundle) => bundle.state.error || "").filter(Boolean));

  return {
    items,
    state: {
      provider,
      configured,
      ok,
      count: items.length,
      ...(errors.length ? { error: errors.join(" · ") } : {}),
    } satisfies ProviderState,
  };
}

function dedupe(items: VisualScoutImage[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const byId = item.id.toLocaleLowerCase();
    const byUrl = item.previewUrl.split("?")[0].replace(/https?:\/\//, "").toLocaleLowerCase();
    const key = `${byId}|${byUrl}`;
    if (seen.has(byId) || seen.has(byUrl) || seen.has(key)) return false;
    seen.add(byId);
    seen.add(byUrl);
    seen.add(key);
    return true;
  });
}

export async function searchVisualScoutImages(briefing: string) {
  const plan = await buildSearchPlan(briefing);
  const queries = plan.queries.slice(0, visualScoutLimits.queryCount);

  const bundles = await Promise.all([
    searchProviderAcrossQueries("unsplash", queries, briefing),
    searchProviderAcrossQueries("pexels", queries, briefing),
    searchProviderAcrossQueries("pixabay", queries, briefing),
  ]);

  const raw = bundles.flatMap((bundle) => bundle.items);
  const suitable = dedupe(raw)
    .filter((item) => item.width >= 900 && item.height >= 500 && item.width / Math.max(item.height, 1) >= 1.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, visualScoutLimits.prefilter);

  return {
    query: briefing,
    searchQueries: queries,
    searchKeywords: plan.keywords,
    queryGeneratedBy: plan.generatedBy,
    rawCount: raw.length,
    prefilteredCount: suitable.length,
    batchSize: visualScoutLimits.displayBatch,
    providers: bundles.map((bundle) => bundle.state),
    results: suitable,
  };
}
