"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bookmark, Check, ExternalLink, LoaderCircle, Search } from "lucide-react";

type ScoutImage = {
  id: string;
  provider: "unsplash" | "pexels" | "pixabay";
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

type ProviderState = {
  provider: "unsplash" | "pexels" | "pixabay";
  configured: boolean;
  ok: boolean;
  count: number;
  error?: string;
};

type SearchResponse = {
  query: string;
  rawCount: number;
  prefilteredCount: number;
  batchSize: number;
  providers: ProviderState[];
  results: ScoutImage[];
  error?: string;
};

const providerNames = {
  unsplash: "Unsplash",
  pexels: "Pexels",
  pixabay: "Pixabay",
} as const;

export function VisualScoutClient() {
  const params = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSearch(value: string) {
    const briefing = value.trim();
    if (briefing.length < 3) {
      setMessage("Descreva um pouco mais o briefing para iniciar a busca.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setSelected([]);
    setVisibleCount(12);

    try {
      const response = await fetch(`/api/scout/images/search?q=${encodeURIComponent(briefing)}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(payload.error || "Não foi possível buscar as imagens.");
      setData(payload);

      const configured = payload.providers.filter((provider) => provider.configured);
      if (!configured.length) {
        setMessage("O motor está pronto, mas nenhum banco de imagens tem chave configurada neste ambiente ainda.");
      } else if (!payload.results.length) {
        setMessage("Os bancos responderam, mas nenhuma imagem passou pelos filtros desta busca. Tente um briefing um pouco mais amplo.");
      }
    } catch (error) {
      setData(null);
      setMessage(error instanceof Error ? error.message : "Falha ao consultar os bancos de imagem.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial.trim().length >= 3) void runSearch(initial);
    // Executa somente quando o briefing chega pela URL do Trend Intelligence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  const visible = useMemo(() => data?.results.slice(0, visibleCount) ?? [], [data, visibleCount]);
  const hasMore = Boolean(data && visibleCount < data.results.length);

  return (
    <>
      <form onSubmit={submit} className="share-card rounded-2xl p-6">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Briefing visual</label>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex.: mulher em tecnologia, ambiente corporativo natural, diversidade, horizontal 16:9 e espaço negativo à esquerda..."
            className="resize-none rounded-xl border border-[var(--share-line)] bg-[#fafcf8] px-4 py-3 text-sm outline-none focus:border-[var(--share-green-700)]"
          />
          <button
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--share-lime)] px-5 py-3 text-sm font-bold text-[var(--share-green-950)] disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Buscando..." : "Buscar referências"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Até 20 por banco → até 60 brutas → 24 pré-selecionadas → 12 por rodada.</span>
          <span>{query.length}/500</span>
        </div>
      </form>

      {message ? (
        <div className="mt-5 rounded-xl border border-[var(--share-line)] bg-white px-4 py-3 text-sm text-zinc-600">{message}</div>
      ) : null}

      {data ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Resultados recomendados</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {data.rawCount} encontradas nos providers · {data.prefilteredCount} passaram pelo pré-filtro · mostrando {Math.min(visible.length, data.prefilteredCount)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.providers.map((provider) => (
                <span
                  key={provider.provider}
                  title={provider.error}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    provider.ok
                      ? "bg-[#edf7eb] text-[var(--share-green-900)]"
                      : provider.configured
                        ? "bg-amber-50 text-amber-800"
                        : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {providerNames[provider.provider]} · {provider.ok ? provider.count : provider.configured ? "erro" : "sem chave"}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => {
              const active = selected.includes(item.id);
              return (
                <article
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border bg-white transition ${
                    active ? "border-[var(--share-green-700)] ring-2 ring-[var(--share-mint)]" : "border-[var(--share-line)]"
                  }`}
                >
                  <button type="button" onClick={() => toggle(item.id)} className="block w-full text-left">
                    <div
                      className="m-3 h-48 rounded-xl bg-[#e9efe7] bg-cover bg-center"
                      style={{ backgroundImage: `url("${item.previewUrl.replace(/"/g, "%22")}")` }}
                      role="img"
                      aria-label={item.title}
                    />
                    <div className="p-4 pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--share-mint)] px-3 py-1 text-xs font-bold text-[var(--share-green-950)]">{item.score}%</span>
                          <span className="text-xs font-semibold text-zinc-600">{item.providerLabel}</span>
                        </div>
                        {active ? <Check className="h-5 w-5 text-[var(--share-green-700)]" /> : null}
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-[var(--share-green-950)]">{item.title}</p>
                      <p className="mt-2 text-xs text-zinc-500">{item.width}×{item.height} · pré-score de aderência</p>
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--share-line)] px-4 py-3">
                    <span className="truncate text-xs text-zinc-500">{item.attribution}</span>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--share-green-800)] hover:underline"
                    >
                      Fonte <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + data.batchSize)}
                className="rounded-xl border border-[var(--share-line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--share-green-950)] hover:bg-[#edf7eb]"
              >
                Carregar mais {Math.min(data.batchSize, data.results.length - visibleCount)}
              </button>
            </div>
          ) : null}

          {data.results.length ? (
            <div className="sticky bottom-4 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--share-green-950)] p-4 text-white shadow-xl">
              <span className="text-sm font-semibold">{selected.length} referências selecionadas</span>
              <button
                type="button"
                disabled={!selected.length}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--share-lime)] px-4 py-2 text-sm font-bold text-[var(--share-green-950)] disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4" /> Salvar coleção
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
