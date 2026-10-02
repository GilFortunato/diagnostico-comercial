import "server-only";

export type TrendVideoSignal = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  viewsPerDay: number;
  engagementRate: number;
  signalScore: number;
};

export type TrendPublicationIdea = {
  format: "Carrossel" | "Post" | "Vídeo curto" | "Artigo";
  title: string;
  angle: string;
  channel: string;
};

export type TrendSearchResult = {
  query: string;
  days: number;
  provider: "youtube";
  configured: boolean;
  trendScore: number;
  summary: string;
  whyNow: string;
  keywords: string[];
  publicationIdeas: TrendPublicationIdea[];
  visualBrief: string;
  searchTerms: string[];
  videos: TrendVideoSignal[];
  generatedBy: "gemini" | "rules";
};

const stopWords = new Set([
  "para","como","mais","menos","sobre","entre","depois","antes","isso","essa","esse","uma","umas","uns","com","sem","dos","das","que","por","pra","pro",
  "the","and","for","with","from","this","that","how","what","why","your","you","are","new","aos","nas","nos","não","sim","tem","ter","ser","está","estao",
  "video","oficial","official","shorts","short","live","2026","2025"
]);

function compactWords(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function topKeywords(videos: TrendVideoSignal[], query: string) {
  const queryWords = new Set(compactWords(query));
  const counts = new Map<string, number>();
  for (const video of videos) {
    const unique = new Set(compactWords(video.title));
    for (const word of unique) {
      if (queryWords.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word]) => word);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function calculateTrendScore(videos: TrendVideoSignal[]) {
  if (!videos.length) return 0;
  const avgVelocity = videos.reduce((sum, video) => sum + Math.log10(Math.max(video.viewsPerDay, 1)), 0) / videos.length;
  const avgEngagement = videos.reduce((sum, video) => sum + video.engagementRate, 0) / videos.length;
  const breadth = Math.min(1, videos.length / 20);
  return Math.round(clamp(24 + avgVelocity * 11 + Math.min(avgEngagement, 10) * 2.3 + breadth * 14));
}

function ruleBasedInsights(query: string, days: number, videos: TrendVideoSignal[], keywords: string[]) {
  const keyword = keywords[0] || "mudança de comportamento";
  const second = keywords[1] || "aplicação prática";
  const summary = videos.length
    ? `O tema “${query}” mostra sinais recentes de atenção no YouTube brasileiro, com ${videos.length} vídeos relevantes no recorte analisado.`
    : `Ainda não há sinais suficientes no provider configurado para sustentar uma leitura forte sobre “${query}”.`;
  const whyNow = videos.length
    ? `O volume recente de conteúdo e a velocidade de visualizações sugerem oportunidade para abordar ${keyword} e ${second} enquanto o assunto ainda está circulando.`
    : "Amplie o período ou tente um termo menos específico para obter uma base mais representativa.";

  const publicationIdeas: TrendPublicationIdea[] = [
    {
      format: "Carrossel",
      title: `O que está mudando em ${query}: 5 sinais para observar`,
      angle: `Organize os principais movimentos ligados a ${keyword} em uma leitura prática, sem repetir manchetes.`,
      channel: "LinkedIn / Instagram",
    },
    {
      format: "Post",
      title: `O que ${keyword} revela sobre ${query}`,
      angle: "Transforme o sinal em ponto de vista: contexto, implicação e aplicação para o público da marca.",
      channel: "LinkedIn",
    },
    {
      format: "Vídeo curto",
      title: `${query}: o que mudou nos últimos ${days} dias?`,
      angle: `Abra com o dado/sinal mais forte, conecte com ${second} e feche com uma pergunta ou aplicação.`,
      channel: "Reels / Shorts",
    },
  ];

  const visualBrief = `Fotografia editorial natural relacionada a ${query}; contexto profissional contemporâneo; presença humana; diversidade; composição horizontal 16:9; estética realista; evitar clichês e futurismo exagerado; deixar espaço negativo para headline.`;
  const searchTerms = [query, keyword, second].filter(Boolean);

  return { summary, whyNow, publicationIdeas, visualBrief, searchTerms };
}

async function enrichWithGemini(input: {
  query: string;
  days: number;
  trendScore: number;
  keywords: string[];
  videos: TrendVideoSignal[];
}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  if (!key) return null;

  const evidence = input.videos.slice(0, 10).map((video) => ({
    title: video.title,
    channel: video.channel,
    publishedAt: video.publishedAt,
    views: video.views,
    viewsPerDay: video.viewsPerDay,
    engagementRate: video.engagementRate,
  }));

  const prompt = [
    "Você é um analista de tendências e conteúdo para marcas brasileiras.",
    "Use SOMENTE os sinais fornecidos como evidência. Não invente volume de busca, causalidade ou fatos externos.",
    "Gere JSON válido com exatamente as chaves: summary, whyNow, publicationIdeas, visualBrief, searchTerms.",
    "publicationIdeas deve ter 3 itens com format, title, angle, channel.",
    "Os formatos permitidos são Carrossel, Post, Vídeo curto ou Artigo.",
    "visualBrief deve ser um briefing fotográfico objetivo para um buscador de banco de imagens, incluindo composição e evitando clichês.",
    "searchTerms deve conter 3 a 6 termos curtos úteis para busca visual.",
    JSON.stringify({
      query: input.query,
      periodDays: input.days,
      internalTrendScore: input.trendScore,
      extractedKeywords: input.keywords,
      youtubeSignals: evidence,
    }),
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) return null;

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as {
      summary?: string;
      whyNow?: string;
      publicationIdeas?: TrendPublicationIdea[];
      visualBrief?: string;
      searchTerms?: string[];
    };
    if (!parsed.summary || !parsed.whyNow || !parsed.visualBrief || !Array.isArray(parsed.publicationIdeas) || !Array.isArray(parsed.searchTerms)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function searchTrendIntelligence(query: string, days: number): Promise<TrendSearchResult> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    const rules = ruleBasedInsights(query, days, [], []);
    return {
      query,
      days,
      provider: "youtube",
      configured: false,
      trendScore: 0,
      keywords: [],
      videos: [],
      generatedBy: "rules",
      ...rules,
    };
  }

  const publishedAfter = new Date(Date.now() - days * 86_400_000).toISOString();
  const searchParams = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "25",
    order: "viewCount",
    publishedAfter,
    regionCode: "BR",
    relevanceLanguage: "pt",
    safeSearch: "moderate",
    key,
  });

  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!searchResponse.ok) throw new Error(`YouTube search respondeu HTTP ${searchResponse.status}`);

  const searchPayload = await searchResponse.json() as {
    items?: Array<{ id?: { videoId?: string } }>;
  };
  const ids = (searchPayload.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  if (!ids.length) {
    const rules = ruleBasedInsights(query, days, [], []);
    return {
      query,
      days,
      provider: "youtube",
      configured: true,
      trendScore: 0,
      keywords: [],
      videos: [],
      generatedBy: "rules",
      ...rules,
    };
  }

  const detailParams = new URLSearchParams({
    part: "snippet,statistics",
    id: ids.join(","),
    key,
  });
  const detailResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!detailResponse.ok) throw new Error(`YouTube details respondeu HTTP ${detailResponse.status}`);

  const detailPayload = await detailResponse.json() as {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
      };
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    }>;
  };

  const now = Date.now();
  const videos = (detailPayload.items ?? []).map((video) => {
    const publishedAt = video.snippet?.publishedAt || new Date(now).toISOString();
    const ageDays = Math.max(0.5, (now - new Date(publishedAt).getTime()) / 86_400_000);
    const views = Number(video.statistics?.viewCount ?? 0);
    const likes = Number(video.statistics?.likeCount ?? 0);
    const comments = Number(video.statistics?.commentCount ?? 0);
    const viewsPerDay = Math.round(views / ageDays);
    const engagementRate = views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0;
    const signalScore = Math.round(clamp(30 + Math.log10(Math.max(viewsPerDay, 1)) * 12 + Math.min(engagementRate, 10) * 2));
    return {
      id: video.id,
      title: video.snippet?.title?.trim() || "Vídeo sem título",
      channel: video.snippet?.channelTitle?.trim() || "Canal",
      publishedAt,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnailUrl: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.medium?.url ?? video.snippet?.thumbnails?.default?.url ?? null,
      views,
      likes,
      comments,
      viewsPerDay,
      engagementRate,
      signalScore,
    };
  }).sort((a, b) => b.signalScore - a.signalScore);

  const keywords = topKeywords(videos, query);
  const trendScore = calculateTrendScore(videos);
  const rules = ruleBasedInsights(query, days, videos, keywords);
  const ai = await enrichWithGemini({ query, days, trendScore, keywords, videos });

  return {
    query,
    days,
    provider: "youtube",
    configured: true,
    trendScore,
    keywords,
    videos: videos.slice(0, 12),
    generatedBy: ai ? "gemini" : "rules",
    summary: ai?.summary ?? rules.summary,
    whyNow: ai?.whyNow ?? rules.whyNow,
    publicationIdeas: ai?.publicationIdeas ?? rules.publicationIdeas,
    visualBrief: ai?.visualBrief ?? rules.visualBrief,
    searchTerms: ai?.searchTerms ?? rules.searchTerms,
  };
}
