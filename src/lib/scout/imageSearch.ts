import "server-only";

export const visualScoutLimits = {
  perProvider: 20,
  prefilter: 24,
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
    .slice(0, 24);
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

function finalize(items: Array<Omit<VisualScoutImage, "score">>, query: string) {
  return items.map((item, index) => ({
    ...item,
    score: initialScore(item, query, index),
  }));
}

async function searchUnsplash(query: string): Promise<SearchBundle> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  const state: ProviderState = { provider: "unsplash", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(visualScoutLimits.perProvider),
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
      signal: AbortSignal.timeout(9000),
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

    const items = finalize(normalized, query);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Unsplash" } };
  }
}

async function searchPexels(query: string): Promise<SearchBundle> {
  const key = process.env.PEXELS_API_KEY?.trim();
  const state: ProviderState = { provider: "pexels", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(visualScoutLimits.perProvider),
      orientation: "landscape",
      size: "medium",
      locale: "pt-BR",
    });

    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: key },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
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

    const items = finalize(normalized, query);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Pexels" } };
  }
}

async function searchPixabay(query: string): Promise<SearchBundle> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  const state: ProviderState = { provider: "pixabay", configured: Boolean(key), ok: false, count: 0 };
  if (!key) return { items: [], state };

  try {
    const params = new URLSearchParams({
      key,
      q: query.slice(0, 100),
      lang: "pt",
      image_type: "photo",
      orientation: "horizontal",
      safesearch: "true",
      min_width: "1200",
      min_height: "675",
      per_page: String(visualScoutLimits.perProvider),
      order: "popular",
    });

    const response = await fetch(`https://pixabay.com/api/?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
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
        userImageURL?: string;
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

    const items = finalize(normalized, query);
    return { items, state: { ...state, ok: true, count: items.length } };
  } catch (error) {
    return { items: [], state: { ...state, error: error instanceof Error ? error.message : "Falha no Pixabay" } };
  }
}

function dedupe(items: VisualScoutImage[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const canonical = item.previewUrl.split("?")[0].replace(/https?:\/\//, "").toLocaleLowerCase();
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

export async function searchVisualScoutImages(query: string) {
  const bundles = await Promise.all([
    searchUnsplash(query),
    searchPexels(query),
    searchPixabay(query),
  ]);

  const raw = bundles.flatMap((bundle) => bundle.items);
  const suitable = dedupe(raw)
    .filter((item) => item.width >= 1000 && item.height >= 560 && item.width / Math.max(item.height, 1) >= 1.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, visualScoutLimits.prefilter);

  return {
    query,
    rawCount: raw.length,
    prefilteredCount: suitable.length,
    batchSize: visualScoutLimits.displayBatch,
    providers: bundles.map((bundle) => bundle.state),
    results: suitable,
  };
}
