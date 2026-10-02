"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ExternalLink, LoaderCircle, Search, Sparkles, TrendingUp } from "lucide-react";

type TrendVideoSignal = {
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

type TrendPublicationIdea = {
  format: "Carrossel" | "Post" | "Vídeo curto" | "Artigo";
  title: string;
  angle: string;
  channel: string;
};

type TrendResponse = {
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
  error?: string;
};

const compactNumber = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function TrendIntelligenceClient() {
  const [query, setQuery] = useState("inteligência artificial no trabalho");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSearch() {
    const term = query.trim();
    if (term.length < 2) {
      setMessage("Digite um tema para analisar.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/scout/trends/search?q=${encodeURIComponent(term)}&days=${days}`,
        { cache: "no-store" },
      );
      const payload = await response.json() as TrendResponse;
      if (!response.ok) throw new Error(payload.error || "Não foi possível consultar os sinais.");
      setData(payload);

      if (!payload.configured) {
        setMessage("O módulo está pronto, mas a chave do YouTube Data API ainda não está configurada neste ambiente.");
      }
    } catch (error) {
      setData(null);
      setMessage(error instanceof Error ? error.message : "Falha ao consultar tendências.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  return (
    <>
      <form onSubmit={submit} className="share-card mt-8 grid gap-3 rounded-2xl p-4 lg:grid-cols-[1fr_160px_220px]">
        <label className="sr-only" htmlFor="trend-query">Tema</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            id="trend-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={120}
            placeholder="Ex.: IA no trabalho, acessibilidade digital, carreira..."
            className="h-12 w-full rounded-xl border border-[var(--share-line)] bg-[#fafcf8] pl-11 pr-4 text-sm outline-none focus:border-[var(--share-green-700)]"
          />
        </div>

        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="h-12 rounded-xl border border-[var(--share-line)] bg-white px-4 text-sm font-semibold text-[var(--share-green-950)] outline-none"
        >
          <option value={1}>Últimas 24h</option>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>

        <button
          disabled={loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--share-lime)] px-5 text-sm font-bold text-[var(--share-green-950)] disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          {loading ? "Analisando..." : "Analisar tendências"}
        </button>
      </form>

      {message ? <div className="mt-4 rounded-xl border border-[var(--share-line)] bg-white px-4 py-3 text-sm text-zinc-600">{message}</div> : null}

      {data ? (
        <>
          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_420px]">
            <section className="share-green-panel rounded-2xl p-7 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Leitura do momento</p>
              <h2 className="mt-4 text-3xl font-semibold">{data.query}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/80">{data.summary}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/80">{data.whyNow}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {data.keywords.slice(0, 6).map((keyword) => (
                  <span key={keyword} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--share-green-950)]">{keyword}</span>
                ))}
              </div>
            </section>

            <section className="share-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Trend Score</p>
                <span className="rounded-full bg-[#edf7eb] px-3 py-1 text-xs font-semibold text-[var(--share-green-900)]">
                  {data.generatedBy === "gemini" ? "Insights com IA" : "Insights por regras"}
                </span>
              </div>
              <div className="mt-4 flex items-end gap-5">
                <span className="text-6xl font-semibold text-[var(--share-green-950)]">{data.trendScore}</span>
                <p className="pb-2 text-sm text-zinc-600">Score interno baseado em recência, velocidade, engajamento e quantidade de sinais.</p>
              </div>
              <div className="mt-5 rounded-xl bg-[#eef5ec] p-4 text-sm text-[var(--share-green-900)]">
                {data.videos.length} sinais do YouTube no recorte de {data.days} dia{data.days === 1 ? "" : "s"}.
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
            <section>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--share-green-700)]" />
                <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Oportunidades de publicação</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {data.publicationIdeas.map((idea) => (
                  <article key={idea.title} className="share-card rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <span className="shrink-0 rounded-full bg-[#edf7eb] px-3 py-2 text-xs font-semibold text-[var(--share-green-900)]">{idea.format}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--share-green-950)]">{idea.title}</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-600">{idea.angle}</p>
                          <p className="mt-2 text-xs text-zinc-500">{idea.channel}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="share-card rounded-2xl p-6">
              <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Do insight à imagem</p>
              <h2 className="mt-4 text-2xl font-semibold text-[var(--share-green-950)]">Briefing visual sugerido</h2>
              <p className="mt-4 text-sm leading-6 text-zinc-600">{data.visualBrief}</p>
              <p className="mt-6 text-xs font-semibold uppercase text-[var(--share-green-800)]">Termos de busca</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.searchTerms.map((term) => (
                  <span key={term} className="rounded-full bg-[#eef5ec] px-3 py-2 text-xs font-semibold text-[var(--share-green-900)]">{term}</span>
                ))}
              </div>
              <Link
                href={`/sharevisualscout?q=${encodeURIComponent([data.visualBrief, ...data.searchTerms.slice(0, 4)].join(" | ").slice(0, 480))}`}
                className="mt-6 block rounded-xl bg-[var(--share-lime)] px-4 py-3 text-center text-sm font-bold text-[var(--share-green-950)]"
              >
                Buscar imagens no Visual Scout
              </Link>
            </aside>
          </div>

          {data.videos.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Sinais usados na análise</h2>
              <p className="mt-1 text-sm text-zinc-500">A leitura não trata esses vídeos como verdade; eles funcionam como sinais de atenção e linguagem em circulação.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.videos.slice(0, 6).map((video) => (
                  <article key={video.id} className="share-card overflow-hidden rounded-xl">
                    {video.thumbnailUrl ? (
                      <div
                        className="h-36 bg-cover bg-center"
                        style={{ backgroundImage: `url("${video.thumbnailUrl.replace(/"/g, "%22")}")` }}
                        role="img"
                        aria-label={video.title}
                      />
                    ) : null}
                    <div className="p-4">
                      <p className="line-clamp-2 min-h-10 text-sm font-semibold text-[var(--share-green-950)]">{video.title}</p>
                      <p className="mt-2 text-xs text-zinc-500">{video.channel}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[#eef5ec] px-2 py-1 font-semibold text-[var(--share-green-900)]">{compactNumber.format(video.views)} views</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600">{compactNumber.format(video.viewsPerDay)}/dia</span>
                      </div>
                      <a href={video.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--share-green-800)] hover:underline">
                        Abrir sinal <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="share-card mt-7 rounded-2xl p-8">
          <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Comece por um tema</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--share-green-950)]">Busque um assunto para ver os sinais recentes.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            O primeiro provider é o YouTube Data API. A arquitetura já permite adicionar outros conectores depois, sem mudar a experiência desta tela.
          </p>
        </section>
      )}
    </>
  );
}
